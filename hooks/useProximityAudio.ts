import { useState, useEffect, useRef, useCallback } from 'react';
import { RemotePlayer } from './useWebSocket';

const HEARING_THRESHOLD = 120; // pixels

export interface NearbyUser {
  id: string;
  distance: number;
  volume: number; // 0.0 to 1.0 (attenuation)
}

interface UseProximityAudioOptions {
  localX: number;
  localY: number;
  remotePlayers: Record<string, RemotePlayer>;
  enabled: boolean;
}

export default function useProximityAudio({
  localX,
  localY,
  remotePlayers,
  enabled,
}: UseProximityAudioOptions) {
  const [nearbyUsers, setNearbyUsers] = useState<NearbyUser[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const calculateProximity = useCallback(() => {
    if (!enabled) {
      setNearbyUsers([]);
      return;
    }

    const nearby: NearbyUser[] = [];

    Object.values(remotePlayers).forEach((player) => {
      const dx = player.x - localX;
      const dy = player.y - localY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < HEARING_THRESHOLD) {
        // Audio attenuation: full volume at 0, zero volume at threshold
        const volume = Math.max(0, 1 - distance / HEARING_THRESHOLD);
        nearby.push({
          id: player.id,
          distance: Math.round(distance),
          volume: parseFloat(volume.toFixed(2)),
        });
      }
    });

    // Sort by distance (closest first)
    nearby.sort((a, b) => a.distance - b.distance);
    setNearbyUsers(nearby);
  }, [localX, localY, remotePlayers, enabled]);

  useEffect(() => {
    // Run every 500ms as per PRD
    intervalRef.current = setInterval(calculateProximity, 500);
    // Also run immediately on mount
    calculateProximity();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [calculateProximity]);

  const nearbyIds = new Set(nearbyUsers.map((u) => u.id));

  return {
    nearbyUsers,
    nearbyIds,
    nearbyCount: nearbyUsers.length,
    hearingThreshold: HEARING_THRESHOLD,
  };
}
