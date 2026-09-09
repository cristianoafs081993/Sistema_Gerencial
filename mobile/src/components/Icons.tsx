import React from 'react';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

export interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export const IconGrid: React.FC<IconProps> = ({ size = 22, color = 'currentColor', strokeWidth = 1.7 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Rect x="3" y="3" width="7" height="7" rx="2" />
    <Rect x="14" y="3" width="7" height="7" rx="2" />
    <Rect x="3" y="14" width="7" height="7" rx="2" />
    <Rect x="14" y="14" width="7" height="7" rx="2" />
  </Svg>
);

export const IconWallet: React.FC<IconProps> = ({ size = 22, color = 'currentColor', strokeWidth = 1.7 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20 8V5a2 2 0 0 0-2-2H6a3 3 0 0 0 0 6h14v11H6a3 3 0 0 1-3-3V6" />
    <Path d="M20 12h-5v5h5" />
    <Path d="M17 14.5h.01" />
  </Svg>
);

export const IconDoc: React.FC<IconProps> = ({ size = 22, color = 'currentColor', strokeWidth = 1.7 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M14 2H5a1 1 0 0 0-1 1v18a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8z" />
    <Path d="M14 2v6h6M8 12h8M8 16h6" />
  </Svg>
);

export const IconBuilding: React.FC<IconProps> = ({ size = 22, color = 'currentColor', strokeWidth = 1.7 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 21h18M5 21V7l7-4 7 4v14M9 10h1m4 0h1m-6 4h1m4 0h1m-5 7v-4h4v4" />
  </Svg>
);

export const IconCalendar: React.FC<IconProps> = ({ size = 22, color = 'currentColor', strokeWidth = 1.7 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Rect x="3" y="5" width="18" height="16" rx="3" />
    <Path d="M7 3v4m10-4v4M3 11h18m-14 5h3" />
  </Svg>
);

export const IconSearch: React.FC<IconProps> = ({ size = 22, color = 'currentColor', strokeWidth = 1.7 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="10.5" cy="10.5" r="6.5" />
    <Path d="m16 16 5 5" />
  </Svg>
);

export const IconRight: React.FC<IconProps> = ({ size = 22, color = 'currentColor', strokeWidth = 1.7 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Path d="m9 5 7 7-7 7" />
  </Svg>
);

export const IconClock: React.FC<IconProps> = ({ size = 22, color = 'currentColor', strokeWidth = 1.7 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="9" />
    <Path d="M12 7v5l3 2" />
  </Svg>
);

export const IconCheck: React.FC<IconProps> = ({ size = 22, color = 'currentColor', strokeWidth = 1.7 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="9" />
    <Path d="m8 12 3 3 5-6" />
  </Svg>
);

export const IconChart: React.FC<IconProps> = ({ size = 22, color = 'currentColor', strokeWidth = 1.7 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M4 19V5m0 14h17M8 15l4-4 4 2 5-7" />
  </Svg>
);

export const IconLayers: React.FC<IconProps> = ({ size = 22, color = 'currentColor', strokeWidth = 1.7 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Path d="m12 3 10 5-10 5L2 8zm-9 10 9 5 9-5M3 18l9 5 9-5" />
  </Svg>
);

export const IconShield: React.FC<IconProps> = ({ size = 22, color = 'currentColor', strokeWidth = 1.7 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6" />
  </Svg>
);

export const IconBell: React.FC<IconProps> = ({ size = 22, color = 'currentColor', strokeWidth = 1.7 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </Svg>
);
