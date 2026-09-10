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

export const IconReceipt: React.FC<IconProps> = ({ size = 20, color = 'currentColor', strokeWidth = 1.8 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
    <Path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
    <Path d="M12 17.5v-11" />
  </Svg>
);

export const IconLandmark: React.FC<IconProps> = ({ size = 20, color = 'currentColor', strokeWidth = 1.8 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 21h18M5 21V10l7-5 7 5v11M9 14v4M15 14v4" />
  </Svg>
);

export const IconSend: React.FC<IconProps> = ({ size = 20, color = 'currentColor', strokeWidth = 1.8 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Path d="m22 2-7 20-4-9-9-4Z" />
    <Path d="M22 2 11 13" />
  </Svg>
);

export const IconCheckCheck: React.FC<IconProps> = ({ size = 18, color = 'currentColor', strokeWidth = 2 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Path d="m18 6-7 7-3-3" />
    <Path d="m22 10-7 7-2-2" />
    <Path d="m2 13 3 3 4-4" />
  </Svg>
);

export const IconGavel: React.FC<IconProps> = ({ size = 22, color = 'currentColor', strokeWidth = 1.7 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Path d="m14 13-7.5 7.5c-.8.8-2 .8-2.8 0s-.8-2 0-2.8L11 10" />
    <Path d="m16 16 6-6" />
    <Path d="m8 8 6-6" />
    <Path d="m9 7 8 8" />
    <Path d="m21 11-8-8" />
  </Svg>
);

export const IconFilter: React.FC<IconProps> = ({ size = 20, color = 'currentColor', strokeWidth = 1.8 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
  </Svg>
);

export const IconChevronDown: React.FC<IconProps> = ({ size = 20, color = 'currentColor', strokeWidth = 2 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Path d="m6 9 6 6 6-6" />
  </Svg>
);

export const IconClose: React.FC<IconProps> = ({ size = 20, color = 'currentColor', strokeWidth = 2 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M18 6 6 18M6 6l12 12" />
  </Svg>
);


