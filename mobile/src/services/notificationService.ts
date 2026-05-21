import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const EAS_PROJECT_ID = '655bb96f-5538-4365-a60b-6593417d4944';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  await ensureChannel();

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID });
    return token.data;
  } catch {
    return null;
  }
}

const CHANNEL_ID = 'default';

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
  });
}

export async function showLocalNotification(title: string, body: string): Promise<void> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;
  await ensureChannel();
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: null,
  });
}

export async function sendPushToTokens(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, any>,
) {
  const valid = tokens.filter(t => t && (t.startsWith('ExponentPushToken') || t.startsWith('ExpoPushToken')));
  if (valid.length === 0) return;
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(valid.map(to => ({ to, sound: 'default', title, body, data: data ?? {} }))),
    });
  } catch (e) {
    console.warn('Push send failed', e);
  }
}
