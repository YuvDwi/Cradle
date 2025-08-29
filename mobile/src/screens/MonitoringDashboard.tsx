import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';

import {AlertService, AlertStats} from '../services/AlertService';
import {useAuth} from '../services/AuthService';
import {useWebSocket} from '../services/WebSocketService';

const {width} = Dimensions.get('window');

const MonitoringDashboard = () => {
  const [alertStats, setAlertStats] = useState<AlertStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState(7); // days

  const {user} = useAuth();
  const {isConnected, connectionStatus} = useWebSocket();
  const alertService = new AlertService();

  useEffect(() => {
    loadDashboardData();
  }, [timeRange]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const stats = await alertService.getAlertStats(timeRange);
      setAlertStats(stats);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const StatCard = ({
    title,
    value,
    icon,
    color,
    subtitle,
    onPress,
  }: {
    title: string;
    value: string | number;
    icon: string;
    color: string;
    subtitle?: string;
    onPress?: () => void;
  }) => (
    <TouchableOpacity style={styles.statCard} onPress={onPress}>
      <LinearGradient
        colors={[color, `${color}CC`]}
        style={styles.statGradient}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}>
        <View style={styles.statContent}>
          <Icon name={icon} size={24} color="white" />
          <Text style={styles.statValue}>{value}</Text>
          <Text style={styles.statTitle}>{title}</Text>
          {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  const SeverityBar = ({severity, count, total}: {severity: string; count: number; total: number}) => {
    const percentage = total > 0 ? (count / total) * 100 : 0;
    const colors = {
      high: '#F44336',
      medium: '#FF9800',
      low: '#4CAF50',
      critical: '#D32F2F',
    };

    return (
      <View style={styles.severityRow}>
        <View style={styles.severityInfo}>
          <View style={[styles.severityDot, {backgroundColor: colors[severity] || '#757575'}]} />
          <Text style={styles.severityLabel}>{severity.toUpperCase()}</Text>
        </View>
        <View style={styles.severityBar}>
          <View 
            style={[
              styles.severityFill, 
              {width: `${percentage}%`, backgroundColor: colors[severity] || '#757575'}
            ]} 
          />
        </View>
        <Text style={styles.severityCount}>{count}</Text>
      </View>
    );
  };

  const ConnectionIndicator = () => (
    <View style={[styles.connectionCard, isConnected && styles.connectedCard]}>
      <View style={styles.connectionHeader}>
        <Icon 
          name={isConnected ? 'wifi' : 'wifi-off'} 
          size={24} 
          color={isConnected ? '#4CAF50' : '#F44336'} 
        />
        <Text style={[styles.connectionStatus, isConnected && styles.connectedStatus]}>
          {connectionStatus.toUpperCase()}
        </Text>
      </View>
      <Text style={styles.connectionSubtext}>
        {isConnected 
          ? 'Real-time monitoring active' 
          : 'Connection lost - attempting to reconnect'
        }
      </Text>
    </View>
  );

  const TimeRangeSelector = () => (
    <View style={styles.timeRangeContainer}>
      <Text style={styles.timeRangeLabel}>Time Range:</Text>
      <View style={styles.timeRangeButtons}>
        {[1, 7, 30].map(days => (
          <TouchableOpacity
            key={days}
            style={[
              styles.timeRangeButton,
              timeRange === days && styles.timeRangeButtonActive
            ]}
            onPress={() => setTimeRange(days)}>
            <Text style={[
              styles.timeRangeButtonText,
              timeRange === days && styles.timeRangeButtonTextActive
            ]}>
              {days === 1 ? '24H' : `${days}D`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#FF6B35']}
          />
        }>
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <Text style={styles.headerSubtitle}>
            Monitor your baby's well-being
          </Text>
        </View>

        {/* Connection Status */}
        <ConnectionIndicator />

        {/* Time Range Selector */}
        <TimeRangeSelector />

        {/* Main Stats */}
        {alertStats && (
          <>
            <View style={styles.statsGrid}>
              <StatCard
                title="Total Alerts"
                value={alertStats.total_alerts}
                icon="notifications"
                color="#FF6B35"
                subtitle={`Last ${timeRange} days`}
              />
              <StatCard
                title="Acknowledged"
                value={alertStats.acknowledged}
                icon="check-circle"
                color="#4CAF50"
                subtitle={`${((alertStats.acknowledged / alertStats.total_alerts) * 100 || 0).toFixed(0)}% resolved`}
              />
            </View>

            <View style={styles.statsGrid}>
              <StatCard
                title="Avg Confidence"
                value={`${(alertStats.avg_confidence * 100).toFixed(0)}%`}
                icon="trending-up"
                color="#2196F3"
                subtitle="ML accuracy"
              />
              <StatCard
                title="Cry Events"
                value={alertStats.by_type.cry_detected || 0}
                icon="child-care"
                color="#9C27B0"
                subtitle="Detected crying"
              />
            </View>

            {/* Alert Breakdown by Severity */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Alerts by Severity</Text>
              <View style={styles.severityChart}>
                {Object.entries(alertStats.by_severity).map(([severity, count]) => (
                  <SeverityBar
                    key={severity}
                    severity={severity}
                    count={count}
                    total={alertStats.total_alerts}
                  />
                ))}
              </View>
            </View>

            {/* Alert Types Breakdown */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Alert Types</Text>
              <View style={styles.alertTypes}>
                {Object.entries(alertStats.by_type).map(([type, count]) => (
                  <View key={type} style={styles.alertTypeRow}>
                    <Icon 
                      name={alertService.getAlertTypeIcon(type)} 
                      size={20} 
                      color="#FF6B35" 
                    />
                    <Text style={styles.alertTypeName}>
                      {alertService.formatAlertType(type)}
                    </Text>
                    <Text style={styles.alertTypeCount}>{count}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Recent Activity Summary */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Summary</Text>
              <Text style={styles.summaryText}>
                In the last {timeRange} days, your baby monitor has detected{' '}
                <Text style={styles.summaryHighlight}>{alertStats.total_alerts} alerts</Text>
                {alertStats.total_alerts > 0 && (
                  <>
                    {' '}with an average confidence of{' '}
                    <Text style={styles.summaryHighlight}>
                      {(alertStats.avg_confidence * 100).toFixed(0)}%
                    </Text>
                    . {alertStats.acknowledged} out of {alertStats.total_alerts} alerts have been 
                    acknowledged.
                  </>
                )}
              </Text>
            </View>
          </>
        )}

        {loading && (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading dashboard...</Text>
          </View>
        )}
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
  header: {
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
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  connectionCard: {
    backgroundColor: 'white',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  connectedCard: {
    borderLeftColor: '#4CAF50',
  },
  connectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  connectionStatus: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F44336',
    marginLeft: 8,
  },
  connectedStatus: {
    color: '#4CAF50',
  },
  connectionSubtext: {
    fontSize: 14,
    color: '#666',
  },
  timeRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  timeRangeLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  timeRangeButtons: {
    flexDirection: 'row',
  },
  timeRangeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginLeft: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  timeRangeButtonActive: {
    backgroundColor: '#FF6B35',
  },
  timeRangeButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  timeRangeButtonTextActive: {
    color: 'white',
  },
  statsGrid: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statGradient: {
    padding: 16,
  },
  statContent: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 8,
  },
  statTitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginTop: 4,
  },
  statSubtitle: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: 2,
  },
  chartCard: {
    backgroundColor: 'white',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  severityChart: {
    marginTop: 8,
  },
  severityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  severityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 80,
  },
  severityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  severityLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  severityBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  severityFill: {
    height: '100%',
    borderRadius: 4,
  },
  severityCount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    width: 30,
    textAlign: 'right',
  },
  alertTypes: {
    marginTop: 8,
  },
  alertTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  alertTypeName: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
  },
  alertTypeCount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  summaryCard: {
    backgroundColor: 'white',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  summaryHighlight: {
    color: '#FF6B35',
    fontWeight: 'bold',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
});

export default MonitoringDashboard;
