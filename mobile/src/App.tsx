import React, {useEffect} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createStackNavigator} from '@react-navigation/stack';
import {StatusBar, Platform} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import StreamScreen from './screens/StreamScreen';
import AlertsScreen from './screens/AlertsScreen';
import SettingsScreen from './screens/SettingsScreen';
import LoginScreen from './screens/LoginScreen';
import MonitoringDashboard from './screens/MonitoringDashboard';

import {AuthProvider, useAuth} from './services/AuthService';
import {NotificationService} from './services/NotificationService';
import {WebSocketProvider} from './services/WebSocketService';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        tabBarIcon: ({focused, color, size}) => {
          let iconName;

          if (route.name === 'Monitor') {
            iconName = 'videocam';
          } else if (route.name === 'Alerts') {
            iconName = 'notifications';
          } else if (route.name === 'Dashboard') {
            iconName = 'dashboard';
          } else if (route.name === 'Settings') {
            iconName = 'settings';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#FF6B35',
        tabBarInactiveTintColor: 'gray',
        headerStyle: {
          backgroundColor: '#FF6B35',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}>
      <Tab.Screen 
        name="Monitor" 
        component={StreamScreen}
        options={{title: 'Baby Monitor'}}
      />
      <Tab.Screen 
        name="Dashboard" 
        component={MonitoringDashboard}
        options={{title: 'Dashboard'}}
      />
      <Tab.Screen 
        name="Alerts" 
        component={AlertsScreen}
        options={{title: 'Alerts'}}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{title: 'Settings'}}
      />
    </Tab.Navigator>
  );
};

const AppNavigator = () => {
  const {user} = useAuth();

  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      {user ? (
        <Stack.Screen name="Main" component={TabNavigator} />
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
};

const App = () => {
  useEffect(() => {
    const notificationService = new NotificationService();
    notificationService.initialize();

    return () => {
      notificationService.cleanup();
    };
  }, []);

  return (
    <AuthProvider>
      <WebSocketProvider>
        <NavigationContainer>
          <StatusBar
            barStyle={Platform.OS === 'ios' ? 'light-content' : 'light-content'}
            backgroundColor="#FF6B35"
          />
          <AppNavigator />
        </NavigationContainer>
      </WebSocketProvider>
    </AuthProvider>
  );
};

export default App;
