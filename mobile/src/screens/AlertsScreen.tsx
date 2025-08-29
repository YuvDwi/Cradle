import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import {AlertService, AlertData} from '../services/AlertService';
import {useAuth} from '../services/AuthService';

const AlertsScreen = () => {
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'high'>('all');
  
  const {user} = useAuth();
  const alertService = new AlertService();

  useEffect(() => {
    loadAlerts();
  }, [filter]);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const alertData = await alertService.getAlerts({
        limit: 50,
        severity: filter === 'high' ? 'high' : undefined,
        unread_only: filter === 'unread'
      });
      setAlerts(alertData);
    } catch (error) {
      console.error('Failed to load alerts:', error);
      Alert.alert('Error', 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAlerts();
    setRefreshing(false);
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      await alertService.acknowledgeAlert(alertId);
      
      // Update local state
      setAlerts(prev => 
        prev.map(alert => 
          alert.id === alertId 
            ? {...alert, is_acknowledged: true, acknowledged_at: new Date().toISOString()}
            : alert
        )
      );
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
      Alert.alert('Error', 'Failed to acknowledge alert');
    }
  };

  const getAlertIcon = (alertType: string) => {
    switch (alertType) {
      case 'cry_detected':
        return 'child-care';
      case 'motion_detected':
        return 'directions-run';
      case 'high_activity':
        return 'trending-up';
      case 'safety_concern':
        return 'warning';
      default:
        return 'notifications';
    }
  };

  const getAlertColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return '#F44336';
      case 'medium':
        return '#FF9800';
      case 'low':
        return '#4CAF50';
      default:
        return '#757575';
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const alertTime = new Date(timestamp);
    const diffMs = now.getTime() - alertTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const renderAlert = ({item}: {item: AlertData}) => (
    <TouchableOpacity
      style={[
        styles.alertCard,
        !item.is_acknowledged && styles.unreadAlert
      ]}
      onPress={() => !item.is_acknowledged && acknowledgeAlert(item.id)}>
      
      <View style={styles.alertHeader}>
        <View style={styles.alertIconContainer}>
          <Icon 
            name={getAlertIcon(item.alert_type)} 
            size={24} 
            color={getAlertColor(item.severity)} 
          />
        </View>
        
        <View style={styles.alertInfo}>
          <Text style={styles.alertTitle}>
            {item.alert_type.replace('_', ' ').toUpperCase()}
          </Text>
          <Text style={styles.alertTime}>
            {formatTimeAgo(item.created_at)}
          </Text>
        </View>
        
        <View style={styles.alertBadges}>
          <View style={[styles.severityBadge, {backgroundColor: getAlertColor(item.severity)}]}>
            <Text style={styles.severityText}>{item.severity.toUpperCase()}</Text>
          </View>
          {!item.is_acknowledged && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>NEW</Text>
            </View>
          )}
        </View>
      </View>
      
      {item.description && (
        <Text style={styles.alertDescription}>{item.description}</Text>
      )}
      
      <View style={styles.alertFooter}>
        <Text style={styles.confidenceText}>
          Confidence: {(item.confidence * 100).toFixed(1)}%
        </Text>
        
        {item.duration_seconds && (
          <Text style={styles.durationText}>
            Duration: {item.duration_seconds.toFixed(1)}s
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderFilterButtons = () => (
    <View style={styles.filterContainer}>
      {[
        {key: 'all', label: 'All'},
        {key: 'unread', label: 'Unread'},
        {key: 'high', label: 'High Priority'}
      ].map(({key, label}) => (
        <TouchableOpacity
          key={key}
          style={[
            styles.filterButton,
            filter === key && styles.filterButtonActive
          ]}
          onPress={() => setFilter(key as typeof filter)}>
          <Text style={[
            styles.filterButtonText,
            filter === key && styles.filterButtonTextActive
          ]}>
            {label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const unreadCount = alerts.filter(alert => !alert.is_acknowledged).length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Alerts</Text>
        {unreadCount > 0 && (
          <View style={styles.unreadCounter}>
            <Text style={styles.unreadCounterText}>{unreadCount}</Text>
          </View>
        )}
      </View>

      {renderFilterButtons()}

      <FlatList
        data={alerts}
        renderItem={renderAlert}
        keyExtractor={item => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#FF6B35']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="notifications-none" size={80} color="#ccc" />
            <Text style={styles.emptyText}>No alerts found</Text>
            <Text style={styles.emptySubtext}>
              {filter === 'all' 
                ? 'Your baby monitor alerts will appear here'
                : `No ${filter} alerts at the moment`
              }
            </Text>
          </View>
        }
        contentContainerStyle={alerts.length === 0 && styles.emptyList}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  unreadCounter: {
    backgroundColor: '#F44336',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadCounterText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  filterButtonActive: {
    backgroundColor: '#FF6B35',
  },
  filterButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: 'white',
  },
  alertCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  unreadAlert: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B35',
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  alertIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  alertInfo: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  alertTime: {
    fontSize: 12,
    color: '#666',
  },
  alertBadges: {
    alignItems: 'flex-end',
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 4,
  },
  severityText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  unreadBadge: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  unreadText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  alertDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  alertFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 8,
  },
  confidenceText: {
    fontSize: 12,
    color: '#666',
  },
  durationText: {
    fontSize: 12,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyList: {
    flex: 1,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default AlertsScreen;
