
import { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleUser } from '../types';

// Declare types for window.gapi and window.google
declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/drive.file';
const TOKEN_STORAGE_KEY = 'jantzcard_google_token';
const EXPIRY_STORAGE_KEY = 'jantzcard_token_expiry';
const USER_EMAIL_KEY = 'jantzcard_user_email';

// 5 Minutes buffer to ensure we refresh tokens BEFORE they expire server-side
const TOKEN_BUFFER_MS = 300000;

export const useGoogleAuth = () => {
  const [isGapiLoaded, setIsGapiLoaded] = useState(false);
  const [isGisLoaded, setIsGisLoaded] = useState(false);

  const tokenClientRef = useRef<any>(null);

  // Ref to hold the resolve function for the pending token request (for ensureToken)
  const pendingTokenResolve = useRef<((token: string) => void) | null>(null);

  const [currentUser, setCurrentUser] = useState<GoogleUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Check for scripts loaded by index.html
  useEffect(() => {
    const checkGapi = setInterval(() => {
      if (window.gapi) {
        setIsGapiLoaded(true);
        clearInterval(checkGapi);
      }
    }, 100);

    const checkGis = setInterval(() => {
      if (window.google) {
        setIsGisLoaded(true);
        clearInterval(checkGis);
      }
    }, 100);

    return () => {
      clearInterval(checkGapi);
      clearInterval(checkGis);
    };
  }, []);

  const initializeClient = useCallback(async (apiKey: string, clientId: string) => {
    if (!isGapiLoaded || !isGisLoaded) {
      setError('Google scripts not loaded yet. Please refresh.');
      return { success: false, restored: false };
    }

    setIsLoading(true);
    setError(null);

    // 1. Initialize gapi.client (The "Data" Layer)
    try {
      await new Promise<void>((resolve, reject) => {
        window.gapi.load('client', {
          callback: resolve,
          onerror: reject,
        });
      });

      await window.gapi.client.init({
        apiKey: apiKey,
        discoveryDocs: [DISCOVERY_DOC],
      });
    } catch (gapiErr: any) {
      console.error('GAPI client init failed', gapiErr);
      const msg = gapiErr?.result?.error?.message || gapiErr?.message || JSON.stringify(gapiErr);
      setError(`Google Sheets API failed to load: ${msg}`);
      // Continue to try loading auth
    }

    // 2. Initialize Identity Services Token Client (The "Auth" Layer)
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: async (tokenResponse: any) => {
          if (tokenResponse && tokenResponse.access_token) {
            const hasSheetsScope = window.google.accounts.oauth2.hasGrantedAllScopes(
              tokenResponse,
              'https://www.googleapis.com/auth/spreadsheets'
            );

            if (!hasSheetsScope) {
              setError("Insufficient Permissions: You must grant access to Google Sheets to use this app.");
              return;
            }

            // Save token to localStorage
            const expiresIn = tokenResponse.expires_in || 3599; // Default to 1 hour
            const expirationTime = Date.now() + (expiresIn * 1000);
            localStorage.setItem(TOKEN_STORAGE_KEY, tokenResponse.access_token);
            localStorage.setItem(EXPIRY_STORAGE_KEY, expirationTime.toString());

            // Pass the token to gapi
            if (window.gapi.client) {
              window.gapi.client.setToken(tokenResponse);
            }

            // Fetch user profile
            await fetchUserProfile(tokenResponse.access_token);

            // Resolve pending promise if ensureToken was waiting
            if (pendingTokenResolve.current) {
              pendingTokenResolve.current(tokenResponse.access_token);
              pendingTokenResolve.current = null;
            }
          }
        },
      });

      tokenClientRef.current = client;

      // 3. Attempt to restore session from localStorage
      const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      const storedExpiry = localStorage.getItem(EXPIRY_STORAGE_KEY);
      let restored = false;

      if (storedToken && storedExpiry) {
        // Use Buffer: If expired OR within buffer period, don't restore logic, force re-login later
        if (Date.now() < parseInt(storedExpiry, 10) - TOKEN_BUFFER_MS) {
          window.gapi.client.setToken({ access_token: storedToken });
          try {
            // Validate token by fetching profile
            await fetchUserProfile(storedToken);
            restored = true;
          } catch (e) {
            console.warn("Failed to restore session", e);
            localStorage.removeItem(TOKEN_STORAGE_KEY);
            localStorage.removeItem(EXPIRY_STORAGE_KEY);
          }
        } else {
          // If expired on load (or within buffer), we do NOT restore currentUser. 
          // User sees Login button.
          // Note: We don't necessarily clear it here, ensureToken can handle the refresh,
          // but for "Automatic Restore" we want to be strict.
          console.log("Token expired or within buffer zone on load. Requiring fresh login.");
          localStorage.removeItem(TOKEN_STORAGE_KEY);
          localStorage.removeItem(EXPIRY_STORAGE_KEY);
        }
      }

      setIsLoading(false);
      return { success: true, restored };

    } catch (err: any) {
      console.error('Error initializing Google Auth Client', err);
      setError(`Auth Initialization failed: ${err.message || JSON.stringify(err)}`);
      setIsLoading(false);
      return { success: false, restored: false };
    }
  }, [isGapiLoaded, isGisLoaded]);

  const fetchUserProfile = async (token: string) => {
    try {
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!userInfoRes.ok) throw new Error('Failed to fetch user profile');

      const userInfo = await userInfoRes.json();

      if (userInfo.email) {
        localStorage.setItem(USER_EMAIL_KEY, userInfo.email);
      }

      setCurrentUser({
        name: userInfo.name,
        picture: userInfo.picture,
        email: userInfo.email
      });
      setError(null);
    } catch (err) {
      console.error('Failed to fetch user info', err);
      setError('Authenticated, but failed to fetch user profile.');
      throw err;
    }
  };

  const login = useCallback((forceConsent: boolean = false) => {
    if (tokenClientRef.current) {
      const storedEmail = localStorage.getItem(USER_EMAIL_KEY);
      const config: any = {
        prompt: forceConsent ? 'consent' : '',
      };
      if (storedEmail && !forceConsent) {
        config.login_hint = storedEmail;
      }
      tokenClientRef.current.requestAccessToken(config);
    } else {
      setError('Client not initialized. Please enter API credentials.');
    }
  }, []);

  // Returns a valid token or prompts for login and returns new token
  const ensureToken = useCallback(async (): Promise<string | null> => {
    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    const storedExpiry = localStorage.getItem(EXPIRY_STORAGE_KEY);

    // use Buffer: Refresh if we are within 5 mins of expiry
    if (storedToken && storedExpiry && Date.now() < parseInt(storedExpiry, 10) - TOKEN_BUFFER_MS) {
      return storedToken;
    }

    // Token expired or missing. Trigger refresh.
    if (!tokenClientRef.current) {
      setError('Auth client not ready.');
      return null;
    }

    console.log("Token expired (or within buffer). Refreshing...");

    // Return a promise that resolves when the callback in initTokenClient fires
    return new Promise<string>((resolve) => {
      pendingTokenResolve.current = resolve;
      // Standard login call without forcing consent (unless previously revoked)
      const storedEmail = localStorage.getItem(USER_EMAIL_KEY);
      const config: any = { prompt: '' };
      if (storedEmail) config.login_hint = storedEmail;

      tokenClientRef.current.requestAccessToken(config);
    });
  }, []);

  const logout = useCallback(() => {
    const token = window.gapi?.client?.getToken();
    if (token !== null && window.google) {
      window.google.accounts.oauth2.revoke(token.access_token, () => {
        if (window.gapi.client) window.gapi.client.setToken(null);
        setCurrentUser(null);
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(EXPIRY_STORAGE_KEY);
        localStorage.removeItem(USER_EMAIL_KEY);
      });
    } else {
      setCurrentUser(null);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(EXPIRY_STORAGE_KEY);
      localStorage.removeItem(USER_EMAIL_KEY);
    }
  }, []);

  const checkSession = useCallback(() => {
    if (!currentUser) return false;
    const storedExpiry = localStorage.getItem(EXPIRY_STORAGE_KEY);
    if (!storedExpiry) return false;

    // soft check: warn if within buffer? Or just expire?
    // User logic: "Force logout/refresh" if effectively expired.
    if (Date.now() >= parseInt(storedExpiry, 10) - TOKEN_BUFFER_MS) {
      console.warn("Session expired (soft check with buffer).");
      return false;
    }
    return true;
  }, [currentUser]);

  // Proactive Period Check
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => {
      checkSession();
    }, 60000);
    return () => clearInterval(interval);
  }, [currentUser, checkSession]);

  return {
    isReady: isGapiLoaded && isGisLoaded,
    initializeClient,
    login,
    logout,
    currentUser,
    error,
    isLoading,
    checkSession,
    ensureToken
  };
};
