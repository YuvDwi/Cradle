import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import {useAuth} from '../services/AuthService';
import {NotificationService, NotificationConfig} from '../services/NotificationService';

const SettingsScreen = () => {
  const [notificationConfig, setNotificationConfig] = useState<NotificationConfig>({
    enabled: true,
    soundEnabled: true,
    vibrationEnabled: true,
    criticalAlertsOnly: false,
    quietHours: {
      enabled: false,
      startTime: "22:00",
      endTime: "07:00"
    }
  });

  const {user, logout} = useAuth();
  const notificationService = new NotificationService();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const config = notificationService.getConfig();
      setNotificationConfig(config);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const updateNotificationSetting = async (key: keyof NotificationConfig, value: any) => {
    try {
      const updates = {[key]: value};
      await notificationService.updateConfig(updates);
      setNotificationConfig(prev => ({...prev, ...updates}));
    } catch (error) {
      console.error('Failed to update setting:', error);
      Alert.alert('Error', 'Failed to update setting');
    }
  };

  const updateQuietHoursSetting = async (key: string, value: any) => {
    try {
      const updates = {
        quietHours: {
          ...notificationConfig.quietHours,
          [key]: value
        }
      };
      await notificationService.updateConfig(updates);
      setNotificationConfig(prev => ({...prev, ...updates}));
    } catch (error) {
      console.error('Failed to update quiet hours:', error);
      Alert.alert('Error', 'Failed to update quiet hours setting');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Sign Out', style: 'destructive', onPress: logout},
      ]
    );
  };

  const testNotification = async () => {
    try {
      await notificationService.sendTestNotification();
      Alert.alert('Test Sent', 'A test notification has been sent');
    } catch (error) {
      Alert.alert('Error', 'Failed to send test notification');
    }
  };

  const SettingRow = ({
    icon,
    title,
    subtitle,
    rightComponent,
    onPress,
  }: {
    icon: string;
    title: string;
    subtitle?: string;
    rightComponent?: React.ReactNode;
    onPress?: () => void;
  }) => (
    <TouchableOpacity style={styles.settingRow} onPress={onPress}>
      <View style={styles.settingLeft}>
        <Icon name={icon} size={24} color="#FF6B35" style={styles.settingIcon} />
        <View style={styles.settingText}>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {rightComponent || <Icon name="chevron-right" size={24} color="#ccc" />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        {/* User Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile</Text>
          
          <View style={styles.profileCard}>
            <View style={styles.profileAvatar}>
              <Icon name="person" size={40} color="white" />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {user?.first_name} {user?.last_name}
              </Text>
              <Text style={styles.profileEmail}>{user?.email}</Text>
            </View>
          </View>
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          
          <SettingRow
            icon="notifications"
            title="Enable Notifications"
            subtitle="Receive baby monitor alerts"
            rightComponent={
              <Switch
                value={notificationConfig.enabled}
                onValueChange={(value) => updateNotificationSetting('enabled', value)}
                trackColor={{false: '#767577', true: '#FF6B35'}}
                thumbColor={notificationConfig.enabled ? '#fff' : '#f4f3f4'}
              />
            }
          />

          <SettingRow
            icon="volume-up"
            title="Sound"
            subtitle="Play sound for notifications"
            rightComponent={
              <Switch
                value={notificationConfig.soundEnabled}
                onValueChange={(value) => updateNotificationSetting('soundEnabled', value)}
                disabled={!notificationConfig.enabled}
                trackColor={{false: '#767577', true: '#FF6B35'}}
                thumbColor={notificationConfig.soundEnabled ? '#fff' : '#f4f3f4'}
              />
            }
          />

          <SettingRow
            icon="vibration"
            title="Vibration"
            subtitle="Vibrate for notifications"
            rightComponent={
              <Switch
                value={notificationConfig.vibrationEnabled}
                onValueChange={(value) => updateNotificationSetting('vibrationEnabled', value)}
                disabled={!notificationConfig.enabled}
                trackColor={{false: '#767577', true: '#FF6B35'}}
                thumbColor={notificationConfig.vibrationEnabled ? '#fff' : '#f4f3f4'}
              />
            }
          />

          <SettingRow
            icon="priority-high"
            title="Critical Alerts Only"
            subtitle="Only show high priority alerts"
            rightComponent={
              <Switch
                value={notificationConfig.criticalAlertsOnly}
                onValueChange={(value) => updateNotificationSetting('criticalAlertsOnly', value)}
                disabled={!notificationConfig.enabled}
                trackColor={{false: '#767577', true: '#FF6B35'}}
                thumbColor={notificationConfig.criticalAlertsOnly ? '#fff' : '#f4f3f4'}
              />
            }
          />

          <SettingRow
            icon="bedtime"
            title="Quiet Hours"
            subtitle={notificationConfig.quietHours.enabled 
              ? `${notificationConfig.quietHours.startTime} - ${notificationConfig.quietHours.endTime}`
              : "Disabled"
            }
            rightComponent={
              <Switch
                value={notificationConfig.quietHours.enabled}
                onValueChange={(value) => updateQuietHoursSetting('enabled', value)}
                disabled={!notificationConfig.enabled}
                trackColor={{false: '#767577', true: '#FF6B35'}}
                thumbColor={notificationConfig.quietHours.enabled ? '#fff' : '#f4f3f4'}
              />
            }
          />
        </View>

        {/* Device Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Device</Text>
          
          <SettingRow
            icon="smartphone"
            title="Device Information"
            subtitle={`Device ID: ${user?.deviceId?.slice(0, 8)}...`}
          />

          <SettingRow
            icon="wifi"
            title="Connection Status"
            subtitle="Connected to Baby Monitor API"
          />
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          
          <SettingRow
            icon="help"
            title="Help & FAQ"
            subtitle="Get help with using the app"
          />

          <SettingRow
            icon="bug-report"
            title="Report an Issue"
            subtitle="Send feedback or report bugs"
          />

          <SettingRow
            icon="email"
            title="Contact Support"
            subtitle="Get in touch with our team"
          />

          <SettingRow
            icon="notification-important"
            title="Test Notification"
            subtitle="Send a test notification"
            onPress={testNotification}
          />
        </View>

        {/* App Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          
          <SettingRow
            icon="info"
            title="App Version"
            subtitle="1.0.0 (Build 1)"
          />

          <SettingRow
            icon="description"
            title="Privacy Policy"
            subtitle="View our privacy policy"
          />

          <SettingRow
            icon="gavel"
            title="Terms of Service"
            subtitle="View terms and conditions"
          />
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Icon name="logout" size={24} color="#F44336" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    marginHorizontal: 20,
  },
  profileCard: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#666',
  },
  settingRow: {
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    marginRight: 16,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    color: '#333',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  logoutButton: {
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginVertical: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F44336',
  },
  logoutText: {
    fontSize: 16,
    color: '#F44336',
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default SettingsScreen;
