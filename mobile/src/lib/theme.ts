import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export const colors = {
  primary: '#2F7D4A',
  primaryDark: '#205C37',
  mint: '#EAF5E9',
  bg: '#F8FAF5',
  card: '#FFFFFF',
  text: '#1F2933',
  muted: '#68756B',
  accent: '#F4B942',
  accentSoft: '#FDF3DC',
  accentText: '#8A5A00',
  border: '#E3EAE2',
  danger: '#B3261E',
  dangerSoft: '#FCEBEA',
  ripe: '#B45309',
  ripeSoft: '#FDEFD9',
  unripe: '#2F7D4A',
  unripeSoft: '#EAF5E9',
  overlay: 'rgba(16, 24, 18, 0.55)',
};

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };

export const type = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: '800', color: colors.text },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '700', color: colors.text },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '600', color: colors.text },
  body: { fontSize: 15, lineHeight: 22, color: colors.text },
  muted: { fontSize: 14, lineHeight: 20, color: colors.muted },
  caption: { fontSize: 12, lineHeight: 16, color: colors.muted },
  overline: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.muted,
  },
} satisfies Record<string, TextStyle>;

export const shadow: ViewStyle = Platform.select({
  ios: { shadowColor: '#1F2933', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  default: { elevation: 2 },
});
