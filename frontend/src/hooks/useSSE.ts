// ============================================================================
// useSSE Hook
// Manages Server-Sent Events connection for real-time updates
// ============================================================================

'use client';

import { useEffect, useRef, useState } from 'react';

export type SSEEventType =
  | 'violation'
  | 'attempt_status'
  | 'exam_start'
  | 'exam_end'
  | 'student_action'
  | 'heartbeat';

export interface SSEEvent {
  type: SSEEventType;
  data: Record<string, unknown>;
  timestamp: number;
}

export function useSSE(filters?: { examId?: number; userId?: number }) {
  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

    // Build URL with filters
    const params = new URLSearchParams();
    if (filters?.examId) params.append('examId', filters.examId.toString());
    if (filters?.userId) params.append('userId', filters.userId.toString());

    const queryString = params.toString();
    const url = `${BACKEND_URL}/api/teacher/events${queryString ? `?${queryString}` : ''}`;

    // Create EventSource connection
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    // Connection opened
    eventSource.onopen = () => {
      console.log('SSE connected');
      setIsConnected(true);
    };

    // Connection error
    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      setIsConnected(false);
    };

    // Listen for all events
    eventSource.addEventListener('violation', (e) => {
      const event: SSEEvent = {
        type: 'violation',
        data: JSON.parse(e.data),
        timestamp: Date.now(),
      };
      setEvents((prev) => [...prev, event]);
      setLastEvent(event);
    });

    eventSource.addEventListener('attempt_status', (e) => {
      const event: SSEEvent = {
        type: 'attempt_status',
        data: JSON.parse(e.data),
        timestamp: Date.now(),
      };
      setEvents((prev) => [...prev, event]);
      setLastEvent(event);
    });

    eventSource.addEventListener('exam_start', (e) => {
      const event: SSEEvent = {
        type: 'exam_start',
        data: JSON.parse(e.data),
        timestamp: Date.now(),
      };
      setEvents((prev) => [...prev, event]);
      setLastEvent(event);
    });

    eventSource.addEventListener('exam_end', (e) => {
      const event: SSEEvent = {
        type: 'exam_end',
        data: JSON.parse(e.data),
        timestamp: Date.now(),
      };
      setEvents((prev) => [...prev, event]);
      setLastEvent(event);
    });

    eventSource.addEventListener('student_action', (e) => {
      const event: SSEEvent = {
        type: 'student_action',
        data: JSON.parse(e.data),
        timestamp: Date.now(),
      };
      setEvents((prev) => [...prev, event]);
      setLastEvent(event);
    });

    // Listen for heartbeat
    eventSource.addEventListener('heartbeat', (e) => {
      const event: SSEEvent = {
        type: 'heartbeat',
        data: JSON.parse(e.data),
        timestamp: Date.now(),
      };
      // Don't store heartbeat events in the main list
      setLastEvent(event);
    });

    // Cleanup
    return () => {
      console.log('Closing SSE connection');
      eventSource.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    };
  }, [filters?.examId, filters?.userId]);

  const clearEvents = () => {
    setEvents([]);
  };

  return {
    isConnected,
    events,
    lastEvent,
    clearEvents,
  };
}

// ============================================================================
// Hook for auto-refreshing data on SSE events
// ============================================================================

export function useAutoRefresh(
  enabled: boolean,
  refreshFn: () => void,
  eventTypes?: SSEEventType[]
) {
  const { lastEvent } = useSSE();

  useEffect(() => {
    if (!enabled || !lastEvent) return;

    // Check if we should refresh for this event type
    if (eventTypes && !eventTypes.includes(lastEvent.type)) {
      return;
    }

    // Ignore heartbeat events
    if (lastEvent.type === 'heartbeat') {
      return;
    }

    // Refresh data
    console.log('Auto-refreshing due to event:', lastEvent.type);
    refreshFn();
  }, [lastEvent, enabled, eventTypes, refreshFn]);
}
