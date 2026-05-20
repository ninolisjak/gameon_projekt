import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../config/firebase';
import { styles } from '../styles/LoginScreenStyles';

export default function LoginScreen() {
  const [mode, setMode] = React.useState<'login' | 'register'>('login');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [showPass, setShowPass] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  function firebaseError(code: string): string {
    switch (code) {
      case 'auth/invalid-email': return 'Neveljaven email naslov.';
      case 'auth/user-not-found': return 'Uporabnik s tem emailom ne obstaja.';
      case 'auth/wrong-password': return 'Napačno geslo.';
      case 'auth/invalid-credential': return 'Napačen email ali geslo.';
      case 'auth/email-already-in-use': return 'Ta email je že v uporabi.';
      case 'auth/weak-password': return 'Geslo mora imeti vsaj 6 znakov.';
      case 'auth/too-many-requests': return 'Preveč poskusov. Počakaj nekaj minut.';
      default: return 'Prišlo je do napake. Poskusi znova.';
    }
  }

  async function handleSubmit() {
    setError('');
    if (!email.trim() || !password) { setError('Vnesi email in geslo.'); return; }
    if (mode === 'register' && password !== confirm) { setError('Gesli se ne ujemata.'); return; }
    if (mode === 'register' && password.length < 6) { setError('Geslo mora imeti vsaj 6 znakov.'); return; }

    setLoading(true);
    try {
      if (mode === 'register') {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (e: any) {
      setError(firebaseError(e.code));
    } finally {
      setLoading(false);
    }
  }

  function switchMode() {
    setMode(m => m === 'login' ? 'register' : 'login');
    setError('');
    setPassword('');
    setConfirm('');
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor="#0a0e1a" />

      <View style={styles.logoRow}>
        <View style={styles.logoBox}>
          <Ionicons name="football" size={32} color="#fff" />
        </View>
        <Text style={styles.title}>GameOn</Text>
      </View>
      <Text style={styles.subtitle}>
        {mode === 'login' ? 'Prijavi se v svoj račun' : 'Ustvari nov račun'}
      </Text>

      <View style={styles.form}>
        <View style={styles.inputWrap}>
          <Ionicons name="mail-outline" size={18} color="#8896aa" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#4a5568"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputWrap}>
          <Ionicons name="lock-closed-outline" size={18} color="#8896aa" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Geslo"
            placeholderTextColor="#4a5568"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPass}
          />
          <TouchableOpacity onPress={() => setShowPass(v => !v)} style={styles.eyeBtn}>
            <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color="#8896aa" />
          </TouchableOpacity>
        </View>

        {mode === 'register' && (
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color="#8896aa" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Potrdi geslo"
              placeholderTextColor="#4a5568"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry={!showPass}
            />
          </View>
        )}

        {error !== '' && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading} activeOpacity={0.85}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>{mode === 'login' ? 'Prijava' : 'Registracija'}</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={switchMode} style={styles.switchRow}>
          <Text style={styles.switchText}>
            {mode === 'login' ? 'Nimaš računa? ' : 'Imaš račun? '}
            <Text style={styles.switchLink}>
              {mode === 'login' ? 'Registracija' : 'Prijava'}
            </Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
