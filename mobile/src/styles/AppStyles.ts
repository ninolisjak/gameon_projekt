import { StyleSheet } from 'react-native';
import { Colors } from './theme';

export const makeDrawerStyles = (c: Colors) => StyleSheet.create({
  drawerHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 20, borderBottomWidth: 1, borderBottomColor: c.borderSubtle, marginBottom: 8,
  },
  logoBox: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center',
  },
  logoTextTop: { color: c.primary, fontWeight: '900', fontSize: 15, lineHeight: 16, letterSpacing: 0.5 },
  logoTextBottom: { color: c.text, fontWeight: '900', fontSize: 15, lineHeight: 16, letterSpacing: 0.5 },
});
