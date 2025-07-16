import { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

const API_BASE_URL = 'http://localhost:3000/api';

export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { user, logout } = useAuth();

  const request = useCallback(async (endpoint, options = {}) => {
    setLoading(true);
    setError(null);

    try {
      const token = user?.token || localStorage.getItem('authToken');
      
      const config = {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
          ...options.headers,
        },
        ...options,
      };

      const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

      // Handle authentication errors
      if (response.status === 401) {
        logout();
        throw new Error('Session expired. Please log in again.');
      }

      if (response.status === 403) {
        throw new Error('Access denied. You do not have permission to perform this action.');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (err) {
      const errorMessage = err.message || 'An unexpected error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user, logout]);

  const get = useCallback((endpoint) => request(endpoint), [request]);
  
  const post = useCallback((endpoint, data) => 
    request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    }), [request]);
  
  const put = useCallback((endpoint, data) => 
    request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    }), [request]);
  
  const del = useCallback((endpoint) => 
    request(endpoint, {
      method: 'DELETE',
    }), [request]);

  return {
    loading,
    error,
    get,
    post,
    put,
    delete: del,
    clearError: () => setError(null),
  };
}; 