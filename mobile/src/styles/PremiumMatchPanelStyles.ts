import { StyleSheet } from 'react-native';
import { Colors } from './theme';

export const makeStyles = (colors: Colors) => StyleSheet.create({
  premiumBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.28)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
  },
  premiumBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  scoreboard: {
    backgroundColor: colors.bgElevated, borderRadius: 18, padding: 18,
    borderWidth: 1, borderColor: colors.primary,
    shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scoreSide: { flex: 1, alignItems: 'center' },
  scoreTeamLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  scoreValue: { color: colors.text, fontSize: 56, fontWeight: '900', letterSpacing: -2, marginTop: 4 },
  scoreSeparator: { color: colors.textFaint, fontSize: 32, fontWeight: '900', paddingHorizontal: 8 },

  scoreBtnRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  scoreBtn: {
    flex: 1, backgroundColor: colors.primary, borderRadius: 12,
    paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  scoreBtnDisabled: { opacity: 0.4 },
  scoreBtnText: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },

  checkInBar: {
    backgroundColor: colors.bgElevated, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: colors.borderSubtle,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  checkInIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center',
  },
  checkInTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  checkInSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  checkInBtn: {
    backgroundColor: colors.primary, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  checkInBtnText: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  checkInDone: { backgroundColor: colors.successBg, borderColor: colors.success },
  checkInDoneText: { color: colors.success, fontSize: 12, fontWeight: '800' },

  pendingCard: {
    backgroundColor: colors.bgElevated, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: colors.warning,
  },
  pendingHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  pendingTitle: { color: colors.warning, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  pendingItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: colors.borderSubtle,
  },
  pendingItemFirst: { borderTopWidth: 0 },
  pendingDot: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center',
  },
  pendingText: { color: colors.text, fontSize: 13, fontWeight: '600', flex: 1 },
  pendingSubText: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  pendingConfirmBtn: {
    backgroundColor: colors.primary, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  pendingConfirmBtnDisabled: { opacity: 0.4 },
  pendingConfirmBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  pendingDismissBtn: { padding: 6 },

  teamsRow: { flexDirection: 'row', gap: 12 },
  teamCard: {
    flex: 1, backgroundColor: colors.bgElevated, borderRadius: 16, padding: 12,
    borderWidth: 1, borderColor: colors.borderSubtle,
  },
  teamHeader: { color: colors.primaryLight, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 },
  teamPlayer: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6,
  },
  teamPlayerAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center',
  },
  teamPlayerName: { color: colors.text, fontSize: 12, fontWeight: '600', flex: 1 },
  teamPlayerNoShow: { color: colors.danger, fontSize: 10, fontWeight: '800' },
  teamPlayerAttended: { color: colors.success, fontSize: 10, fontWeight: '800' },
  teamSwapBtn: { padding: 4 },

  finalizeBtn: {
    backgroundColor: colors.danger, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
  },
  finalizeBtnText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },

  resultCard: {
    backgroundColor: colors.bgElevated, borderRadius: 18, padding: 22,
    borderWidth: 1, borderColor: colors.primary, alignItems: 'center', gap: 8,
  },
  resultEyebrow: { color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },
  resultTitle: { color: colors.primaryLight, fontSize: 24, fontWeight: '900' },
  resultSub: { color: colors.text, fontSize: 14, fontWeight: '500', textAlign: 'center' },
});
