import React, {createContext, useContext, useEffect, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  deviceId?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = 'http://localhost:8000/api/v1'; // Replace with your backend URL
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'user_data';

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const [storedToken, storedUser] = await Promise.all([
        AsyncStorage.getItem(TOKEN_KEY),
        AsyncStorage.getItem(USER_KEY),
      ]);

      if (storedToken && storedUser) {
        setToken(storedToken);
        const userData = JSON.parse(storedUser);
        
        // Add device ID if not present
        if (!userData.deviceId) {
          userData.deviceId = await DeviceInfo.getUniqueId();
        }
        
        setUser(userData);
      }
    } catch (error) {
      console.error('Failed to load stored auth:', error);
    } finally {
      setLoading(false);
    }
  };

  const storeAuth = async (token: string, user: User) => {
    try {
      await Promise.all([
        AsyncStorage.setItem(TOKEN_KEY, token),
        AsyncStorage.setItem(USER_KEY, JSON.stringify(user)),
      ]);
    } catch (error) {
      console.error('Failed to store auth:', error);
    }
  };

  const clearAuth = async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(TOKEN_KEY),
        AsyncStorage.removeItem(USER_KEY),
      ]);
    } catch (error) {
      console.error('Failed to clear auth:', error);
    }
  };

  const makeAuthenticatedRequest = async (url: string, options: RequestInit = {}) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired or invalid
        await logout();
        throw new Error('Authentication failed');
      }
      
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP ${response.status}`);
    }

    return response.json();
  };

  const login = async (email: string, password: string) => {
    try {
      const formData = new FormData();
      formData.append('username', email);
      formData.append('password', password);

      const response = await fetch(`${API_BASE_URL}/auth/token`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Login failed');
      }

      const tokenData = await response.json();
      const accessToken = tokenData.access_token;

      // Get user info
      const userResponse = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!userResponse.ok) {
        throw new Error('Failed to get user info');
      }

      const userData = await userResponse.json();
      
      // Add device ID
      userData.deviceId = await DeviceInfo.getUniqueId();

      setToken(accessToken);
      setUser(userData);
      await storeAuth(accessToken, userData);

    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const register = async (email: string, password: string, firstName: string, lastName: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          first_name: firstName,
          last_name: lastName,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Registration failed');
      }

      // Auto-login after successful registration
      await login(email, password);

    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      setUser(null);
      setToken(null);
      await clearAuth();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const updateUserProfile = async (updates: Partial<User>) => {
    try {
      if (!user) throw new Error('No user logged in');

      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(updatedUser));

    } catch (error) {
      console.error('Failed to update user profile:', error);
      throw error;
    }
  };

  const refreshUserData = async () => {
    try {
      if (!token) throw new Error('No token available');

      const userData = await makeAuthenticatedRequest('/auth/me');
      
      // Preserve device ID
      userData.deviceId = user?.deviceId || await DeviceInfo.getUniqueId();
      
      setUser(userData);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(userData));

    } catch (error) {
      console.error('Failed to refresh user data:', error);
      throw error;
    }
  };

  const validateToken = async () => {
    try {
      if (!token) return false;

      await makeAuthenticatedRequest('/auth/me');
      return true;

    } catch (error) {
      console.error('Token validation failed:', error);
      await logout();
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      login,
      register,
      logout,
      loading,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Helper hook for making authenticated API requests
export const useApiRequest = () => {
  const {token, logout} = useAuth();

  const makeRequest = async (url: string, options: RequestInit = {}) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      if (response.status === 401) {
        await logout();
        throw new Error('Authentication failed');
      }
      
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP ${response.status}`);
    }

    return response.json();
  };

  return { makeRequest };
};
