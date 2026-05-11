import { StyleSheet } from 'react-native';
export const headerStyles = StyleSheet.create({
  wrapper: { backgroundColor: '#0a0e1a' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#0a0e1a',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBox: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: '#f5c518', alignItems: 'center', justifyContent: 'center',
  },
  logoTextTop: { color: '#f5c518', fontWeight: '900', fontSize: 13, lineHeight: 14 },
  logoTextBottom: { color: '#ffffff', fontWeight: '900', fontSize: 13, lineHeight: 14 },
  headerRight: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#131929', alignItems: 'center', justifyContent: 'center',
  },
});

export const drawerStyles = StyleSheet.create({
  drawerHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 20, borderBottomWidth: 1, borderBottomColor: '#1e2a45', marginBottom: 8,
  },
  logoBox: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: '#f5c518', alignItems: 'center', justifyContent: 'center',
  },
  logoTextTop: { color: '#f5c518', fontWeight: '900', fontSize: 15, lineHeight: 16 },
  logoTextBottom: { color: '#ffffff', fontWeight: '900', fontSize: 15, lineHeight: 16 },
});