import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: { padding: 24, backgroundColor: '#0a0e1a', flexGrow: 1 },
  label: { fontSize: 13, fontWeight: '600', color: '#8896aa', marginTop: 20, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: { borderWidth: 1, borderColor: '#2a3550', borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: '#131929', color: '#fff' },
  inputPlaceholder: { color: '#4a5568' },
  row: { flexDirection: 'row', gap: 12 },
  sportBtn: { flex: 1, borderWidth: 1, borderColor: '#2a3550', borderRadius: 10, padding: 14, alignItems: 'center', backgroundColor: '#131929' },
  sportBtnActive: { borderColor: '#f5c518', backgroundColor: '#1e2a10' },
  sportBtnText: { color: '#8896aa', fontSize: 15, fontWeight: '600' },
  sportBtnTextActive: { color: '#f5c518', fontWeight: '700', fontSize: 15 },
  button: { backgroundColor: '#f5c518', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 36 },
  buttonText: { color: '#0a0e1a', fontSize: 16, fontWeight: '800' },
});
