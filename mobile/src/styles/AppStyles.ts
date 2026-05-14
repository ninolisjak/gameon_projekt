import { StyleSheet } from 'react-native';
import { colors } from './theme';

export const drawerStyles = StyleSheet.create({
  drawerHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 20, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle, marginBottom: 8,
  },
  logoBox: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  logoTextTop: { color: colors.primary, fontWeight: '900', fontSize: 15, lineHeight: 16, letterSpacing: 0.5 },
  logoTextBottom: { color: colors.text, fontWeight: '900', fontSize: 15, lineHeight: 16, letterSpacing: 0.5 },
});
