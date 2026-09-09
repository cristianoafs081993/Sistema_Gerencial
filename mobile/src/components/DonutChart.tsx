import React from 'react';
import Svg, { Circle, G } from 'react-native-svg';

interface DonutChartProps {
  percentage?: number; // e.g. 69.4
  size?: number;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  percentage = 69.4,
  size = 45,
}) => {
  const radius = 20;
  const circumference = 2 * Math.PI * radius; // ~125.66
  const strokeDash = (circumference * percentage) / 100;

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      style={{ transform: [{ rotate: '-90deg' }] }}
    >
      <G>
        {/* Background circle track */}
        <Circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.18)"
          strokeWidth={4}
        />
        {/* Filled progress arc */}
        <Circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          stroke="#9abaff"
          strokeWidth={4}
          strokeDasharray={`${strokeDash} ${circumference}`}
          strokeLinecap="round"
        />
      </G>
    </Svg>
  );
};
