// ============================================================================
// Auth Context
// Provides authentication state and methods
// ============================================================================

'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { backendAPI, BackendUser } from '@/lib/backend';

interface AuthContextType {
  user: BackendUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<BackendUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (token) {
          const response = await backendAPI.validateToken(token);
          if (response.success) {
            setUser(response.data.user);
            backendAPI.setToken(response.data.token);
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('auth_token');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (username: string, password: string) => {
    const response = await backendAPI.login(username, password);
    if (response.success) {
      setUser(response.data.user);
    }
  };

  const logout = () => {
    backendAPI.clearToken();
    setUser(null);
  };

  const refreshToken = async () => {
    try {
      const response = await backendAPI.getCurrentUser();
      if (response.success) {
        setUser(response.data.user);
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      logout();
    }
  };

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    refreshToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
