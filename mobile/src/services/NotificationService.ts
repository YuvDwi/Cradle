import messaging, {FirebaseMessagingTypes} from '@react-native-firebase/messaging';
import {Platform, Alert, PermissionsAndroid} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {AlertData, AlertService} from './AlertService';

export interface NotificationConfig {
  enabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  criticalAlertsOnly: boolean;
  quietHours: {
    enabled: boolean;
    startTime: string; // "22:00"
    endTime: string;   // "07:00"
  };
}

export class NotificationService {
  private alertService: AlertService;
  private config: NotificationConfig;
  private fcmToken: string | null = null;

  constructor() {
    this.alertService = new AlertService();
    this.config = {
      enabled: true,
      soundEnabled: true,
      vibrationEnabled: true,
      criticalAlertsOnly: false,
      quietHours: {
        enabled: false,
        startTime: "22:00",
        endTime: "07:00"
      }
    };
    this.loadConfig();
  }

  async initialize(): Promise<void> {
    try {
      await this.requestPermission();
      await this.getFCMToken();
      this.setupMessageHandlers();
      
      console.log('Notification service initialized');
    } catch (error) {
      console.error('Failed to initialize notification service:', error);
    }
  }

  private async requestPermission(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        if (Platform.Version >= 33) {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            console.log('Notification permission denied');
            return false;
          }
        }
      }

      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        Alert.alert(
          'Notifications Disabled',
          'Please enable notifications to receive baby monitor alerts.',
          [
            {text: 'Cancel', style: 'cancel'},
            {text: 'Settings', onPress: () => this.openSettings()},
          ]
        );
      }

      return enabled;
    } catch (error) {
      console.error('Permission request failed:', error);
      return false;
    }
  }

  private async getFCMToken(): Promise<string | null> {
    try {
      this.fcmToken = await messaging().getToken();
      console.log('FCM Token:', this.fcmToken);
      
      // Send token to backend for push notifications
      await this.registerToken(this.fcmToken);
      
      return this.fcmToken;
    } catch (error) {
      console.error('Failed to get FCM token:', error);
      return null;
    }
  }

  private async registerToken(token: string): Promise<void> {
    try {
      // This would send the token to your backend
      // await this.apiRequest('/auth/register-fcm-token', {
      //   method: 'POST',
      //   body: JSON.stringify({ token })
      // });
      
      await AsyncStorage.setItem('fcm_token', token);
    } catch (error) {
      console.error('Failed to register FCM token:', error);
    }
  }

  private setupMessageHandlers(): void {
    // Handle foreground messages
    messaging().onMessage(async (remoteMessage) => {
      console.log('Foreground message received:', remoteMessage);
      await this.handleForegroundMessage(remoteMessage);
    });

    // Handle background/quit state messages
    messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log('Notification opened app:', remoteMessage);
      this.handleNotificationTap(remoteMessage);
    });

    // Handle app opened from quit state by notification
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          console.log('App opened by notification:', remoteMessage);
          this.handleNotificationTap(remoteMessage);
        }
      });

    // Handle token refresh
    messaging().onTokenRefresh(async (token) => {
      console.log('FCM token refreshed:', token);
      this.fcmToken = token;
      await this.registerToken(token);
    });
  }

  private async handleForegroundMessage(
    remoteMessage: FirebaseMessagingTypes.RemoteMessage
  ): Promise<void> {
    if (!this.shouldShowNotification(remoteMessage)) {
      return;
    }

    // Show local notification for foreground messages
    this.showLocalNotification(remoteMessage);
  }

  private handleNotificationTap(
    remoteMessage: FirebaseMessagingTypes.RemoteMessage
  ): void {
    const alertData = remoteMessage.data;
    
    if (alertData?.alert_id) {
      // Navigate to alert details
      // This would typically use navigation service
      console.log('Navigate to alert:', alertData.alert_id);
    }
  }

  private shouldShowNotification(
    remoteMessage: FirebaseMessagingTypes.RemoteMessage
  ): boolean {
    if (!this.config.enabled) return false;

    const alertData = remoteMessage.data;
    const severity = alertData?.severity || 'medium';

    // Check quiet hours
    if (this.config.quietHours.enabled && this.isQuietHours()) {
      // Only show critical alerts during quiet hours
      return severity === 'critical';
    }

    // Check critical alerts only setting
    if (this.config.criticalAlertsOnly) {
      return severity === 'critical' || severity === 'high';
    }

    return true;
  }

  private isQuietHours(): boolean {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const {startTime, endTime} = this.config.quietHours;
    
    // Handle overnight quiet hours (e.g., 22:00 to 07:00)
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime <= endTime;
    }
    
    // Handle same-day quiet hours
    return currentTime >= startTime && currentTime <= endTime;
  }

  private showLocalNotification(
    remoteMessage: FirebaseMessagingTypes.RemoteMessage
  ): void {
    // This would use a local notification library like @react-native-async-storage/async-storage
    // For simplicity, showing an alert here
    const title = remoteMessage.notification?.title || 'Baby Monitor Alert';
    const body = remoteMessage.notification?.body || 'Alert detected';
    
    Alert.alert(title, body, [
      {text: 'Dismiss', style: 'cancel'},
      {text: 'View', onPress: () => this.handleNotificationTap(remoteMessage)},
    ]);
  }

  async sendLocalAlert(alert: AlertData): Promise<void> {
    if (!this.alertService.shouldShowNotification(alert)) {
      return;
    }

    const title = this.alertService.getNotificationTitle(alert);
    const body = this.alertService.getNotificationBody(alert);

    // This would normally use a local notification library
    console.log('Local alert:', {title, body, alert});
  }

  // Configuration methods
  async updateConfig(updates: Partial<NotificationConfig>): Promise<void> {
    this.config = {...this.config, ...updates};
    await this.saveConfig();
  }

  async loadConfig(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('notification_config');
      if (stored) {
        const parsedConfig = JSON.parse(stored);
        this.config = {...this.config, ...parsedConfig};
      }
    } catch (error) {
      console.error('Failed to load notification config:', error);
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      await AsyncStorage.setItem('notification_config', JSON.stringify(this.config));
    } catch (error) {
      console.error('Failed to save notification config:', error);
    }
  }

  getConfig(): NotificationConfig {
    return {...this.config};
  }

  // Test notification
  async sendTestNotification(): Promise<void> {
    const testAlert: AlertData = {
      id: 'test',
      alert_type: 'cry_detected',
      severity: 'medium',
      confidence: 0.85,
      device_id: 'test_device',
      is_acknowledged: false,
      description: 'This is a test notification',
      created_at: new Date().toISOString(),
    };

    await this.sendLocalAlert(testAlert);
  }

  // Utility methods
  private openSettings(): void {
    // Open device notification settings
    // This would use a library like react-native-open-settings
    console.log('Open notification settings');
  }

  async subscribeToBabyAlerts(deviceId: string): Promise<void> {
    try {
      await messaging().subscribeToTopic(`baby-alerts-${deviceId}`);
      console.log(`Subscribed to baby alerts for device: ${deviceId}`);
    } catch (error) {
      console.error('Failed to subscribe to topic:', error);
    }
  }

  async unsubscribeFromBabyAlerts(deviceId: string): Promise<void> {
    try {
      await messaging().unsubscribeFromTopic(`baby-alerts-${deviceId}`);
      console.log(`Unsubscribed from baby alerts for device: ${deviceId}`);
    } catch (error) {
      console.error('Failed to unsubscribe from topic:', error);
    }
  }

  cleanup(): void {
    // Clean up any resources
    console.log('Notification service cleaned up');
  }

  // Badge management (iOS)
  async updateBadgeCount(count: number): Promise<void> {
    if (Platform.OS === 'ios') {
      try {
        // This would use a library like @react-native-async-storage/async-storage
        // await messaging().setApplicationIconBadgeNumber(count);
        console.log('Badge count updated:', count);
      } catch (error) {
        console.error('Failed to update badge count:', error);
      }
    }
  }

  async getBadgeCount(): Promise<number> {
    if (Platform.OS === 'ios') {
      try {
        // return await messaging().getApplicationIconBadgeNumber();
        return 0;
      } catch (error) {
        console.error('Failed to get badge count:', error);
        return 0;
      }
    }
    return 0;
  }
}
