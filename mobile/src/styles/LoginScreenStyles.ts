import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1, justifyContent: 'center',
    backgroundColor: '#0a0e1a', padding: 28,
  },
  logoRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 12, marginBottom: 8,
  },
  logoBox: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: '#3b82f6',
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    fontSize: 36, fontWeight: '900', color: '#fff', letterSpacing: -0.5,
  },
  subtitle: {
    color: '#8896aa', fontSize: 15, textAlign: 'center', marginBottom: 36,
  },
  form: { gap: 12 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#131929', borderRadius: 14,
    borderWidth: 1, borderColor: '#1e2a45',
    paddingHorizontal: 14, height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1, color: '#fff', fontSize: 15,
  },
  eyeBtn: { padding: 4 },
  error: {
    color: '#ef4444', fontSize: 13,
    textAlign: 'center', marginTop: 4,
  },
  button: {
    backgroundColor: '#3b82f6', borderRadius: 14,
    height: 52, alignItems: 'center', justifyContent: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  switchRow: { alignItems: 'center', marginTop: 8, paddingVertical: 8 },
  switchText: { color: '#8896aa', fontSize: 14 },
  switchLink: { color: '#60a5fa', fontWeight: '700' },
});
