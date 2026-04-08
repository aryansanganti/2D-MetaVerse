import { useEffect, useRef, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { NearbyUser } from './useProximityAudio';

// LiveKit imports — these only work in a custom dev build, not Expo Go
let Room: any = null;
let RoomEvent: any = null;
let Track: any = null;
let registerGlobals: any = null;

try {
  const lk = require('@livekit/react-native');
  registerGlobals = lk.registerGlobals;
  const lkClient = require('livekit-client');
  Room = lkClient.Room;
  RoomEvent = lkClient.RoomEvent;
  Track = lkClient.Track;
} catch {
  // LiveKit not available (running in Expo Go)
}

interface UseVoiceChatOptions {
  livekitToken: string | null;
  livekitUrl: string | null;
  nearbyUsers: NearbyUser[];
  nearbyIds: Set<string>;
  enabled: boolean;
}

export default function useVoiceChat({
  livekitToken,
  livekitUrl,
  nearbyUsers,
  nearbyIds,
  enabled,
}: UseVoiceChatOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [activeSpeakers, setActiveSpeakers] = useState<string[]>([]);
  const [audioAvailable, setAudioAvailable] = useState(false);
  const roomRef = useRef<any>(null);
  const subscribedRef = useRef<Set<string>>(new Set());

  // Initialize LiveKit globals (must be called before creating Room)
  useEffect(() => {
    if (registerGlobals) {
      try {
        registerGlobals();
        setAudioAvailable(true);
      } catch {
        setAudioAvailable(false);
      }
    }
  }, []);

  // Connect to LiveKit room
  useEffect(() => {
    if (!livekitToken || !livekitUrl || !enabled || !Room || !audioAvailable) {
      return;
    }

    let room: any = null;

    const connectToRoom = async () => {
      try {
        room = new Room({
          adaptiveStream: true,
          dynacast: true,
        });

        // Listen for active speakers
        room.on(RoomEvent.ActiveSpeakersChanged, (speakers: any[]) => {
          setActiveSpeakers(speakers.map((s: any) => s.identity));
        });

        room.on(RoomEvent.Connected, () => {
          setIsConnected(true);
          console.log('🎙️ Connected to LiveKit voice room');
        });

        room.on(RoomEvent.Disconnected, () => {
          setIsConnected(false);
          console.log('🔇 Disconnected from LiveKit');
        });

        await room.connect(livekitUrl, livekitToken);
        roomRef.current = room;

        // Publish microphone
        await room.localParticipant.setMicrophoneEnabled(true);

        // Start with all remote tracks unsubscribed (spatial audio logic will manage)
        room.remoteParticipants.forEach((participant: any) => {
          participant.audioTrackPublications.forEach((pub: any) => {
            pub.setSubscribed(false);
          });
        });
      } catch (err: any) {
        console.error('LiveKit connection error:', err.message);
      }
    };

    connectToRoom();

    return () => {
      if (room) {
        room.disconnect();
        roomRef.current = null;
        setIsConnected(false);
      }
    };
  }, [livekitToken, livekitUrl, enabled, audioAvailable]);

  // Proximity-based audio subscription — the core spatial audio logic
  useEffect(() => {
    const room = roomRef.current;
    if (!room || !isConnected) return;

    const currentSubscribed = subscribedRef.current;
    const shouldBeSubscribed = nearbyIds;

    // Subscribe to players who entered the hearing range
    shouldBeSubscribed.forEach((id) => {
      if (!currentSubscribed.has(id)) {
        const participant = room.remoteParticipants.get(id);
        if (participant) {
          participant.audioTrackPublications.forEach((pub: any) => {
            pub.setSubscribed(true);
          });
          console.log(`🔊 Subscribed to ${participant.name || id}`);
        }
        currentSubscribed.add(id);
      }
    });

    // Unsubscribe from players who left the hearing range
    currentSubscribed.forEach((id) => {
      if (!shouldBeSubscribed.has(id)) {
        const participant = room.remoteParticipants.get(id);
        if (participant) {
          participant.audioTrackPublications.forEach((pub: any) => {
            pub.setSubscribed(false);
          });
          console.log(`🔇 Unsubscribed from ${participant.name || id}`);
        }
        currentSubscribed.delete(id);
      }
    });

    // Audio attenuation — adjust volume based on distance
    nearbyUsers.forEach((nearby) => {
      const participant = room.remoteParticipants.get(nearby.id);
      if (participant) {
        participant.audioTrackPublications.forEach((pub: any) => {
          if (pub.track) {
            // Volume ranges from 0.0 (at threshold) to 1.0 (at 0 distance)
            pub.track.setVolume(nearby.volume);
          }
        });
      }
    });

    subscribedRef.current = new Set(shouldBeSubscribed);
  }, [nearbyUsers, nearbyIds, isConnected]);

  // Toggle mute
  const toggleMute = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;

    const newMuted = !isMuted;
    await room.localParticipant.setMicrophoneEnabled(!newMuted);
    setIsMuted(newMuted);
  }, [isMuted]);

  return {
    isConnected,
    isMuted,
    toggleMute,
    activeSpeakers,
    audioAvailable,
  };
}
