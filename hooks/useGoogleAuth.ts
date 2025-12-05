
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
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.profile';
const TOKEN_STORAGE_KEY = 'jantzcard_google_token';
const EXPIRY_STORAGE_KEY = 'jantzcard_token_expiry';

export const useGoogleAuth = () => {
  const [isGapiLoaded, setIsGapiLoaded] = useState(false);
  const [isGisLoaded, setIsGisLoaded] = useState(false);

  const tokenClientRef = useRef<any>(null);

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
      // CRITICAL CHANGE: Surface this error so the user knows why Sheets won't work.
      // This is often due to API Key restrictions (Referrer).
      const msg = gapiErr?.result?.error?.message || gapiErr?.message || JSON.stringify(gapiErr);
      setError(`Google Sheets API failed to load: ${msg}`);
      // We do NOT return here, because we still want to try loading the Auth/Identity client
      // so the user can at least sign in (even if they can't fetch sheets yet).
    }

    // 2. Initialize Identity Services Token Client (The "Auth" Layer)
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: async (tokenResponse: any) => {
          if (tokenResponse && tokenResponse.access_token) {
            // Verify we got the scopes we asked for
            // Note: google.accounts.oauth2.hasGrantedAllScopes is the standard way, 
            // but we can also check tokenResponse.scope (space-separated string)
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
          }
        },
      });

      tokenClientRef.current = client;

      // 3. Attempt to restore session from localStorage
      const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      const storedExpiry = localStorage.getItem(EXPIRY_STORAGE_KEY);
      let restored = false;

      if (storedToken && storedExpiry) {
        if (Date.now() < parseInt(storedExpiry, 10)) {
          window.gapi.client.setToken({ access_token: storedToken });
          try {
            // Validate token by fetching profile
            await fetchUserProfile(storedToken);
            restored = true;
          } catch (e) {
            // Token invalid or network error, clear storage
            console.warn("Failed to restore session", e);
            localStorage.removeItem(TOKEN_STORAGE_KEY);
            localStorage.removeItem(EXPIRY_STORAGE_KEY);
          }
        } else {
          // Expired
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
      setCurrentUser({
        name: userInfo.name,
        picture: userInfo.picture,
      });
      setError(null);
    } catch (err) {
      console.error('Failed to fetch user info', err);
      setError('Authenticated, but failed to fetch user profile.');
      throw err;
    }
  };

  const login = useCallback(() => {
    if (tokenClientRef.current) {
      tokenClientRef.current.requestAccessToken({ prompt: 'consent' });
    } else {
      setError('Client not initialized. Please enter API credentials.');
    }
  }, []);

  const logout = useCallback(() => {
    const token = window.gapi?.client?.getToken();
    if (token !== null && window.google) {
      window.google.accounts.oauth2.revoke(token.access_token, () => {
        if (window.gapi.client) window.gapi.client.setToken(null);
        setCurrentUser(null);
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(EXPIRY_STORAGE_KEY);
      });
    } else {
      setCurrentUser(null);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(EXPIRY_STORAGE_KEY);
    }
  }, []);

  return {
    isReady: isGapiLoaded && isGisLoaded,
    initializeClient,
    login,
    logout,
    currentUser,
    error,
    isLoading
  };
};
