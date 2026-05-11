import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: { padding: 24, backgroundColor: '#fff', flexGrow: 1 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginTop: 16, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    padding: 12, fontSize: 15, backgroundColor: '#fafafa',
  },
  row: { flexDirection: 'row', gap: 12 },
  sportBtn: {
    flex: 1, borderWidth: 1, borderColor: '#ddd',
    borderRadius: 8, padding: 12, alignItems: 'center',
  },
  sportBtnActive: { borderColor: '#1a73e8', backgroundColor: '#e8f0fe' },
  sportBtnText: { color: '#666', fontSize: 15 },
  sportBtnTextActive: { color: '#1a73e8', fontWeight: '700', fontSize: 15 },
  button: {
    backgroundColor: '#1a73e8', borderRadius: 8,
    padding: 16, alignItems: 'center', marginTop: 32,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});