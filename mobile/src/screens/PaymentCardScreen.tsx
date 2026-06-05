import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  Alert, KeyboardAvoidingView, Platform, ScrollView, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { markPlayerPayment } from '../services/matchService';
import { markReservationPaid } from '../services/reservationService';
import { useColors } from '../context/PremiumContext';

type Params = {
  amount: number;
  entityType: 'match' | 'reservation';
  entityId: string;
  userId: string;
  description: string;
};

function formatCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length > 2) return digits.slice(0, 2) + '/' + digits.slice(2);
  return digits;
}

function detectCardType(number: string): 'visa' | 'mastercard' | 'other' {
  const d = number.replace(/\s/g, '');
  if (d.startsWith('4')) return 'visa';
  const prefix2 = parseInt(d.slice(0, 2));
  const prefix4 = parseInt(d.slice(0, 4));
  if ((prefix2 >= 51 && prefix2 <= 55) || (prefix4 >= 2221 && prefix4 <= 2720)) return 'mastercard';
  return 'other';
}

function isValidExpiry(expiry: string): boolean {
  const parts = expiry.split('/');
  if (parts.length !== 2) return false;
  const month = parseInt(parts[0]);
  const year = 2000 + parseInt(parts[1]);
  if (month < 1 || month > 12 || isNaN(year)) return false;
  const now = new Date();
  return year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1);
}

function fmt(n: number) { return n.toFixed(2).replace('.', ','); }

