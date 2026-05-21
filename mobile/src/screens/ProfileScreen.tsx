import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../config/firebase';
import { makeStyles } from '../styles/ProfileScreenStyles';
import { useColors, usePremium } from '../context/PremiumContext';

const PREMIUM_BENEFITS = [
  'Prednostna uvrstitev pri iskanju tekem',
  'Napredna statistika in analiza igre',
  'Premium značka ob tvojem imenu',
  'Brez oglasov',
];

const PREMIUM_FEATURES = [
  { icon: 'stats-chart' as const, title: 'Napredna statistika', sub: 'Podroben pregled tvoje forme in zgodovine' },
  { icon: 'trophy' as const, title: 'Prednostna uvrstitev', sub: 'Boljša mesta pri weighted scoring iskanju' },
  { icon: 'ribbon' as const, title: 'Premium značka', sub: 'Izstopaj med igralci' },
  { icon: 'eye-off' as const, title: 'Brez oglasov', sub: 'Čista izkušnja brez motenj' },
];

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const { isPremium, buyPremium, cancelPremium, elo, reputation } = usePremium();

  const displayName = auth.currentUser?.displayName ?? 'Igralec';
  const email = auth.currentUser?.email ?? 'Ni prijave';

  function handleBuy() {
    Alert.alert(
      'GameOn Premium',
      'Želiš kupiti Premium za 5 €?',
      [
        { text: 'Prekliči', style: 'cancel' },
        { text: 'Kupi za 5 €', onPress: () => {
          buyPremium();
          Alert.alert('Dobrodošel v Premium!', 'Tvoj račun je zdaj Premium. Uživaj v zlati izkušnji.');
        } },
      ]
    );
  }

  function handleLogout() {
    Alert.alert('Odjava', 'Si prepričan, da se želiš odjaviti?', [
      { text: 'Prekliči', style: 'cancel' },
      { text: 'Odjava', style: 'destructive', onPress: () => auth.signOut() },
    ]);
  }

  function handleCancel() {
    Alert.alert('Prekliči Premium', 'Si prepričan, da želiš preklicati Premium?', [
      { text: 'Ne', style: 'cancel' },
      { text: 'Prekliči Premium', style: 'destructive', onPress: cancelPremium },
    ]);
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} translucent={false} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <SafeAreaView edges={['top']} style={styles.hero}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroLeftRow}>
              <TouchableOpacity
                style={styles.heroIconBtn}
                onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
              >
                <Ionicons name="arrow-back" size={22} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.heroTitle}>Profil</Text>
            </View>
            <TouchableOpacity
              style={styles.heroIconBtn}
              onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
            >
              <Ionicons name="menu" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={32} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
              <Text style={styles.email} numberOfLines={1}>{email}</Text>
              {isPremium && (
                <View style={styles.premiumChip}>
                  <Ionicons name="star" size={12} color="#fff" />
                  <Text style={styles.premiumChipText}>PREMIUM</Text>
                </View>
              )}
            </View>
          </View>
        </SafeAreaView>

        <View style={styles.body}>
          {isPremium && (
            <View>
              <Text style={styles.sectionLabel}>Statistika</Text>
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <View style={styles.statIconRow}>
                    <View style={styles.statIconBox}>
                      <Ionicons name="trending-up" size={16} color={colors.primaryLight} />
                    </View>
                    <Text style={styles.statLabel}>ELO</Text>
                  </View>
                  <Text style={styles.statValue}>{elo}</Text>
                  <Text style={styles.statSub}>Ocena spretnosti</Text>
                </View>

                <View style={styles.statCard}>
                  <View style={styles.statIconRow}>
                    <View style={styles.statIconBox}>
                      <Ionicons name="shield-checkmark" size={16} color={colors.primaryLight} />
                    </View>
                    <Text style={styles.statLabel}>Reputacija</Text>
                  </View>
                  <Text style={styles.statValue}>{reputation}</Text>
                  <Text style={styles.statSub}>Zanesljivost igralca</Text>
                </View>
              </View>
            </View>
          )}

          {isPremium ? (
            <View>
              <Text style={styles.sectionLabel}>Premium funkcije</Text>
              <View style={{ gap: 12 }}>
                {PREMIUM_FEATURES.map(f => (
                  <View key={f.title} style={styles.featureItem}>
                    <View style={styles.featureIconBox}>
                      <Ionicons name={f.icon} size={20} color={colors.primaryLight} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.featureTitle}>{f.title}</Text>
                      <Text style={styles.featureSub}>{f.sub}</Text>
                    </View>
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  </View>
                ))}
              </View>
              <TouchableOpacity style={styles.cancelLink} onPress={handleCancel}>
                <Text style={styles.cancelLinkText}>Prekliči Premium</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text style={styles.sectionLabel}>Nadgradnja</Text>
              <View style={styles.premiumCard}>
                <View style={styles.premiumCardHeader}>
                  <View style={styles.premiumCardIcon}>
                    <Ionicons name="star" size={24} color={colors.primaryLight} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.premiumCardTitle}>GameOn Premium</Text>
                    <Text style={styles.premiumCardPrice}>Enkratno plačilo · 5 €</Text>
                  </View>
                </View>

                {PREMIUM_BENEFITS.map(b => (
                  <View key={b} style={styles.benefitRow}>
                    <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                    <Text style={styles.benefitText}>{b}</Text>
                  </View>
                ))}

                <TouchableOpacity style={styles.buyBtn} onPress={handleBuy} activeOpacity={0.9}>
                  <Ionicons name="star" size={20} color="#fff" />
                  <Text style={styles.buyBtnText}>Kupi Premium za 5 €</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={18} color="#ef4444" />
            <Text style={styles.logoutBtnText}>Odjava</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
