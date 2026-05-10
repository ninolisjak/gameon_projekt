import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './src/config/firebase';
import LoginScreen from './src/screens/LoginScreen';
import MapScreen from './src/screens/MapScreen';
import CreateMatchScreen from './src/screens/CreateMatchScreen';

const Stack = createStackNavigator();

export default function App() {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#1a73e8' }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: 'bold' } }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Map" component={MapScreen} options={{ title: 'GameOn — Tekme' }} />
            <Stack.Screen name="CreateMatch" component={CreateMatchScreen} options={{ title: 'Nova tekma' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
