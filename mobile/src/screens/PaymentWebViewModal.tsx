import React from 'react';
import { Modal, View, Text, TouchableOpacity, ActivityIndicator, Alert, StatusBar } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createStripeCheckoutSession, markPlayerPayment } from '../services/matchService';
import { markReservationPaid } from '../services/reservationService';
import { useColors } from '../context/PremiumContext';

type Props = {
  visible: boolean;
  amount: number;
  entityType: 'match' | 'reservation';
  entityId: string;
  userId: string;
  description: string;
  onClose: () => void;
  onSuccess: () => void;
};

const SUCCESS_PREFIX = 'https://gameon-app.invalid/payment-success';
const CANCEL_PREFIX  = 'https://gameon-app.invalid/payment-cancel';

function fmt(n: number) { return n.toFixed(2).replace('.', ','); }

export default function PaymentWebViewModal({ visible, amount, entityType, entityId, userId, description, onClose, onSuccess }: Props) {
  const colors = useColors();
  const [checkoutUrl, setCheckoutUrl] = React.useState<string | null>(null);
  const [loadingSession, setLoadingSession] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

  React.useEffect(() => {
    if (!visible) { setCheckoutUrl(null); setLoadingSession(false); setConfirming(false); return; }
    setLoadingSession(true);
    createStripeCheckoutSession(amount, entityType, entityId, userId, description)
      .then(url => { setCheckoutUrl(url); setLoadingSession(false); })
      .catch((e: any) => { Alert.alert('Napaka', String(e?.message ?? e)); onClose(); });
  }, [visible]);

  async function handleSuccess() {
    setConfirming(true);
    try {
      if (entityType === 'match') { await markPlayerPayment(entityId, userId, 'paid'); }
      else { await markReservationPaid(entityId); }
      onSuccess();
    } catch { Alert.alert('Opozorilo', 'Plačilo uspešno, posodobitev ni uspela.'); onSuccess(); }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
        <SafeAreaView edges={['top']} style={{ backgroundColor: colors.primary, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={onClose} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' }}>Kartično plačilo</Text>
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900', marginTop: 2 }} numberOfLines={1}>{description}</Text>
            </View>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>{fmt(amount)} €</Text>
            </View>
          </View>
        </SafeAreaView>
        {(loadingSession || confirming) ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: colors.textMuted, fontSize: 14 }}>{confirming ? 'Potrjujem plačilo…' : 'Nalagam plačilni obrazec…'}</Text>
          </View>
        ) : checkoutUrl ? (
          <WebView
            source={{ uri: checkoutUrl }}
            onShouldStartLoadWithRequest={req => {
              if (req.url.startsWith(SUCCESS_PREFIX)) { handleSuccess(); return false; }
              if (req.url.startsWith(CANCEL_PREFIX)) { onClose(); return false; }
              return true;
            }}
            onNavigationStateChange={nav => {
              if (nav.url.startsWith(SUCCESS_PREFIX)) handleSuccess();
              else if (nav.url.startsWith(CANCEL_PREFIX)) onClose();
            }}
            startInLoadingState
            renderLoading={() => (
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            )}
            style={{ flex: 1 }}
          />
        ) : null}
      </View>
    </Modal>
  );
}
