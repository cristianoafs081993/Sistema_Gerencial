/**
 * Design system "Céu" (mesmos tokens do web — ver docs/design-system/TOKENS.md):
 * azul-céu como ação, superfícies brancas com leve tom azulado e ciano como realce.
 * Os nomes das chaves foram mantidos; só os valores mudaram.
 */
export const colors = {
  blue: '#1976D2',
  blueLight: '#B3D5F7',
  blueBg: '#EAF3FD',
  blueNavActive: '#EAF3FD',
  blueTextSubtle: '#D6E8FB',
  blueDonutFilled: '#8ABDF1',
  navy: '#0B2945',
  sky: '#1E88E5',
  cyan: '#00B7DC',
  gradientBalance: ['#1976D2', '#1E88E5'] as const,
  ink: '#1B2B3A',
  inkLight: '#3A4B5C',
  muted: '#5B6B7B',
  mutedLight: '#7C8DA6',
  mutedExtraLight: '#C2CEDC',
  mutedText: '#6B7C8F',
  line: '#E6EDF5',
  lineInput: '#DDE6F0',
  lineChip: '#DDE6F0',
  bg: '#F6F9FD',
  white: '#FFFFFF',
  green: '#1F7A4D',
  greenBg: '#E8F5EF',
  greenText: '#1F7A4D',
  greenProgress: '#2E9E6A',
  tealBg: '#E6F6FA',
  tealText: '#0B7C96',
  amber: '#9A5C00',
  amberBg: '#FFF8EA',
  amberBadgeBg: '#FFF2D9',
  amberBorder: '#F4E5C5',
  amberText: '#8A5200',
  amberSubtitle: '#8A7350',
  amberProgress: '#F2A93B',
  danger: '#D03434',
  dangerBg: '#FDECEC',
  progressBg: '#EEF3F9',
  tagBg: '#EEF3F9',
  tagText: '#4F6580',
  navInactive: '#6B7C8F',
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
};

export const typography = {
  titleLarge: {
    fontSize: 27,
    fontWeight: '800' as const,
    letterSpacing: -1,
    color: colors.ink,
  },
  titleSection: {
    fontSize: 16,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
    color: colors.ink,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
    color: colors.ink,
  },
  body: {
    fontSize: 14,
    color: colors.muted,
  },
  caption: {
    fontSize: 12,
    color: colors.muted,
  },
};