export default function PaymentCardScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { amount, entityType, entityId, userId, description } = route.params as Params;
  const colors = useColors();

  const [cardNumber, setCardNumber] = React.useState('');
  const [expiry, setExpiry] = React.useState('');
  const [cvc, setCvc] = React.useState('');
  const [name, setName] = React.useState('');
  const [processing, setProcessing] = React.useState(false);

  const cardType = detectCardType(cardNumber);
  const cardDigits = cardNumber.replace(/\s/g, '');
  const isFormValid = cardDigits.length === 16 && isValidExpiry(expiry) && cvc.length >= 3 && name.trim().length > 1;

  async function handlePay() {
    if (!isFormValid) {
      Alert.alert('Nepopolni podatki', 'Preveri vse vnose kartice.');
      return;
    }
    setProcessing(true);
    await new Promise(r => setTimeout(r, 1600));
    try {
      if (entityType === 'match') {
        await markPlayerPayment(entityId, userId, 'paid');
      } else {
        await markReservationPaid(entityId);
      }
      navigation.navigate('CostHistory');
    } catch {
      Alert.alert('Napaka', 'Plačilo ni uspelo. Poskusi znova.');
      setProcessing(false);
    }
  }

  const displayNumber = cardNumber.padEnd(19, '·').replace(/(\S{4})/g, '$1').trim();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      <SafeAreaView edges={['top']} style={{
        backgroundColor: colors.primary,
        paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity
            onPress={() => navigation.navigate('CostHistory')}
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
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900', marginTop: 2 }} numberOfLines={1}>
              {description}
            </Text>
          </View>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>{fmt(amount)} €</Text>
          </View>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 20 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{
            borderRadius: 20, padding: 24, minHeight: 170,
            backgroundColor: colors.primary,
            shadowColor: colors.primary, shadowOpacity: 0.45,
            shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 10,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{
                width: 42, height: 30, borderRadius: 5,
                backgroundColor: '#e8c84a',
                borderWidth: 1, borderColor: '#c9a830',
                overflow: 'hidden',
              }}>
                <View style={{ position: 'absolute', top: 10, left: 0, right: 0, height: 1, backgroundColor: '#c9a830' }} />
                <View style={{ position: 'absolute', top: 0, bottom: 0, left: 14, width: 1, backgroundColor: '#c9a830' }} />
              </View>

              {cardType === 'visa' && (
                <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', fontStyle: 'italic', letterSpacing: 1 }}>VISA</Text>
              )}
              {cardType === 'mastercard' && (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#eb001b' }} />
                  <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#f79e1b', marginLeft: -10, opacity: 0.9 }} />
                </View>
              )}
              {cardType === 'other' && (
                <Ionicons name="card-outline" size={26} color="rgba(255,255,255,0.4)" />
              )}
            </View>

            <Text style={{
              color: '#fff', fontSize: 19, fontWeight: '700',
              letterSpacing: 3, marginTop: 22,
              fontVariant: ['tabular-nums'],
            }}>
              {displayNumber}
            </Text>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 }}>
              <View>
                <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' }}>
                  Ime imetnika
                </Text>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 3, letterSpacing: 0.5 }}>
                  {name.toUpperCase() || '·····  ·····'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' }}>
                  Veljavnost
                </Text>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 3 }}>
                  {expiry || '··/··'}
                </Text>
              </View>
            </View>
          </View>

          <View style={{
            backgroundColor: colors.bgElevated, borderRadius: 16, padding: 16,
            borderWidth: 1, borderColor: colors.borderSubtle, gap: 14,
          }}>
            <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' }}>
              Podatki kartice
            </Text>

            <View>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 6 }}>Številka kartice</Text>
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: colors.bg, borderRadius: 12,
                borderWidth: 1, borderColor: colors.border,
                paddingHorizontal: 14, height: 52,
              }}>
                <TextInput
                  value={cardNumber}
                  onChangeText={t => setCardNumber(formatCardNumber(t))}
                  keyboardType="number-pad"
                  placeholder="0000 0000 0000 0000"
                  placeholderTextColor={colors.textFaint}
                  style={{ flex: 1, color: colors.text, fontSize: 17, fontWeight: '700', letterSpacing: 2 }}
                  maxLength={19}
                />
                <Ionicons name="card-outline" size={20} color={colors.textFaint} />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 6 }}>Veljavnost</Text>
                <View style={{
                  backgroundColor: colors.bg, borderRadius: 12,
                  borderWidth: 1, borderColor: colors.border,
                  paddingHorizontal: 14, height: 52, justifyContent: 'center',
                }}>
                  <TextInput
                    value={expiry}
                    onChangeText={t => setExpiry(formatExpiry(t))}
                    keyboardType="number-pad"
                    placeholder="MM/LL"
                    placeholderTextColor={colors.textFaint}
                    style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}
                    maxLength={5}
                  />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 6 }}>CVC / CVV</Text>
                <View style={{
                  backgroundColor: colors.bg, borderRadius: 12,
                  borderWidth: 1, borderColor: colors.border,
                  paddingHorizontal: 14, height: 52, justifyContent: 'center',
                }}>
                  <TextInput
                    value={cvc}
                    onChangeText={t => setCvc(t.replace(/\D/g, '').slice(0, 4))}
                    keyboardType="number-pad"
                    placeholder="···"
                    placeholderTextColor={colors.textFaint}
                    secureTextEntry
                    style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}
                    maxLength={4}
                  />
                </View>
              </View>
            </View>

            <View>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 6 }}>Ime imetnika kartice</Text>
              <View style={{
                backgroundColor: colors.bg, borderRadius: 12,
                borderWidth: 1, borderColor: colors.border,
                paddingHorizontal: 14, height: 52, justifyContent: 'center',
              }}>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="IME PRIIMEK"
                  placeholderTextColor={colors.textFaint}
                  autoCapitalize="characters"
                  style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}
                />
              </View>
            </View>
          </View>

          <TouchableOpacity
            onPress={handlePay}
            disabled={!isFormValid || processing}
            activeOpacity={0.85}
            style={{
              backgroundColor: isFormValid ? colors.primary : colors.borderSubtle,
              borderRadius: 16, height: 60,
              alignItems: 'center', justifyContent: 'center',
              flexDirection: 'row', gap: 10,
              shadowColor: colors.primary,
              shadowOpacity: isFormValid ? 0.45 : 0,
              shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: isFormValid ? 8 : 0,
            }}
          >
            {processing ? (
              <>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>Obdelujem plačilo…</Text>
              </>
            ) : (
              <>
                <Ionicons name="lock-closed" size={18} color={isFormValid ? '#fff' : colors.textFaint} />
                <Text style={{
                  color: isFormValid ? '#fff' : colors.textFaint,
                  fontSize: 16, fontWeight: '900',
                }}>
                  Plačaj {fmt(amount)} €
                </Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Ionicons name="shield-checkmark-outline" size={14} color={colors.textFaint} />
            <Text style={{ color: colors.textFaint, fontSize: 11 }}>
              Plačilo je šifrirano in varno
            </Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
