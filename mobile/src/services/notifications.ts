import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure how notifications should be presented when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Alertas SIAGES',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#214bc6',
      });
    }

    return finalStatus === 'granted';
  } catch (err) {
    console.warn('Não foi possível obter permissões de notificação:', err);
    return false;
  }
}

export async function sendExpiringContractsNotification(count: number): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'SIAGES · Atenção a Contratos',
        body:
          count === 1
            ? 'Um contrato no campus possui vigência terminando nos próximos 30 dias. Toque para verificar.'
            : `${count} contratos no campus possuem vigência terminando nos próximos 30 dias. Toque para verificar.`,
        data: { screen: 'contratos', filter: 'vencer' },
      },
      trigger: null,
    });
  } catch (err) {
    console.warn('Erro ao disparar notificação de contratos:', err);
  }
}

export async function sendTestNotification(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'SIAGES Mobile · Notificação Ativa',
        body: 'Alertas configurados com sucesso! Você será avisado sobre vencimentos contratuais e prazos.',
        data: { test: true },
      },
      trigger: null,
    });
  } catch (err) {
    console.warn('Erro ao disparar notificação de teste:', err);
  }
}
