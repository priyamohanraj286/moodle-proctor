// ============================================================================
// Backend API Integration
// Connects frontend to the backend API
// ============================================================================

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

// ============================================================================
// Types
// ============================================================================

export interface BackendUser {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'student' | 'teacher';
  profileImageUrl?: string;
}

export interface BackendAuthResponse {
  success: true;
  data: {
    token: string;
    user: BackendUser;
  };
}

export interface BackendError {
  success: false;
  error: string;
}

// ============================================================================
// API Client
// ============================================================================

class BackendAPIClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token');
    }
  }

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
    }
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options?.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = data as BackendError;
      throw new Error(error.error || 'Request failed');
    }

    return data as T;
  }

  // ==========================================================================
  // Authentication
  // ==========================================================================

  async login(username: string, password: string): Promise<BackendAuthResponse> {
    const response = await this.request<BackendAuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    // Store token
    if (response.success && response.data.token) {
      this.setToken(response.data.token);
    }

    return response;
  }

  async validateToken(token: string): Promise<BackendAuthResponse> {
    return this.request<BackendAuthResponse>('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  async getCurrentUser(): Promise<BackendAuthResponse> {
    return this.request<BackendAuthResponse>('/api/auth/me');
  }

  // ==========================================================================
  // Exams
  // ==========================================================================

  async getExams(filters?: { examId?: number }) {
    const params = new URLSearchParams();
    if (filters?.examId) params.append('examId', filters.examId.toString());

    const query = params.toString() ? `?${params}` : '';
    return this.request<{ success: true; data: { exams: unknown[]; total: number } }>(
      `/api/teacher/exams${query}`
    );
  }

  async getExam(examId: number) {
    return this.request<{ success: true; data: { exams: unknown[] } }>(
      `/api/teacher/exams/${examId}`
    );
  }

  // ==========================================================================
  // Attempts
  // ==========================================================================

  async getAttempts(query: {
    examId?: number;
    status?: string;
    userId?: number;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, value.toString());
    });

    const queryString = params.toString();
    return this.request<{ success: true; data: { attempts: unknown[]; total: number } }>(
      `/api/teacher/attempts${queryString ? `?${queryString}` : ''}`
    );
  }

  async getAttemptDetails(attemptId: number) {
    return this.request<{ success: true; data: unknown }>(
      `/api/teacher/attempts/${attemptId}`
    );
  }

  async getAttemptViolations(attemptId: number) {
    return this.request<{ success: true; data: { violations: unknown[]; total: number } }>(
      `/api/teacher/attempts/${attemptId}/violations`
    );
  }

  // ==========================================================================
  // Students
  // ==========================================================================

  async getStudents(query: {
    search?: string;
    examId?: number;
    limit?: number;
    offset?: number;
  }) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, value.toString());
    });

    const queryString = params.toString();
    return this.request<{ success: true; data: { students: unknown[]; total: number } }>(
      `/api/teacher/students${queryString ? `?${queryString}` : ''}`
    );
  }

  // ==========================================================================
  // Reports
  // ==========================================================================

  async getReports(query: {
    examId?: number;
    userId?: number;
    startDate?: string;
    endDate?: string;
    minViolations?: number;
    limit?: number;
    offset?: number;
  }) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, value.toString());
    });

    const queryString = params.toString();
    return this.request<{ success: true; data: { reports: unknown[]; total: number } }>(
      `/api/teacher/reports${queryString ? `?${queryString}` : ''}`
    );
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  async getStats(query: {
    timeRange?: 'hour' | 'day' | 'week' | 'month' | 'all';
    examId?: number;
  }) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, value.toString());
    });

    const queryString = params.toString();
    return this.request<{ success: true; data: unknown }>(
      `/api/teacher/stats${queryString ? `?${queryString}` : ''}`
    );
  }

  // ==========================================================================
  // Server-Sent Events
  // ==========================================================================

  connectToSSE(filters?: { examId?: number; userId?: number }): EventSource {
    const params = new URLSearchParams();
    if (filters?.examId) params.append('examId', filters.examId.toString());
    if (filters?.userId) params.append('userId', filters.userId.toString());

    const queryString = params.toString();
    const url = `${this.baseUrl}/api/teacher/events${queryString ? `?${queryString}` : ''}`;

    const eventSource = new EventSource(url, {
      withCredentials: true,
    });

    return eventSource;
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const backendAPI = new BackendAPIClient(BACKEND_URL);
