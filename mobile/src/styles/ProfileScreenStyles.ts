import { StyleSheet } from 'react-native';
import { Colors } from './theme';

export const makeStyles = (colors: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 40 },

  hero: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 30,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    shadowColor: colors.primary, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroLeftRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroIconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { color: '#fff', fontSize: 13, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },

  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 18 },
  avatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
  },
  name: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  email: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2, fontWeight: '500' },
  premiumChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.25)', alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginTop: 6,
  },
  premiumChipText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  body: { paddingHorizontal: 20, paddingTop: 22, gap: 18 },
  sectionLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 },

  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1, backgroundColor: colors.bgElevated, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: colors.borderSubtle,
  },
  statIconRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statIconBox: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center',
  },
  statLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  statValue: { color: colors.text, fontSize: 28, fontWeight: '900', marginTop: 10 },
  statSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },

  premiumCard: {
    backgroundColor: colors.bgElevated, borderRadius: 18, padding: 20,
    borderWidth: 1, borderColor: colors.primary,
  },
  premiumCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  premiumCardIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center',
  },
  premiumCardTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  premiumCardPrice: { color: colors.primaryLight, fontSize: 13, fontWeight: '700', marginTop: 2 },

  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  benefitText: { color: colors.text, fontSize: 14, fontWeight: '500', flex: 1 },

  buyBtn: {
    backgroundColor: colors.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
    marginTop: 16,
    shadowColor: colors.primary, shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  buyBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },

  featureItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.bgElevated, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: colors.borderSubtle,
  },
  featureIconBox: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center',
  },
  featureTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  featureSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },

  cancelLink: { alignSelf: 'center', marginTop: 6, padding: 10 },
  cancelLinkText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
});
