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
import { drawerStyles } from './src/styles/AppStyles';
import ProfileScreen from './src/screens/ProfileScreen';
import { makeDrawerStyles } from './src/styles/AppStyles';
import { PremiumProvider, useColors } from './src/context/PremiumContext';

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
      <DrawerItemList
        {...props}
        activeTintColor={colors.primary}
        inactiveTintColor={colors.textMuted}
        activeBackgroundColor={colors.bgSelected}
        inactiveBackgroundColor="transparent"
      />
    </DrawerContentScrollView>
  );
}

function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Map" component={MapScreen} />
      <Stack.Screen name="CreateMatch" component={CreateMatchScreen} />
      <Stack.Screen name="MatchDetails" component={MatchDetailsScreen} />
    </Stack.Navigator>
  );
}

function MainDrawer() {
  const colors = useColors();
  return (
    <Drawer.Navigator drawerContent={(props) => <DrawerContent {...props} />} screenOptions={{ headerShown: false, drawerStyle: { backgroundColor: colors.bg, width: 260 } }}>
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
    return onAuthStateChanged(auth, u => setUser(u));
  }, []);

  if (user === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0e1a', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        {user ? <MainDrawer /> : <LoginScreen />}
      </NavigationContainer>
    </SafeAreaProvider>
    <PremiumProvider>
      <SafeAreaProvider>
        <NavigationContainer>
          <MainDrawer />
        </NavigationContainer>
      </SafeAreaProvider>
    </PremiumProvider>
  );
}
