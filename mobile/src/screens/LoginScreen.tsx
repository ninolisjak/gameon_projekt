import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from '../config/firebase';

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
        <TouchableOpacity
          style={styles.button}
          onPress={() => promptAsync({ useProxy: true })}
          disabled={!request}
        >
          <Text style={styles.buttonText}>Prijava z Googlom</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', padding: 24 },
  title: { fontSize: 48, fontWeight: 'bold', color: '#1a73e8', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 48 },
  button: { backgroundColor: '#1a73e8', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: { color: 'red', marginBottom: 16, textAlign: 'center' },
});
