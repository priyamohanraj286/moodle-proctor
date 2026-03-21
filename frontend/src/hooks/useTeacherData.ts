// ============================================================================
// useTeacherData Hook
// Fetches and manages teacher dashboard data
// ============================================================================

'use client';

import { useState, useEffect } from 'react';
import { backendAPI } from '@/lib/backend';

export function useTeacherStats(filters?: { examId?: number }) {
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStats = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await backendAPI.getStats(filters || {});
      if (response.success) {
        setStats(response.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch stats'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [filters?.examId]);

  return { stats, isLoading, error, refetch: fetchStats };
}

export function useAttempts(query: {
  examId?: number;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const [attempts, setAttempts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAttempts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await backendAPI.getAttempts(query);
      if (response.success) {
        setAttempts(response.data.attempts);
        setTotal(response.data.total);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch attempts'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAttempts();
  }, [query.examId, query.status, query.limit, query.offset]);

  return { attempts, total, isLoading, error, refetch: fetchAttempts };
}

export function useStudents(query: {
  search?: string;
  examId?: number;
  limit?: number;
}) {
  const [students, setStudents] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStudents = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await backendAPI.getStudents(query);
      if (response.success) {
        setStudents(response.data.students);
        setTotal(response.data.total);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch students'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [query.search, query.examId, query.limit]);

  return { students, total, isLoading, error, refetch: fetchStudents };
}

export function useReports(query: {
  examId?: number;
  startDate?: string;
  endDate?: string;
  minViolations?: number;
  limit?: number;
}) {
  const [reports, setReports] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchReports = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await backendAPI.getReports(query);
      if (response.success) {
        setReports(response.data.reports);
        setTotal(response.data.total);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch reports'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [query.examId, query.startDate, query.endDate, query.minViolations, query.limit]);

  return { reports, total, isLoading, error, refetch: fetchReports };
}

export function useExams(filters?: { examId?: number }) {
  const [exams, setExams] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchExams = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await backendAPI.getExams(filters);
      if (response.success) {
        setExams(response.data.exams);
        setTotal(response.data.total);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch exams'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, [filters?.examId]);

  return { exams, total, isLoading, error, refetch: fetchExams };
}
