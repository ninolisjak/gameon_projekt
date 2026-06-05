import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../config/firebase';
import {
  subscribeMatch, resolveUserNames, setMatchRentalCost, markPlayerPayment, Match,
} from '../services/matchService';
import { useColors } from '../context/PremiumContext';

function fmt(n: number) {
  return n.toFixed(2).replace('.', ',');
}

export default function CostSplitScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { matchId } = route.params as { matchId: string };
  const colors = useColors();
  const userId = auth.currentUser?.uid ?? '';

  const [match, setMatch] = React.useState<Match | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [userNames, setUserNames] = React.useState<Map<string, string>>(new Map());
  const [costInput, setCostInput] = React.useState('');
  const [savingCost, setSavingCost] = React.useState(false);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);
  const [editingCost, setEditingCost] = React.useState(false);

  React.useEffect(() => {
    const unsub = subscribeMatch(matchId, m => { if (m) setMatch(m); setLoading(false); });
    return unsub;
  }, [matchId]);

  React.useEffect(() => {
    if (!match) return;
    const uids = match.players ?? [];
    if (uids.length === 0) return;
    resolveUserNames(uids).then(setUserNames);
  }, [match?.players?.join(',')]);

  React.useEffect(() => {
    if (match?.rentalCost !== undefined && !editingCost) {
      setCostInput(String(match.rentalCost));
    }
  }, [match?.rentalCost, editingCost]);

  const isCreator = match?.createdBy === userId;
  const players = match?.players ?? [];
  const perPerson = match?.rentalCost && players.length > 0
    ? match.rentalCost / players.length
    : 0;
  const paidCount = match?.costSplit
    ? Object.values(match.costSplit).filter(s => s === 'paid').length
    : 0;
  const totalOwed = match?.rentalCost ?? 0;

  async function handleSaveCost() {
    const cost = parseFloat(costInput.replace(',', '.'));
    if (isNaN(cost) || cost <= 0) {
      Alert.alert('Napaka', 'Vnesi veljaven znesek (npr. 30).');
      return;
    }
    setSavingCost(true);
    try {
      await setMatchRentalCost(matchId, cost, userId);
      setEditingCost(false);
    } catch (e: any) {
      Alert.alert('Napaka', e?.message ?? 'Shranjevanje ni uspelo.');
    } finally {
      setSavingCost(false);
    }
  }

  async function handleTogglePayment(uid: string) {
    if (!isCreator) return;
    const current = match?.costSplit?.[uid] ?? 'unpaid';
    setTogglingId(uid);
    try {
      await markPlayerPayment(matchId, uid, current === 'paid' ? 'unpaid' : 'paid');
    } catch (e: any) {
      Alert.alert('Napaka', e?.message ?? 'Posodobitev ni uspela.');
    } finally {
      setTogglingId(null);
    }
  }

  if (loading || !match) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const hasCost = match.rentalCost !== undefined && match.rentalCost > 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      <SafeAreaView edges={['top']} style={{
        backgroundColor: colors.primary,
        paddingHorizontal: 20, paddingTop: 16, paddingBottom: 22,
        borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
        shadowColor: colors.primary, shadowOpacity: 0.4, shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 }, elevation: 8,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' }}>
              Delitev stroška
            </Text>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900', marginTop: 2 }} numberOfLines={1}>
              {match.location?.name ?? 'Tekma'}
            </Text>
          </View>
        </View>

        {hasCost && (
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 18 }}>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: 12, alignItems: 'center' }}>
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>Skupaj</Text>
              <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 4 }}>{fmt(totalOwed)} €</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: 12, alignItems: 'center' }}>
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>Na osebo</Text>
              <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 4 }}>{fmt(perPerson)} €</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: 12, alignItems: 'center' }}>
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>Plačalo</Text>
              <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 4 }}>{paidCount}/{players.length}</Text>
            </View>
          </View>
        )}
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} showsVerticalScrollIndicator={false}>

        {/* Cost input card — creator only */}
        {isCreator && (
          <View style={{
            backgroundColor: colors.bgElevated, borderRadius: 16, padding: 16,
            borderWidth: 1, borderColor: hasCost && !editingCost ? colors.borderSubtle : colors.primary,
          }}>
            <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 }}>
              {hasCost && !editingCost ? 'Strošek najema' : 'Nastavi strošek najema'}
            </Text>

            {hasCost && !editingCost ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.text, fontSize: 28, fontWeight: '900' }}>{fmt(match.rentalCost!)} €</Text>
                <TouchableOpacity
                  onPress={() => { setEditingCost(true); setCostInput(String(match.rentalCost)); }}
                  style={{ backgroundColor: colors.primaryTint, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}
                >
                  <Text style={{ color: colors.primaryLight, fontSize: 12, fontWeight: '800' }}>UREDI</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <View style={{
                  flex: 1, flexDirection: 'row', alignItems: 'center',
                  backgroundColor: colors.bg, borderRadius: 12, borderWidth: 1,
                  borderColor: colors.border, paddingHorizontal: 14, height: 48,
                }}>
                  <Text style={{ color: colors.textMuted, fontSize: 16, marginRight: 6 }}>€</Text>
                  <TextInput
                    value={costInput}
                    onChangeText={setCostInput}
                    keyboardType="decimal-pad"
                    placeholder="0,00"
                    placeholderTextColor={colors.textFaint}
                    style={{ flex: 1, color: colors.text, fontSize: 18, fontWeight: '700' }}
                  />
                </View>
                <TouchableOpacity
                  onPress={handleSaveCost}
                  disabled={savingCost}
                  style={{
                    backgroundColor: colors.primary, borderRadius: 12,
                    paddingHorizontal: 16, height: 48, alignItems: 'center', justifyContent: 'center',
                    opacity: savingCost ? 0.6 : 1,
                  }}
                >
                  {savingCost
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>SHRANI</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Player list */}
        {hasCost ? (
          <View style={{ backgroundColor: colors.bgElevated, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.borderSubtle }}>
            <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>
              Evidenca plačil
            </Text>
            <Text style={{ color: colors.textFaint, fontSize: 12, marginBottom: 14 }}>
              {isCreator ? 'Pritisni na vrstico za označitev plačila.' : 'Pregled stanja plačil.'}
            </Text>

            {players.map((uid, idx) => {
              const isPaid = match.costSplit?.[uid] === 'paid';
              const isMe = uid === userId;
              const name = isMe ? 'Ti' : (userNames.get(uid) ?? (uid.length <= 10 ? uid : uid.slice(0, 8)));
              const isToggling = togglingId === uid;

              return (
                <TouchableOpacity
                  key={uid}
                  onPress={() => handleTogglePayment(uid)}
                  disabled={!isCreator || isToggling}
                  activeOpacity={isCreator ? 0.7 : 1}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    paddingVertical: 12,
                    borderTopWidth: idx === 0 ? 0 : 1,
                    borderTopColor: colors.borderSubtle,
                  }}
                >
                  <View style={{
                    width: 38, height: 38, borderRadius: 19,
                    backgroundColor: isPaid ? '#22c55e20' : colors.bg,
                    borderWidth: 1, borderColor: isPaid ? '#22c55e50' : colors.border,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {isToggling
                      ? <ActivityIndicator size="small" color={colors.primary} />
                      : <Ionicons name={isPaid ? 'checkmark' : 'person'} size={16} color={isPaid ? '#22c55e' : colors.textMuted} />}
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>{name}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 1 }}>
                      {fmt(perPerson)} €
                    </Text>
                  </View>

                  <View style={{
                    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8,
                    backgroundColor: isPaid ? '#22c55e20' : '#ef444415',
                    borderWidth: 1, borderColor: isPaid ? '#22c55e40' : '#ef444430',
                  }}>
                    <Text style={{ color: isPaid ? '#22c55e' : '#ef4444', fontSize: 11, fontWeight: '800', letterSpacing: 0.3 }}>
                      {isPaid ? 'PLAČANO' : 'NEPLAČANO'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Summary footer */}
            <View style={{
              marginTop: 12, paddingTop: 12,
              borderTopWidth: 1, borderTopColor: colors.borderSubtle,
              flexDirection: 'row', justifyContent: 'space-between',
            }}>
              <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600' }}>
                Zbrano: {fmt(paidCount * perPerson)} € / {fmt(totalOwed)} €
              </Text>
              <Text style={{ color: paidCount === players.length ? '#22c55e' : colors.warning, fontSize: 12, fontWeight: '800' }}>
                {paidCount === players.length ? 'VSE PORAVNANO ✓' : `Manjka ${fmt((players.length - paidCount) * perPerson)} €`}
              </Text>
            </View>
          </View>
        ) : !isCreator ? (
          <View style={{ padding: 24, alignItems: 'center', gap: 8 }}>
            <Ionicons name="receipt-outline" size={36} color={colors.textFaint} />
            <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: 'center' }}>
              Gostitelj še ni nastavil stroška najema igrišča.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
