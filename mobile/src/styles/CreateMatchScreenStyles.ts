import { StyleSheet } from 'react-native';
import { Colors } from './theme';

export const makeStyles = (colors: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 120 },

  hero: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 26,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    shadowColor: colors.primary, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12, fontWeight: '700', marginTop: 18, letterSpacing: 1.5, textTransform: 'uppercase',
  },
  heroTitle: { color: '#fff', fontSize: 30, fontWeight: '900', marginTop: 4, letterSpacing: -0.5 },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 6, fontWeight: '500' },

  body: { paddingHorizontal: 20, paddingTop: 22, gap: 18 },

  sectionLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 },

  card: {
    backgroundColor: colors.bgElevated, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: colors.borderSubtle,
  },

  sportRow: { flexDirection: 'row', gap: 10 },
  sportTile: {
    flex: 1, backgroundColor: colors.bg, borderRadius: 14,
    paddingVertical: 18, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.borderSubtle, gap: 6,
  },
  sportTileActive: {
    borderColor: colors.primary, backgroundColor: colors.primaryTint,
    shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  sportTileText: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  sportTileTextActive: { color: colors.primaryLight, fontSize: 14, fontWeight: '800' },

  input: {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.borderSubtle,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    color: colors.text, fontSize: 15,
  },
  inputWithIcon: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: 12, paddingHorizontal: 12 },
  inputIcon: { marginRight: 8 },
  inputFlex: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 12 },

  fieldLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 },
  fieldGroup: { marginBottom: 14 },

  grid2: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },

  spotsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  stepperBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.borderSubtle,
  },
  stepperBtnDisabled: { opacity: 0.4 },
  spotsValue: { color: colors.text, fontSize: 28, fontWeight: '900', minWidth: 60, textAlign: 'center' },
  spotsHint: { color: colors.textMuted, fontSize: 12, marginTop: 6, textAlign: 'center' },

  ctaBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: colors.bgElevated,
    borderTopWidth: 1, borderTopColor: colors.borderSubtle,
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 24,
  },
  submitBtn: {
    backgroundColor: colors.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
    shadowColor: colors.primary, shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
});
