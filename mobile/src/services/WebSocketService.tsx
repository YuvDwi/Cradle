import React, {createContext, useContext, useEffect, useState, useRef} from 'react';
import {AppState, AppStateStatus} from 'react-native';
import {useAuth} from './AuthService';

interface WebSocketMessage {
  type: string;
  data?: any;
  timestamp?: number;
  device_id?: string;
}

interface WebSocketContextType {
  isConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  sendMessage: (message: WebSocketMessage) => void;
  lastMessage: WebSocketMessage | null;
  reconnect: () => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

const WS_BASE_URL = 'ws://localhost:8000'; // Replace with your backend URL
const RECONNECT_INTERVAL = 5000;
const MAX_RECONNECT_ATTEMPTS = 10;

export const WebSocketProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<WebSocketContextType['connectionStatus']>('disconnected');
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const appStateRef = useRef(AppState.currentState);
  
  const {user, token} = useAuth();

  const connect = () => {
    if (!user || !token) {
      console.log('No user or token, skipping WebSocket connection');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.CONNECTING || 
        wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connecting/connected');
      return;
    }

    try {
      setConnectionStatus('connecting');
      const deviceId = user.deviceId || user.id;
      const wsUrl = `${WS_BASE_URL}/ws/${deviceId}?token=${token}`;
      
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setConnectionStatus('connected');
        reconnectAttemptsRef.current = 0;
        
        // Send initial device info
        sendMessage({
          type: 'device_info',
          data: {
            device_id: deviceId,
            user_id: user.id,
            platform: 'mobile',
            app_version: '1.0.0'
          }
        });
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('WebSocket message received:', message.type);
          setLastMessage(message);
          
          // Handle different message types
          handleIncomingMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        setConnectionStatus('disconnected');
        
        // Attempt to reconnect if not a normal closure
        if (event.code !== 1000 && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          scheduleReconnect();
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('error');
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionStatus('error');
      scheduleReconnect();
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
      wsRef.current = null;
    }

    setIsConnected(false);
    setConnectionStatus('disconnected');
  };

  const scheduleReconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    reconnectAttemptsRef.current += 1;
    const delay = Math.min(RECONNECT_INTERVAL * reconnectAttemptsRef.current, 30000);
    
    console.log(`Scheduling reconnect attempt ${reconnectAttemptsRef.current} in ${delay}ms`);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      if (appStateRef.current === 'active') {
        connect();
      }
    }, delay);
  };

  const sendMessage = (message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        const messageWithTimestamp = {
          ...message,
          timestamp: message.timestamp || Date.now(),
          device_id: message.device_id || user?.deviceId || user?.id
        };
        
        wsRef.current.send(JSON.stringify(messageWithTimestamp));
        console.log('WebSocket message sent:', message.type);
      } catch (error) {
        console.error('Failed to send WebSocket message:', error);
      }
    } else {
      console.warn('WebSocket not connected, message not sent:', message.type);
    }
  };

  const handleIncomingMessage = (message: WebSocketMessage) => {
    switch (message.type) {
      case 'alert':
        // Handle incoming alerts
        console.log('Alert received:', message.data);
        // Could trigger local notification here
        break;
        
      case 'ml_result':
        // Handle ML inference results
        console.log('ML result received:', message.data);
        break;
        
      case 'connection_ack':
        console.log('Connection acknowledged by server');
        break;
        
      case 'error':
        console.error('Server error:', message.data);
        break;
        
      default:
        console.log('Unknown message type:', message.type);
    }
  };

  const reconnect = () => {
    disconnect();
    setTimeout(connect, 1000);
  };

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      appStateRef.current = nextAppState;
      
      if (nextAppState === 'active') {
        // App became active, connect if not already connected
        if (!isConnected && user && token) {
          connect();
        }
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        // App went to background, keep connection but stop aggressive reconnecting
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [isConnected, user, token]);

  // Connect when user/token becomes available
  useEffect(() => {
    if (user && token && !isConnected && AppState.currentState === 'active') {
      connect();
    } else if (!user && isConnected) {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [user, token]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{
      isConnected,
      connectionStatus,
      sendMessage,
      lastMessage,
      reconnect
    }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = (): WebSocketContextType => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};
