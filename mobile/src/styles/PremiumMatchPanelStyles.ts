import { StyleSheet } from 'react-native';
import { Colors } from './theme';

export const makeStyles = (colors: Colors) => StyleSheet.create({
  premiumBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.28)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
  },
  premiumBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  scoreSeparator: { color: colors.textFaint, fontSize: 32, fontWeight: '900', paddingHorizontal: 8 },

  // Vnos končnega rezultata (kapetana oz. vsi igralci ob neujemanju)
  scorePanel: {
    backgroundColor: colors.bgElevated, borderRadius: 18, padding: 18, gap: 12,
    borderWidth: 1, borderColor: colors.primary,
    shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  scorePanelDisputed: { borderColor: colors.warning, shadowColor: colors.warning },
  scorePanelHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scorePanelTitle: {
    color: colors.primaryLight, fontSize: 11, fontWeight: '800',
    letterSpacing: 1.2, textTransform: 'uppercase', flex: 1,
  },
  scorePanelSub: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  scorePanelWaiting: { color: colors.textMuted, fontSize: 13, fontStyle: 'italic', textAlign: 'center', paddingVertical: 6 },
  scorePanelProgress: {
    color: colors.textFaint, fontSize: 11, fontWeight: '700',
    letterSpacing: 0.5, textAlign: 'center',
  },

  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepperCol: { flex: 1, alignItems: 'center', gap: 8 },
  stepperTeamLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  stepperControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepperBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stepperValue: { color: colors.text, fontSize: 34, fontWeight: '900', letterSpacing: -1, minWidth: 44, textAlign: 'center' },

  submitScoreBtn: {
    backgroundColor: colors.primary, borderRadius: 12,
    paddingVertical: 13, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
  },
  submitScoreBtnText: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },

  submittedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 10, borderRadius: 10,
    backgroundColor: colors.successBg, borderWidth: 1, borderColor: colors.success,
  },
  submittedText: { color: colors.success, fontSize: 13, fontWeight: '700' },

  statusCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.bgElevated, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: colors.borderSubtle,
  },
  statusText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },

  captainBadge: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  captainBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },

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

  pendingSubText: { color: colors.textMuted, fontSize: 11, marginTop: 2 },

  teamsRow: { flexDirection: 'row', gap: 12 },
  teamCard: {
    flex: 1, backgroundColor: colors.bgElevated, borderRadius: 16, padding: 12,
    borderWidth: 1, borderColor: colors.borderSubtle,
  },
  teamHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  teamHeader: { color: colors.primaryLight, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  teamInviteBtn: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  teamInviteBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
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

  invitePanel: {
    backgroundColor: colors.bgElevated, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: colors.borderSubtle,
  },
  invitePanelTitle: {
    color: colors.primaryLight, fontSize: 11, fontWeight: '800',
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10,
  },
  inviteEmpty: { color: colors.textMuted, fontSize: 13, fontStyle: 'italic', textAlign: 'center', paddingVertical: 8 },
  invitePlayerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7,
    borderTopWidth: 1, borderTopColor: colors.borderSubtle,
  },
  invitePlayerAvatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center',
  },
  invitePlayerName: { color: colors.text, fontSize: 13, fontWeight: '600' },
  invitePlayerStats: { color: colors.textMuted, fontSize: 11, marginTop: 1 },
  inviteBtn: {
    backgroundColor: colors.primary, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6, minWidth: 66, alignItems: 'center',
  },
  inviteBtnText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },

  resultCard: {
    backgroundColor: colors.bgElevated, borderRadius: 18, padding: 22,
    borderWidth: 1, borderColor: colors.primary, alignItems: 'center', gap: 8,
  },
  resultEyebrow: { color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },
  resultTitle: { color: colors.primaryLight, fontSize: 24, fontWeight: '900' },
  resultSub: { color: colors.text, fontSize: 14, fontWeight: '500', textAlign: 'center' },
});
