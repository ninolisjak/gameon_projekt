import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, StatusBar, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../config/firebase';
import { fetchUserCostHistory, Match } from '../services/matchService';
import { fetchMyReservations, Reservation } from '../services/reservationService';
import { useColors } from '../context/PremiumContext';
import PaymentCardModal from './PaymentCardModal';

function formatDate(ts: any): string {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('sl-SI', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
function fmt(n: number) { return n.toFixed(2).replace('.', ','); }

type MatchEntry = { kind: 'match'; data: Match; perPerson: number; status: 'paid' | 'unpaid'; date: number };
type ReservEntry = { kind: 'reservation'; data: Reservation; date: number };
type Entry = MatchEntry | ReservEntry;

type PaymentParams = {
  amount: number;
  entityType: 'match' | 'reservation';
  entityId: string;
  userId: string;
  description: string;
};

export default function UserCostHistoryScreen() {
  const navigation = useNavigation<any>();
  const colors = useColors();
  const userId = auth.currentUser?.uid ?? '';

  const [entries, setEntries] = React.useState<Entry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [paymentParams, setPaymentParams] = React.useState<PaymentParams | null>(null);

  async function load(silent = false) {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const [matches, reservations] = await Promise.all([
        fetchUserCostHistory(userId),
        fetchMyReservations(userId),
      ]);

      const matchEntries: MatchEntry[] = matches.map(m => ({
        kind: 'match',
        data: m,
        perPerson: m.rentalCost! / (m.players?.length || 1),
        status: m.costSplit?.[userId] === 'paid' ? 'paid' : 'unpaid',
        date: m.datetime?.toDate ? m.datetime.toDate().getTime() : new Date(m.datetime).getTime(),
      }));

      const reservEntries: ReservEntry[] = reservations.map(r => ({
        kind: 'reservation',
        data: r,
        date: r.date?.toDate ? r.date.toDate().getTime() : new Date(r.date).getTime(),
      }));

      const all: Entry[] = [...matchEntries, ...reservEntries].sort((a, b) => b.date - a.date);
      setEntries(all);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  React.useEffect(() => { load(); }, []);

  const unpaidMatches = entries.filter((e): e is MatchEntry  => e.kind === 'match'       && e.status === 'unpaid');
  const paidMatches   = entries.filter((e): e is MatchEntry  => e.kind === 'match'       && e.status === 'paid');
  const reservations  = entries.filter((e): e is ReservEntry => e.kind === 'reservation');

  const totalUnpaid = unpaidMatches.reduce((s, e) => s + e.perPerson, 0);
  const totalReserv = reservations.filter(e => !e.data.paid).reduce((s, e) => s + e.data.price, 0);
  const totalPaid   = paidMatches.reduce((s, e) => s + e.perPerson, 0);

  function openPayment(p: PaymentParams) {
    setPaymentParams(p);
  }

  function renderMatchRow(e: MatchEntry) {
    const m = e.data;
    const sport = m.sport === 'basketball' ? 'Košarka' : 'Futsal';
    const isPaid = e.status === 'paid';

    return (
      <TouchableOpacity
        key={`m-${m.id}`}
        onPress={() => {
          if (!isPaid) {
            openPayment({
              amount: e.perPerson,
              entityType: 'match',
              entityId: m.id,
              userId,
              description: `${m.location?.name ?? 'Tekma'} – ${sport}`,
            });
          } else {
            navigation.navigate('Home', { screen: 'CostSplit', params: { matchId: m.id } });
          }
        }}
        activeOpacity={0.8}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 12,
          backgroundColor: colors.bgElevated, borderRadius: 14, padding: 14, marginBottom: 8,
          borderWidth: 1, borderLeftWidth: 3,
          borderColor: isPaid ? '#22c55e30' : '#ef444430',
          borderLeftColor: isPaid ? '#22c55e' : '#ef4444',
        }}
      >
        <View style={{
          width: 40, height: 40, borderRadius: 20,
          backgroundColor: isPaid ? '#22c55e18' : '#ef444418',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons
            name={isPaid ? 'checkmark-circle' : 'card-outline'}
            size={20} color={isPaid ? '#22c55e' : '#ef4444'}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
            {m.location?.name ?? 'Tekma'}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
            {sport} · {formatDate(m.datetime)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900' }}>{fmt(e.perPerson)} €</Text>
          <View style={{
            paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
            backgroundColor: isPaid ? '#22c55e20' : colors.primary + '22',
          }}>
            <Text style={{ color: isPaid ? '#22c55e' : colors.primary, fontSize: 10, fontWeight: '800' }}>
              {isPaid ? 'PLAČANO' : 'PLAČAJ'}
            </Text>
          </View>
        </View>
        <Ionicons name={isPaid ? 'chevron-forward' : 'card'} size={16} color={isPaid ? colors.textFaint : colors.primary} />
      </TouchableOpacity>
    );
  }

  function renderReservRow(e: ReservEntry) {
    const r = e.data;
    const isPaid = r.paid === true;

    return (
      <TouchableOpacity
        key={`r-${r.id}`}
        onPress={() => {
          if (!isPaid) {
            openPayment({
              amount: r.price,
              entityType: 'reservation',
              entityId: r.id,
              userId,
              description: `Rezervacija igrišča · ${r.startHHMM}–${r.endHHMM}`,
            });
          }
        }}
        activeOpacity={isPaid ? 1 : 0.8}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 12,
          backgroundColor: colors.bgElevated, borderRadius: 14, padding: 14, marginBottom: 8,
          borderWidth: 1, borderLeftWidth: 3,
          borderColor: isPaid ? '#22c55e30' : '#f59e0b30',
          borderLeftColor: isPaid ? '#22c55e' : '#f59e0b',
        }}
      >
        <View style={{
          width: 40, height: 40, borderRadius: 20,
          backgroundColor: isPaid ? '#22c55e18' : '#f59e0b18',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons name={isPaid ? 'checkmark-circle' : 'card-outline'} size={20} color={isPaid ? '#22c55e' : '#f59e0b'} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
            Rezervacija igrišča
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
            {r.startHHMM} – {r.endHHMM} · {formatDate(r.date)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900' }}>{fmt(r.price)} €</Text>
          <View style={{
            paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
            backgroundColor: isPaid ? '#22c55e20' : '#f59e0b20',
          }}>
            <Text style={{ color: isPaid ? '#22c55e' : '#f59e0b', fontSize: 10, fontWeight: '800' }}>
              {isPaid ? 'PLAČANO' : 'PLAČAJ'}
            </Text>
          </View>
        </View>
        {!isPaid && <Ionicons name="card" size={16} color="#f59e0b" />}
      </TouchableOpacity>
    );
  }

  const hasAny = entries.length > 0;

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
              Moji stroški
            </Text>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900', marginTop: 2 }}>
              Evidenca plačil
            </Text>
          </View>
        </View>

        {!loading && (
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: 12, alignItems: 'center' }}>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>Neplačano</Text>
              <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 4 }}>{fmt(totalUnpaid + totalReserv)} €</Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2 }}>{unpaidMatches.length + reservations.filter(e => !e.data.paid).length} vnos.</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: 12, alignItems: 'center' }}>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>Plačano</Text>
              <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 4 }}>{fmt(totalPaid)} €</Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2 }}>{paidMatches.length} vnos.</Text>
            </View>
          </View>
        )}
      </SafeAreaView>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !hasAny ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Ionicons name="receipt-outline" size={48} color={colors.textFaint} />
          <Text style={{ color: colors.textMuted, fontSize: 15, fontWeight: '600' }}>Ni evidenc stroškov.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
        >
          {unpaidMatches.length > 0 && (
            <View style={{ marginBottom: 8 }}>
              <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 }}>
                Neplačano · {unpaidMatches.length}
              </Text>
              {unpaidMatches.map(renderMatchRow)}
            </View>
          )}

          {reservations.length > 0 && (
            <View style={{ marginBottom: 8, marginTop: unpaidMatches.length > 0 ? 8 : 0 }}>
              <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 }}>
                Rezervacije igrišč · {reservations.length}
              </Text>
              {reservations.map(renderReservRow)}
            </View>
          )}

          {paidMatches.length > 0 && (
            <View style={{ marginTop: 8 }}>
              <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 }}>
                Plačano · {paidMatches.length}
              </Text>
              {paidMatches.map(renderMatchRow)}
            </View>
          )}
        </ScrollView>
      )}

      {paymentParams && (
        <PaymentCardModal
          visible={!!paymentParams}
          amount={paymentParams.amount}
          entityType={paymentParams.entityType}
          entityId={paymentParams.entityId}
          userId={paymentParams.userId}
          description={paymentParams.description}
          onClose={() => setPaymentParams(null)}
          onSuccess={() => { setPaymentParams(null); load(true); }}
        />
      )}
    </View>
  );
}
