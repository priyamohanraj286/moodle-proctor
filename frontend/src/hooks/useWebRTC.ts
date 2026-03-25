'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Device } from 'mediasoup-client';
import type { Consumer, DtlsParameters, RtpCapabilities, Transport } from 'mediasoup-client/types';

export interface WebRTCPeerInfo {
  peerId: string;
  studentName: string;
  userId: number;
  isProducing: boolean;
  connectionState: 'connecting' | 'connected' | 'disconnected';
  videoEnabled: boolean;
  audioEnabled: boolean;
}

export interface StreamInfo {
  producerId: string;
  peerId: string;
  studentName: string;
  stream: MediaStream;
  kind: 'audio' | 'video';
}

interface WebRTCConfig {
  roomId: string;
  peerId: string;
  userId: number;
  studentName: string;
  backendUrl: string;
}

interface BackendTransportParams {
  transportId: string;
  iceParameters: Record<string, unknown>;
  iceCandidates: Array<Record<string, unknown>>;
  dtlsParameters: DtlsParameters;
}

interface JoinPeerResponse {
  peerId: string;
  userId: number;
  studentName: string;
  transport: BackendTransportParams;
  routerRtpCapabilities: RtpCapabilities;
}

interface AvailableConsumer {
  producerId: string;
  peerId: string;
  studentName: string;
  kind: 'audio' | 'video';
}

interface CreateConsumerResponse {
  id: string;
  producerId: string;
  kind: 'audio' | 'video';
  rtpParameters: Record<string, unknown>;
}

const CONSUMER_POLL_INTERVAL_MS = 3000;

