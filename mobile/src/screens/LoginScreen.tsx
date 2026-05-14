import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { styles } from '../styles/LoginScreenStyles';

export default function LoginScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>GameOn</Text>
      <Text style={styles.subtitle}>Najdi tekmo v bližini</Text>
      <TouchableOpacity style={styles.button}>
        <Text style={styles.buttonText}>Prijava z Googlom</Text>
      </TouchableOpacity>
    </View>
  );
}
