import { StyleSheet } from 'react-native';
import { Colors } from './theme';

export const makeStyles = (colors: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 120 },

  hero: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20, paddingTop: 28, paddingBottom: 28,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    shadowColor: colors.primary, shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 10,
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  statusPill: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  heroContent: { marginTop: 18 },
  sportEyebrow: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
  sportTitle: { color: '#fff', fontSize: 32, fontWeight: '900', marginTop: 4, letterSpacing: -0.5 },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 6 },
  locationText: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '500', flexShrink: 1 },

  body: { paddingHorizontal: 20, paddingTop: 24, gap: 18 },

  sectionLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 },

  infoGrid: { flexDirection: 'row', gap: 12 },
  infoCard: {
    flex: 1, backgroundColor: colors.bgElevated, borderRadius: 16,
    padding: 14, borderWidth: 1, borderColor: colors.borderSubtle,
  },
  infoIconRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoIconBox: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center',
  },
  infoLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  infoValue: { color: colors.text, fontSize: 17, fontWeight: '800', marginTop: 10 },
  infoSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },

  playersCard: {
    backgroundColor: colors.bgElevated, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: colors.borderSubtle,
  },
  playersHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  playersTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  playersCount: { color: colors.primaryLight, fontSize: 14, fontWeight: '700' },

  progressBar: { height: 8, backgroundColor: colors.bg, borderRadius: 4, overflow: 'hidden', marginBottom: 14 },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 4 },

  playerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 12 },
  playerAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.borderSubtle,
  },
  playerName: { color: colors.text, fontSize: 14, fontWeight: '600', flex: 1 },
  playerBadge: { backgroundColor: colors.primaryTint, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  playerBadgeText: { color: colors.primaryLight, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  emptySlot: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 12,
    opacity: 0.5,
  },
  emptyAvatar: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  emptyText: { color: colors.textFaint, fontSize: 14, fontWeight: '500', fontStyle: 'italic' },

  waitlistDivider: {
    marginTop: 16, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: colors.borderSubtle,
  },
  waitlistHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  waitlistTitle: { color: colors.warning, fontSize: 15, fontWeight: '800' },
  waitlistCount: { color: colors.warning, fontSize: 13, fontWeight: '700' },
  waitlistRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 12 },
  waitlistAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(245,158,11,0.12)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.35)',
  },
  waitlistPositionBadge: {
    backgroundColor: 'rgba(245,158,11,0.18)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  waitlistPositionText: { color: colors.warning, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  youBadge: {
    backgroundColor: colors.primaryTint,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  youBadgeText: { color: colors.primaryLight, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  waitlistBtn: {
    backgroundColor: colors.warning, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
    shadowColor: colors.warning, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  waitlistBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  waitlistLeaveBtn: {
    backgroundColor: 'rgba(245,158,11,0.12)', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: colors.warning,
  },
  waitlistLeaveBtnText: { color: colors.warning, fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },

  ctaBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: colors.bgElevated,
    borderTopWidth: 1, borderTopColor: colors.borderSubtle,
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 24,
  },
  joinBtn: {
    backgroundColor: colors.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
    shadowColor: colors.primary, shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  joinBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  leaveBtn: {
    backgroundColor: colors.dangerBg, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: colors.danger,
  },
  leaveBtnText: { color: colors.danger, fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  fullBtn: {
    backgroundColor: colors.bg, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  fullBtnText: { color: colors.textMuted, fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },

  userSwitcherCard: {
    backgroundColor: colors.bgElevated, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: colors.warning,
  },
  userSwitcherLabel: {
    color: colors.warning, fontSize: 11, fontWeight: '800',
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8,
  },
  userSwitcherRow: { flexDirection: 'row', gap: 8 },
  userPill: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: colors.bg,
    borderWidth: 1, borderColor: colors.borderSubtle,
    alignItems: 'center',
  },
  userPillActive: {
    backgroundColor: colors.primaryTint,
    borderColor: colors.primary,
  },
  userPillText: { color: colors.textMuted, fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
  userPillTextActive: { color: colors.primaryLight },
});
