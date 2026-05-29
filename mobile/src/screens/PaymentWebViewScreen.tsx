import React from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'react-native';
import { createStripeCheckoutSession, markPlayerPayment } from '../services/matchService';
import { markReservationPaid } from '../services/reservationService';
import { useColors } from '../context/PremiumContext';

type Params = {
  amount: number;
  entityType: 'match' | 'reservation';
  entityId: string;
  userId: string;
  description: string;
};

const SUCCESS_PREFIX = 'https://gameon-app.invalid/payment-success';
const CANCEL_PREFIX  = 'https://gameon-app.invalid/payment-cancel';

function fmt(n: number) { return n.toFixed(2).replace('.', ','); }

export default function PaymentWebViewScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { amount, entityType, entityId, userId, description } = route.params as Params;
  const colors = useColors();

  const [checkoutUrl, setCheckoutUrl] = React.useState<string | null>(null);
  const [loadingSession, setLoadingSession] = React.useState(true);
  const [confirming, setConfirming] = React.useState(false);

  React.useEffect(() => {
    createStripeCheckoutSession(amount, entityType, entityId, userId, description)
      .then(url => { setCheckoutUrl(url); setLoadingSession(false); })
      .catch(() => {
        Alert.alert('Napaka', 'Plačilne seje ni mogoče ustvariti. Preveri internetno povezavo.');
        navigation.goBack();
      });
  }, []);

  async function handleSuccess() {
    setConfirming(true);
    try {
      if (entityType === 'match') {
        await markPlayerPayment(entityId, userId, 'paid');
      } else {
        await markReservationPaid(entityId);
      }
      navigation.goBack();
    } catch {
      Alert.alert('Opozorilo', 'Plačilo je bilo uspešno, a stanja ni bilo mogoče posodobiti.');
      navigation.goBack();
    }
  }

  if (loadingSession || confirming) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.textMuted, fontSize: 14 }}>
          {confirming ? 'Potrjujem plačilo…' : 'Nalagam plačilni obrazec…'}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      <SafeAreaView edges={['top']} style={{
        backgroundColor: colors.primary,
        paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{
              width: 38, height: 38, borderRadius: 19,
              backgroundColor: 'rgba(255,255,255,0.18)',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' }}>
              Kartično plačilo
            </Text>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900', marginTop: 2 }} numberOfLines={1}>
              {description}
            </Text>
          </View>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>{fmt(amount)} €</Text>
          </View>
        </View>
      </SafeAreaView>

      <WebView
        source={{ uri: checkoutUrl! }}
        onShouldStartLoadWithRequest={req => {
          if (req.url.startsWith(SUCCESS_PREFIX)) {
            handleSuccess();
            return false;
          }
          if (req.url.startsWith(CANCEL_PREFIX)) {
            navigation.goBack();
            return false;
          }
          return true;
        }}
        startInLoadingState
        renderLoading={() => (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}
        style={{ flex: 1 }}
      />
    </View>
  );
}