export function useWebRTC(config: WebRTCConfig) {
  const [peers, setPeers] = useState<Map<string, WebRTCPeerInfo>>(new Map());
  const [streams, setStreams] = useState<Map<string, StreamInfo>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deviceRef = useRef<Device | null>(null);
  const recvTransportRef = useRef<Transport | null>(null);
  const consumerPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const consumersRef = useRef<Map<string, Consumer>>(new Map());
  const consumerMetaRef = useRef<Map<string, AvailableConsumer>>(new Map());
  const producerStreamKeyRef = useRef<Map<string, string>>(new Map());
  const activeProducerByStreamKeyRef = useRef<Map<string, string>>(new Map());
  const connectedRef = useRef(false);
  const joinStateRef = useRef<'idle' | 'joining' | 'joined'>('idle');

  const clearConsumerPoll = useCallback(() => {
    if (consumerPollRef.current) {
      clearInterval(consumerPollRef.current);
      consumerPollRef.current = null;
    }
  }, []);

  const resetState = useCallback(() => {
    setIsConnected(false);
    setPeers(new Map());
    setStreams(new Map());
    consumerMetaRef.current.clear();
    producerStreamKeyRef.current.clear();
    activeProducerByStreamKeyRef.current.clear();
    joinStateRef.current = 'idle';
  }, []);

  const fetchJson = useCallback(
    async <T,>(input: string, init?: RequestInit): Promise<T> => {
      const headers = new Headers(init?.headers);

      if (init?.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }

      const response = await fetch(input, {
        credentials: 'include',
        ...init,
        headers,
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || `Request failed: ${response.status}`);
      }

      return response.json() as Promise<T>;
    },
    []
  );

  const ensureRoom = useCallback(async () => {
    const roomUrl = `${config.backendUrl}/api/webrtc/rooms/${config.roomId}`;

    const roomResponse = await fetch(roomUrl, {
      credentials: 'include',
    });

    if (roomResponse.ok) {
      return;
    }

    if (roomResponse.status !== 404) {
      const errorBody = await roomResponse.json().catch(() => ({}));
      throw new Error(errorBody.error || 'Failed to inspect room');
    }

    await fetchJson(`${config.backendUrl}/api/webrtc/rooms`, {
      method: 'POST',
      body: JSON.stringify({
        roomId: config.roomId,
        examId: 0,
      }),
    });
  }, [config.backendUrl, config.roomId, fetchJson]);

  const syncPeers = useCallback((availableConsumers: AvailableConsumer[]) => {
    setPeers(prev => {
      const updated = new Map(prev);

      for (const consumer of availableConsumers) {
        updated.set(consumer.peerId, {
          peerId: consumer.peerId,
          studentName: consumer.studentName,
          userId: 0,
          isProducing: true,
          connectionState: 'connected',
          videoEnabled: true,
          audioEnabled: true,
        });

        consumerMetaRef.current.set(consumer.producerId, consumer);
      }

      return updated;
    });
  }, []);

  const removeConsumerState = useCallback((producerId: string) => {
    const meta = consumerMetaRef.current.get(producerId);
    const streamKey = producerStreamKeyRef.current.get(producerId);

    consumerMetaRef.current.delete(producerId);
    consumersRef.current.delete(producerId);
    producerStreamKeyRef.current.delete(producerId);

    if (streamKey && activeProducerByStreamKeyRef.current.get(streamKey) === producerId) {
      activeProducerByStreamKeyRef.current.delete(streamKey);
    }

    setStreams(prev => {
      const updated = new Map(prev);
      if (streamKey) {
        updated.delete(streamKey);
      }
      return updated;
    });

    if (!meta) {
      return;
    }

    setPeers(prev => {
      const updated = new Map(prev);
      const stillHasProducer = Array.from(consumerMetaRef.current.values()).some(
        consumer => consumer.peerId === meta.peerId
      );

      if (!stillHasProducer) {
        updated.delete(meta.peerId);
      }

      return updated;
    });
  }, []);

  const consumeAvailableProducers = useCallback(async () => {
    const device = deviceRef.current;
    const recvTransport = recvTransportRef.current;

    if (!device || !recvTransport) {
      return;
    }

    const { consumers } = await fetchJson<{ consumers: AvailableConsumer[] }>(
      `${config.backendUrl}/api/webrtc/rooms/${config.roomId}/peers/${config.peerId}/consumers`
    );

    syncPeers(consumers);

    for (const consumerInfo of consumers) {
      if (consumersRef.current.has(consumerInfo.producerId)) {
        continue;
      }

      const streamKey = `${consumerInfo.peerId}:${consumerInfo.kind}`;
      const existingProducerId = activeProducerByStreamKeyRef.current.get(streamKey);

      if (existingProducerId && existingProducerId !== consumerInfo.producerId) {
        const existingConsumer = consumersRef.current.get(existingProducerId);

        if (existingConsumer) {
          existingConsumer.close();
        }

        removeConsumerState(existingProducerId);
      }

      const consumerParams = await fetchJson<CreateConsumerResponse>(
        `${config.backendUrl}/api/webrtc/rooms/${config.roomId}/peers/${config.peerId}/consume`,
        {
          method: 'POST',
          body: JSON.stringify({
            producerId: consumerInfo.producerId,
            rtpCapabilities: device.recvRtpCapabilities,
          }),
        }
      );

      const consumer = await recvTransport.consume({
        id: consumerParams.id,
        producerId: consumerParams.producerId,
        kind: consumerParams.kind,
        rtpParameters: consumerParams.rtpParameters as any,
      });

      consumersRef.current.set(consumerInfo.producerId, consumer);
      producerStreamKeyRef.current.set(consumerInfo.producerId, streamKey);
      activeProducerByStreamKeyRef.current.set(streamKey, consumerInfo.producerId);

      const mediaStream = new MediaStream([consumer.track]);

      setStreams(prev => {
        const updated = new Map(prev);
        updated.set(streamKey, {
          producerId: consumerInfo.producerId,
          peerId: consumerInfo.peerId,
          studentName: consumerInfo.studentName,
          stream: mediaStream,
          kind: consumerInfo.kind,
        });
        return updated;
      });

      await fetchJson(
        `${config.backendUrl}/api/webrtc/rooms/${config.roomId}/peers/${config.peerId}/consumers/${consumerInfo.producerId}/resume`,
        {
          method: 'POST',
          body: JSON.stringify({}),
        }
      );

      consumer.on('transportclose', () => {
        removeConsumerState(consumerInfo.producerId);
      });

      consumer.on('trackended', () => {
        removeConsumerState(consumerInfo.producerId);
      });
    }
  }, [config.backendUrl, config.peerId, config.roomId, fetchJson, removeConsumerState, syncPeers]);

  const joinRoom = useCallback(async () => {
    if (joinStateRef.current === 'joining' || joinStateRef.current === 'joined') {
      return;
    }

    try {
      joinStateRef.current = 'joining';
      setError(null);
      await ensureRoom();

      const joinResponse = await fetchJson<JoinPeerResponse>(
        `${config.backendUrl}/api/webrtc/rooms/${config.roomId}/peers`,
        {
          method: 'POST',
          body: JSON.stringify({
            peerId: config.peerId,
            studentName: config.studentName,
          }),
        }
      );

      const device = await Device.factory();
      await device.load({
        routerRtpCapabilities: joinResponse.routerRtpCapabilities,
      });

      deviceRef.current = device;

      const recvTransport = device.createRecvTransport({
        id: joinResponse.transport.transportId,
        iceParameters: joinResponse.transport.iceParameters as any,
        iceCandidates: joinResponse.transport.iceCandidates as any,
        dtlsParameters: joinResponse.transport.dtlsParameters,
      });

      recvTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
        fetchJson(
          `${config.backendUrl}/api/webrtc/rooms/${config.roomId}/peers/${config.peerId}/connect-transport`,
          {
            method: 'POST',
            body: JSON.stringify({
              dtlsParameters,
            }),
          }
        )
          .then(() => callback())
          .catch(error => errback(error instanceof Error ? error : new Error(String(error))));
      });

      recvTransport.on('connectionstatechange', state => {
        if (state === 'connected') {
          connectedRef.current = true;
          setIsConnected(true);
          return;
        }

        if (state === 'disconnected' || state === 'failed' || state === 'closed') {
          connectedRef.current = false;
          setIsConnected(false);
        }
      });

      recvTransportRef.current = recvTransport;

      await consumeAvailableProducers();
      clearConsumerPoll();
      consumerPollRef.current = setInterval(() => {
        consumeAvailableProducers().catch(err => {
          console.error('Failed to refresh WebRTC consumers:', err);
        });
      }, CONSUMER_POLL_INTERVAL_MS);
      joinStateRef.current = 'joined';
    } catch (err) {
      joinStateRef.current = 'idle';
      const message = `Failed to join room: ${err}`;
      setError(message);
      console.error(message);
    }
  }, [
    clearConsumerPoll,
    config.backendUrl,
    config.peerId,
    config.roomId,
    config.studentName,
    consumeAvailableProducers,
    ensureRoom,
    fetchJson,
  ]);

  const leaveRoom = useCallback(async () => {
    try {
      if (joinStateRef.current === 'idle') {
        resetState();
        return;
      }

      clearConsumerPoll();

      for (const consumer of consumersRef.current.values()) {
        consumer.close();
      }
      consumersRef.current.clear();
      consumerMetaRef.current.clear();

      recvTransportRef.current?.close();
      recvTransportRef.current = null;
      deviceRef.current = null;

      await fetch(
        `${config.backendUrl}/api/webrtc/rooms/${config.roomId}/peers/${config.peerId}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      ).catch(() => {});

      connectedRef.current = false;
      resetState();
    } catch (err) {
      joinStateRef.current = 'idle';
      console.error('Error leaving room:', err);
    }
  }, [clearConsumerPoll, config.backendUrl, config.peerId, config.roomId, resetState]);

  const getLocalStream = useCallback(() => null, []);

  const getRemoteStreams = useCallback(() => Array.from(streams.values()), [streams]);

  useEffect(() => {
    return () => {
      leaveRoom().catch(console.error);
    };
  }, [leaveRoom]);

  return {
    peers: Array.from(peers.values()),
    streams: Array.from(streams.values()),
    isConnected,
    error,
    joinRoom,
    leaveRoom,
    getLocalStream,
    getRemoteStreams,
  };
}
