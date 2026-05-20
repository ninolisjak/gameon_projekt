import { StyleSheet } from 'react-native';
import { Colors } from './theme';

export const makeStyles = (colors: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  // Map fills the entire screen
  map: { ...StyleSheet.absoluteFillObject },

  // Navbar floats on top — map shows through the rounded corners
  bannerWrap: {
    position: 'absolute', top: 0, left: 0, right: 0,
    zIndex: 10,
  },
  banner: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 18,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  bannerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandLogoBox: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  brandText: { color: '#fff', fontWeight: '900', fontSize: 22, letterSpacing: -0.3 },
  bannerRightRow: { flexDirection: 'row', gap: 10 },
  bannerIconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  searchPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
    marginTop: 12, gap: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '500', padding: 0 },

  radiusRow: { marginTop: 10 },
  radiusScroll: { gap: 6 },
  radiusPill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  radiusPillActive: { backgroundColor: '#fff', borderColor: '#fff' },
  radiusPillText: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '700' },
  radiusPillTextActive: { color: colors.primary },
  radiusCount: {
    color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '600',
    alignSelf: 'center', marginLeft: 4,
  },

  // Locate button — floats over map
  locationBtn: {
    position: 'absolute', right: 16, bottom: 100,
    backgroundColor: colors.bgElevated, borderRadius: 22,
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.borderSubtle,
    elevation: 4, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    zIndex: 5,
  },

  // Match card — floats above bottom nav
  card: {
    position: 'absolute', left: 12, right: 12, bottom: 86,
    backgroundColor: colors.bgElevated, borderRadius: 20,
    paddingBottom: 14, paddingTop: 6,
    borderWidth: 1, borderColor: colors.borderSubtle,
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 12,
    zIndex: 5,
  },
  cardHandle: {
    width: 40, height: 4, backgroundColor: colors.border,
    borderRadius: 2, alignSelf: 'center', marginTop: 8, marginBottom: 12,
  },
  cardCloseBtn: {
    position: 'absolute', top: 10, right: 10,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.borderSubtle, zIndex: 5,
  },
  cardContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 4 },
  cardIconBox: {
    width: 56, height: 56, borderRadius: 14,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 14,
    shadowColor: colors.primary, shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  cardInfo: { flex: 1 },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '800', letterSpacing: 0.2 },
  cardVs: { color: colors.primaryLight, fontWeight: '700' },
  cardLocation: { color: colors.textMuted, fontSize: 12, flexShrink: 1 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6, flexWrap: 'wrap' },
  cardMetaText: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },
  openBadge: {
    backgroundColor: colors.successBg, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3, marginLeft: 4,
  },
  openBadgeText: { color: colors.success, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  fullBadge: {
    backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3, marginLeft: 4,
  },
  fullBadgeText: { color: colors.danger, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  cardArrow: { padding: 10, backgroundColor: colors.primaryTint, borderRadius: 12 },

  // Bottom nav floats at the bottom
  bottomNav: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgElevated,
    paddingTop: 8, paddingBottom: 12, paddingHorizontal: 24,
    borderTopWidth: 1, borderTopColor: colors.borderSubtle,
    zIndex: 10,
  },
  navItem: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 6 },
  navIconWrap: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  navLabel: { color: colors.textFaint, fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
  navLabelActive: { color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  fabWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fabBtn: {
    width: 52, height: 52, borderRadius: 18,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primary, shadowOpacity: 0.55, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
});
