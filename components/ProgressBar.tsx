import React, { useMemo } from 'react';

interface ProgressBarProps {
    current: number;
    total: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ current, total }) => {
    const percentage = useMemo(() => {
        if (total <= 0) return 100;
        const progress = Math.min(Math.max(current / total, 0), 1);
        return progress * 100;
    }, [current, total]);

    const color = useMemo(() => {
        // Distribute colors evenly across the progress:
        // 0-33%: Red (0) -> Orange (30)
        // 33-66%: Orange (30) -> Yellow (60)
        // 66-100%: Yellow (60) -> Green (120)

        let hue;
        const p = percentage / 100;

        if (p < 0.333) {
            // First third: Red to Orange
            // Normalized position (0-1) * 30 range
            hue = (p * 3) * 30;
        } else if (p < 0.666) {
            // Second third: Orange to Yellow
            hue = 30 + ((p - 0.333) * 3) * 30;
        } else {
            // Final third: Yellow to Green
            // Note: This range covers 60 degrees (60->120) whereas previous ones covered 30
            // This speed-up is necessary to reach Green by 100% while keeping the "milestones" evenly spaced
            hue = 60 + ((p - 0.666) * 3) * 60;
        }

        // Saturation 100%, Lightness 50% for standard vibrant colors
        return `hsl(${hue}, 100%, 50%)`;
    }, [percentage]);

    return (
        <div className="w-full h-1.5 bg-gray-700/50 backdrop-blur-sm relative overflow-hidden">
            <div
                className="h-full transition-all duration-500 ease-out"
                style={{
                    width: `${percentage}%`,
                    backgroundColor: color,
                    boxShadow: `0 0 10px ${color}`
                }}
            />
        </div>
    );
};

export default ProgressBar;
