import {useApiRequest} from './AuthService';

export interface AlertData {
  id: string;
  alert_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  device_id: string;
  is_acknowledged: boolean;
  acknowledged_at?: string;
  description?: string;
  metadata?: Record<string, any>;
  s3_audio_url?: string;
  s3_video_url?: string;
  duration_seconds?: number;
  created_at: string;
}

export interface AlertFilters {
  limit?: number;
  severity?: string;
  alert_type?: string;
  unread_only?: boolean;
}

export interface AlertStats {
  total_alerts: number;
  acknowledged: number;
  by_severity: Record<string, number>;
  by_type: Record<string, number>;
  avg_confidence: number;
}

export class AlertService {
  private makeRequest: ReturnType<typeof useApiRequest>['makeRequest'];

  constructor() {
    const {makeRequest} = useApiRequest();
    this.makeRequest = makeRequest;
  }

  async getAlerts(filters: AlertFilters = {}): Promise<AlertData[]> {
    const params = new URLSearchParams();
    
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.severity) params.append('severity', filters.severity);
    if (filters.alert_type) params.append('alert_type', filters.alert_type);
    
    const url = `/alerts?${params.toString()}`;
    return this.makeRequest(url);
  }

  async acknowledgeAlert(alertId: string): Promise<void> {
    await this.makeRequest(`/alerts/${alertId}/acknowledge`, {
      method: 'PATCH',
    });
  }

  async getAlertStats(days: number = 7): Promise<AlertStats> {
    return this.makeRequest(`/alerts/stats?days=${days}`);
  }

  async createAlert(alertData: {
    alert_type: string;
    severity: string;
    confidence: number;
    device_id: string;
    description?: string;
    metadata?: Record<string, any>;
    s3_audio_url?: string;
    s3_video_url?: string;
    duration_seconds?: number;
  }): Promise<{id: string; message: string}> {
    return this.makeRequest('/alerts', {
      method: 'POST',
      body: JSON.stringify(alertData),
    });
  }

  // Helper methods for local processing
  formatAlertType(alertType: string): string {
    return alertType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical':
        return '#D32F2F';
      case 'high':
        return '#F44336';
      case 'medium':
        return '#FF9800';
      case 'low':
        return '#4CAF50';
      default:
        return '#757575';
    }
  }

  getSeverityIcon(severity: string): string {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
        return 'check-circle';
      default:
        return 'help';
    }
  }

  getAlertTypeIcon(alertType: string): string {
    switch (alertType) {
      case 'cry_detected':
        return 'child-care';
      case 'motion_detected':
      case 'high_activity':
        return 'directions-run';
      case 'safety_concern':
        return 'warning';
      case 'sound_anomaly':
        return 'volume-up';
      case 'connection_lost':
        return 'wifi-off';
      default:
        return 'notifications';
    }
  }

  shouldShowNotification(alert: AlertData): boolean {
    // Don't show notification for acknowledged alerts
    if (alert.is_acknowledged) return false;
    
    // Always show critical and high severity alerts
    if (alert.severity === 'critical' || alert.severity === 'high') return true;
    
    // Show medium severity if confidence is high
    if (alert.severity === 'medium' && alert.confidence > 0.8) return true;
    
    // Show cry detection alerts regardless of severity if confidence is good
    if (alert.alert_type === 'cry_detected' && alert.confidence > 0.7) return true;
    
    return false;
  }

  getNotificationTitle(alert: AlertData): string {
    const typeMap: Record<string, string> = {
      cry_detected: 'Baby Crying Detected',
      motion_detected: 'Motion Detected',
      high_activity: 'High Activity Level',
      safety_concern: 'Safety Alert',
      sound_anomaly: 'Unusual Sound Detected',
      connection_lost: 'Connection Lost',
    };
    
    return typeMap[alert.alert_type] || 'Baby Monitor Alert';
  }

  getNotificationBody(alert: AlertData): string {
    if (alert.description) return alert.description;
    
    const confidence = Math.round(alert.confidence * 100);
    
    switch (alert.alert_type) {
      case 'cry_detected':
        return `Crying detected with ${confidence}% confidence`;
      case 'motion_detected':
        return `Motion detected in baby's room`;
      case 'high_activity':
        return `High activity level detected`;
      case 'safety_concern':
        return `Safety concern identified`;
      default:
        return `Alert detected with ${confidence}% confidence`;
    }
  }

  // Cache management for offline support
  private alertCache: AlertData[] = [];
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  async getCachedAlerts(): Promise<AlertData[]> {
    const now = Date.now();
    if (now - this.cacheTimestamp < this.CACHE_DURATION && this.alertCache.length > 0) {
      return this.alertCache;
    }
    
    try {
      const alerts = await this.getAlerts({limit: 50});
      this.alertCache = alerts;
      this.cacheTimestamp = now;
      return alerts;
    } catch (error) {
      console.error('Failed to fetch alerts, using cache:', error);
      return this.alertCache;
    }
  }

  invalidateCache(): void {
    this.alertCache = [];
    this.cacheTimestamp = 0;
  }
}
