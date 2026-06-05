import 'react-native-gesture-handler';
import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createStackNavigator } from '@react-navigation/stack';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './src/config/firebase';
import MapScreen from './src/screens/MapScreen';
import CreateMatchScreen from './src/screens/CreateMatchScreen';
import MatchDetailsScreen from './src/screens/MatchDetailsScreen';
import LoginScreen from './src/screens/LoginScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import GroupsScreen from './src/screens/GroupsScreen';
import BookVenueScreen from './src/screens/BookVenueScreen';
import CostSplitScreen from './src/screens/CostSplitScreen';
import MatchChatScreen from './src/screens/MatchChatScreen';
import UserCostHistoryScreen from './src/screens/UserCostHistoryScreen';
import PaymentCardScreen from './src/screens/PaymentCardScreen';
import { makeDrawerStyles } from './src/styles/AppStyles';
import { StripeProvider } from '@stripe/stripe-react-native';
import { STRIPE_PUBLISHABLE_KEY } from './src/config/stripeConfig';
import { PremiumProvider, useColors } from './src/context/PremiumContext';
import { ensureUserDoc } from './src/services/matchService';
import { registerForPushNotificationsAsync } from './src/services/notificationService';

const Stack = createStackNavigator();
const Drawer = createDrawerNavigator();

function DrawerContent(props: any) {
  const colors = useColors();
  const drawerStyles = React.useMemo(() => makeDrawerStyles(colors), [colors]);
  return (
    <DrawerContentScrollView {...props} style={{ backgroundColor: colors.bg }}>
      <View style={drawerStyles.drawerHeader}>
        <View style={drawerStyles.logoBox}>
          <Ionicons name="football" size={24} color="#fff" />
        </View>
        <View>
          <Text style={drawerStyles.logoTextTop}>GAME</Text>
          <Text style={drawerStyles.logoTextBottom}>ON</Text>
        </View>
      </View>
      <DrawerItemList {...props} />
    </DrawerContentScrollView>
  );
}

function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Map" component={MapScreen} />
      <Stack.Screen name="CreateMatch" component={CreateMatchScreen} />
      <Stack.Screen name="MatchDetails" component={MatchDetailsScreen} />
      <Stack.Screen name="Groups" component={GroupsScreen} />
      <Stack.Screen name="BookVenue" component={BookVenueScreen} />
      <Stack.Screen name="CostSplit" component={CostSplitScreen} />
      <Stack.Screen name="PaymentCard" component={PaymentCardScreen} />
      <Stack.Screen name="MatchChat" component={MatchChatScreen} />
    </Stack.Navigator>
  );
}

function MainDrawer() {
  const colors = useColors();
  return (
    <Drawer.Navigator
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStyle: { backgroundColor: colors.bg, width: 260 },
        drawerActiveTintColor: colors.primary,
        drawerInactiveTintColor: '#c8d3e8',
        drawerActiveBackgroundColor: colors.bgSelected,
        drawerInactiveBackgroundColor: 'transparent',
        drawerLabelStyle: { fontWeight: '600', fontSize: 14 },
      }}
    >
      <Drawer.Screen
        name="Home"
        component={MainStack}
        options={{
          title: 'Tekme',
          drawerIcon: ({ color }) => <Ionicons name="map-outline" size={20} color={color} />,
        }}
      />
      <Drawer.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profil',
          drawerIcon: ({ color }) => <Ionicons name="person-outline" size={20} color={color} />,
        }}
      />
      <Drawer.Screen
        name="Groups"
        component={GroupsScreen}
        options={{
          title: 'Skupine',
          drawerIcon: ({ color }) => <Ionicons name="people-outline" size={20} color={color} />,
        }}
      />
      <Drawer.Screen
        name="BookVenue"
        component={BookVenueScreen}
        options={{
          title: 'Rezerviraj igrišče',
          drawerIcon: ({ color }) => <Ionicons name="calendar-outline" size={20} color={color} />,
        }}
      />
      <Drawer.Screen
        name="CostHistory"
        component={UserCostHistoryScreen}
        options={{
          title: 'Evidenca stroškov',
          drawerIcon: ({ color }) => <Ionicons name="receipt-outline" size={20} color={color} />,
        }}
      />
      <Drawer.Screen
        name="Settings"
        component={MapScreen}
        options={{
          title: 'Nastavitve',
          drawerIcon: ({ color }) => <Ionicons name="settings-outline" size={20} color={color} />,
        }}
      />
    </Drawer.Navigator>
  );
}

export default function App() {
  const [user, setUser] = React.useState<any>(undefined);

  React.useEffect(() => {
    return onAuthStateChanged(auth, async u => {
      setUser(u);
      if (u) {
        const patch: Record<string, any> = {};
        if (u.email) patch.email = u.email;
        if (u.displayName) patch.displayName = u.displayName;
        const token = await registerForPushNotificationsAsync();
        if (token) patch.expoPushToken = token;
        ensureUserDoc(u.uid, patch);
      }
    });
  }, []);

  if (user === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0e1a', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY} merchantIdentifier="merchant.com.RISacc.gameontest">
      <PremiumProvider>
        <SafeAreaProvider>
          <NavigationContainer>
            {user ? <MainDrawer /> : <LoginScreen />}
          </NavigationContainer>
        </SafeAreaProvider>
      </PremiumProvider>
    </StripeProvider>
  );
}
