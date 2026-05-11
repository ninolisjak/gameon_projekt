import 'react-native-gesture-handler';
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { NavigationContainer, useNavigation, DrawerActions } from '@react-navigation/native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { createStackNavigator } from '@react-navigation/stack';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { onAuthStateChanged, User, signInAnonymously } from 'firebase/auth';
import { auth } from './src/config/firebase';
import LoginScreen from './src/screens/LoginScreen';
import MapScreen from './src/screens/MapScreen';
import CreateMatchScreen from './src/screens/CreateMatchScreen';
import {drawerStyles, headerStyles} from './src/styles/AppStyles'

const Stack = createStackNavigator();
const Drawer = createDrawerNavigator();

const DEV_SKIP_LOGIN = true;


function AppHeader() {
  const navigation = useNavigation<any>();
  return (
    <SafeAreaView edges={['top']} style={headerStyles.wrapper}>
      <View style={headerStyles.header}>
        <View style={headerStyles.headerLeft}>
          <View style={headerStyles.logoBox}>
            <Ionicons name="football" size={20} color="#0a0e1a" />
          </View>
          <View>
            <Text style={headerStyles.logoTextTop}>GAME</Text>
            <Text style={headerStyles.logoTextBottom}>ON</Text>
          </View>
        </View>
        <View style={headerStyles.headerRight}>
          <TouchableOpacity style={headerStyles.iconBtn}>
            <Ionicons name="notifications-outline" size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={headerStyles.iconBtn}
            onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          >
            <Ionicons name="settings-outline" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}


function DrawerContent(props: any) {
  return (
    <DrawerContentScrollView {...props} style={{ backgroundColor: '#0a0e1a' }}>
      <View style={drawerStyles.drawerHeader}>
        <View style={drawerStyles.logoBox}>
          <Ionicons name="football" size={24} color="#0a0e1a" />
        </View>
        <View>
          <Text style={drawerStyles.logoTextTop}>GAME</Text>
          <Text style={drawerStyles.logoTextBottom}>ON</Text>
        </View>
      </View>
      <DrawerItemList
        {...props}
        activeTintColor="#f5c518"
        inactiveTintColor="#8896aa"
        activeBackgroundColor="#131929"
        inactiveBackgroundColor="transparent"
      />
    </DrawerContentScrollView>
  );
}

function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ header: () => <AppHeader />,}}>
      <Stack.Screen name="Map" component={MapScreen} />
      <Stack.Screen name="CreateMatch" component={CreateMatchScreen} options={{ title: 'Nova tekma' }} />
    </Stack.Navigator>
  );
}

function MainDrawer() {
  return (
    <Drawer.Navigator drawerContent={(props) => <DrawerContent {...props} />} screenOptions={{ headerShown: false, drawerStyle: { backgroundColor: '#0a0e1a', width: 260 },}}>
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
        component={MapScreen} // placeholder — zamenjaj z ProfileScreen ko bo narejen
        options={{
          title: 'Profil',
          drawerIcon: ({ color }) => <Ionicons name="person-outline" size={20} color={color} />,
        }}
      />
      <Drawer.Screen
        name="Settings"
        component={MapScreen} // placeholder — zamenjaj z SettingsScreen ko bo narejen
        options={{
          title: 'Nastavitve',
          drawerIcon: ({ color }) => <Ionicons name="settings-outline" size={20} color={color} />,
        }}
      />
    </Drawer.Navigator>
  );
}


export default function App() {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (DEV_SKIP_LOGIN) {
      signInAnonymously(auth)
        .then(cred => setUser(cred.user))
        .catch(console.error)
        .finally(() => setLoading(false));
      return;
    }
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) return null;

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        {!user ? (
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Login" component={LoginScreen} />
          </Stack.Navigator>
        ) : (
          <MainDrawer />
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

