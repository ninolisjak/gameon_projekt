import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from '../config/firebase';
import { styles } from '../styles/LoginScreenStyles';

WebBrowser.maybeCompleteAuthSession();

const WEB_CLIENT_ID = '6773414897-r3rfgkts0lhk2fq9u9ltd8vsuofgrhir.apps.googleusercontent.com';

export default function LoginScreen() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: WEB_CLIENT_ID,
    scopes: ['profile', 'email'],
  }, { useProxy: true });

  React.useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      setLoading(true);
      const credential = GoogleAuthProvider.credential(id_token);
      signInWithCredential(auth, credential)
        .catch(e => setError(e.message))
        .finally(() => setLoading(false));
    }
  }, [response]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>GameOn</Text>
      <Text style={styles.subtitle}>Najdi tekmo v bližini</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      {loading ? (
        <ActivityIndicator size="large" color="#1a73e8" />
      ) : (
        <TouchableOpacity style={styles.button} onPress={() => promptAsync({ useProxy: true })} disabled={!request} >
          <Text style={styles.buttonText}>Prijava z Googlom</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}