import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Dimensions,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Joystick, { JoystickDirection } from '@/components/Joystick';
import Avatar from '@/components/Avatar';
import ProximityIndicator from '@/components/ProximityIndicator';
import useWebSocket from '@/hooks/useWebSocket';
import useProximityAudio from '@/hooks/useProximityAudio';

import ChatWindow from '@/components/ChatWindow';
import ChallengeModal from '@/components/ChallengeModal';
import MathQuiz from '@/components/games/MathQuiz';
import MemoryBoxes from '@/components/games/MemoryBoxes';
import useChallenge from '@/hooks/useChallenge';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Map dimensions — the background image fills the screen
// We define the walkable area within the map
const MAP_PADDING = 20;
const AVATAR_SIZE = 48;
const MOVE_SPEED = 3.5;

// Server URL — use your machine's local IP for physical device testing
// localhost only works on simulators. Physical phones need the LAN IP.
const SERVER_URL = 'ws://192.168.0.203:3001';

export default function GameScreen() {
  const params = useLocalSearchParams<{ nickname: string; avatarId: string }>();
  const router = useRouter();
  const nickname = params.nickname || 'Anon';
  const avatarId = parseInt(params.avatarId || '1', 10);

  // Local player position
  const [localX, setLocalX] = useState(SCREEN_W / 2);
  const [localY, setLocalY] = useState(SCREEN_H / 2);
  const [localDir, setLocalDir] = useState<JoystickDirection>('down');

  // Movement tracking ref (to avoid stale closure in interval)
  const moveRef = useRef({ dx: 0, dy: 0, dir: 'idle' as JoystickDirection });
  const posRef = useRef({ x: SCREEN_W / 2, y: SCREEN_H / 2 });
  const frameRef = useRef<number | null>(null);

  // Map layout state — we measure the actual rendered map size
  const [mapLayout, setMapLayout] = useState({
    x: 0,
    y: 0,
    width: SCREEN_W,
    height: SCREEN_H,
  });

  // Challenge hook — needs wsRef, so declare after useWebSocket
  const challengeRef = useRef<{ handleChallengeMessage: (data: any) => void } | null>(null);

  const {
    connect,
    disconnect,
    sendPosition,
    sendChat,
    chatMessages,
    remotePlayers,
    localId,
    connected,
    wsRef,
  } = useWebSocket({
    serverUrl: SERVER_URL,
    nickname,
    avatarId,
    onChallengeMessage: (data: any) => {
      challengeRef.current?.handleChallengeMessage(data);
    },
  });

  const challenge = useChallenge({ localId, wsRef });

  // Keep ref updated so the WebSocket handler always calls the latest
  challengeRef.current = challenge;

  // Chat state
  const [chatOpen, setChatOpen] = useState(false);

  // Is a game actively being played?
  const isInGame = challenge.state === 'playing';

  const { nearbyUsers, nearbyIds, nearbyCount, hearingThreshold } =
    useProximityAudio({
      localX,
      localY,
      remotePlayers,
      enabled: true,
    });

  // Connect on mount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, []);

  // Game loop — runs at ~60fps using requestAnimationFrame
  useEffect(() => {
    let lastTime = Date.now();

    const gameLoop = () => {
      const now = Date.now();
      const dt = (now - lastTime) / 16.67; // normalize to 60fps
      lastTime = now;

      const { dx, dy, dir } = moveRef.current;

      if (dx !== 0 || dy !== 0) {
        let newX = posRef.current.x + dx * MOVE_SPEED * dt;
        let newY = posRef.current.y + dy * MOVE_SPEED * dt;

        // Boundary clamping — keep avatar within the actual map image (1:1 aspect ratio)
        const viewW = mapLayout.width;
        const viewH = mapLayout.height;
        const imgSize = Math.min(viewW, viewH);
        
        const offsetX = mapLayout.x + (viewW - imgSize) / 2;
        const offsetY = mapLayout.y + (viewH - imgSize) / 2;

        const minX = offsetX + MAP_PADDING;
        const maxX = offsetX + imgSize - AVATAR_SIZE - MAP_PADDING;
        const minY = offsetY + MAP_PADDING;
        const maxY = offsetY + imgSize - AVATAR_SIZE - MAP_PADDING;

        newX = Math.max(minX, Math.min(maxX, newX));
        newY = Math.max(minY, Math.min(maxY, newY));

        posRef.current = { x: newX, y: newY };
        setLocalX(newX);
        setLocalY(newY);
        sendPosition(newX, newY, dir);
      }

      frameRef.current = requestAnimationFrame(gameLoop);
    };

    frameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [mapLayout, sendPosition]);

  // Joystick handlers
  const handleJoystickMove = useCallback(
    (dx: number, dy: number, dir: JoystickDirection) => {
      moveRef.current = { dx, dy, dir };
      setLocalDir(dir);
    },
    []
  );

  const handleJoystickRelease = useCallback(() => {
    moveRef.current = { dx: 0, dy: 0, dir: 'idle' };
  }, []);

  // Handle map layout measurement
  const handleMapLayout = useCallback(
    (event: { nativeEvent: { layout: { x: number; y: number; width: number; height: number } } }) => {
      const { x, y, width, height } = event.nativeEvent.layout;
      setMapLayout({ x, y, width, height });
    },
    []
  );

  // Avatar interaction handlers
  const handleAvatarChat = useCallback((playerId: string) => {
    setChatOpen(true);
  }, []);

  const handleAvatarChallenge = useCallback((playerId: string, game: 'math' | 'memory') => {
    challenge.sendInvite(playerId, game);
  }, [challenge.sendInvite]);

  // If a game is in progress, show the game overlay
  if (isInGame) {
    return (
      <View style={styles.container}>
        {challenge.gameType === 'math' ? (
          <MathQuiz
            round={challenge.mathRound}
            scores={challenge.mathScores}
            opponentName={challenge.opponentName}
            localId={localId}
            roundResult={challenge.roundResult}
            onSubmitAnswer={challenge.submitMathAnswer}
            onQuit={challenge.resetChallenge}
          />
        ) : (
          <MemoryBoxes
            round={challenge.memoryRound}
            scores={challenge.memoryScores}
            opponentName={challenge.opponentName}
            localId={localId}
            roundResult={challenge.roundResult}
            onSubmitAnswer={challenge.submitMemoryAnswer}
            onQuit={challenge.resetChallenge}
          />
        )}

        {/* Game result overlay */}
        <ChallengeModal
          pendingInvite={null}
          onAccept={() => { }}
          onDecline={() => { }}
          isSending={false}
          gameResult={challenge.gameResult}
          localId={localId}
          onDismissResult={challenge.resetChallenge}
        />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* HUD — Top bar */}
      <View style={styles.hud}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="arrow-back" size={14} color="#ff4757" />
            <Text style={styles.backText}>Leave</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.statusContainer}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: connected ? '#2ed573' : '#ff4757' },
            ]}
          />
          <Text style={styles.statusText}>
            {connected ? 'Connected' : 'Connecting...'}
          </Text>
        </View>

        {nearbyCount > 0 && (
          <View style={styles.nearbyBadge}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="mic" size={14} color="#2ed573" />
              <Text style={styles.nearbyText}>{nearbyCount} nearby</Text>
            </View>
          </View>
        )}

      </View>

      {/* Map + Avatars */}
      <View style={styles.mapContainer} onLayout={handleMapLayout}>
        {/* Background map */}
        <Image
          source={require('@/assets/office_map.png')}
          style={styles.mapImage}
          resizeMode="contain"
        />

        {/* Proximity Ring around local player */}
        <ProximityIndicator
          x={localX}
          y={localY}
          radius={hearingThreshold}
          hasNearbyUsers={nearbyCount > 0}
        />

        {/* Remote player avatars */}
        {Object.values(remotePlayers).map((player) => (
          <Avatar
            key={player.id}
            x={player.x}
            y={player.y}
            avatarId={player.avatarId}
            nickname={player.nickname}
            isLocal={false}
            isNearby={nearbyIds.has(player.id)}
            playerId={player.id}
            onChat={handleAvatarChat}
            onChallenge={handleAvatarChallenge}
          />
        ))}

        {/* Local player avatar (higher z-index) */}
        <Avatar
          x={localX}
          y={localY}
          avatarId={avatarId}
          nickname={nickname}
          isLocal={true}
        />
      </View>

      {/* Joystick overlay */}
      <Joystick
        onMove={handleJoystickMove}
        onRelease={handleJoystickRelease}
      />



      {/* Online count */}
      <View style={styles.onlineCounter}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="people" size={14} color="#a855f7" />
          <Text style={styles.onlineText}>{Object.keys(remotePlayers).length + 1}</Text>
        </View>
      </View>

      {/* Chat button — appears when nearby users exist */}
      {nearbyCount > 0 && !chatOpen && (
        <TouchableOpacity
          style={styles.chatButton}
          onPress={() => setChatOpen(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="chatbubble-ellipses" size={26} color="#a855f7" />
          {chatMessages.length > 0 && (
            <View style={styles.chatBadge}>
              <Text style={styles.chatBadgeText}>{chatMessages.length > 99 ? '99+' : chatMessages.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* Chat Window */}
      <ChatWindow
        visible={chatOpen}
        messages={chatMessages}
        nearbyNames={nearbyUsers.map((u) => {
          const player = remotePlayers[u.id];
          return player ? player.nickname : 'Unknown';
        })}
        onSend={sendChat}
        onClose={() => setChatOpen(false)}
      />

      {/* Challenge invite/sending/result modals */}
      <ChallengeModal
        pendingInvite={challenge.pendingInvite}
        onAccept={() => challenge.respondToInvite(true)}
        onDecline={() => challenge.respondToInvite(false)}
        isSending={challenge.state === 'sending'}
        gameResult={challenge.gameResult}
        localId={localId}
        onDismissResult={challenge.resetChallenge}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a1a',
  },
  hud: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingHorizontal: 16,
    paddingBottom: 10,
    zIndex: 200,
    backgroundColor: 'rgba(10, 10, 26, 0.85)',
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 71, 87, 0.15)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 71, 87, 0.3)',
  },
  backText: {
    color: '#ff4757',
    fontSize: 13,
    fontWeight: '700',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    color: '#8888bb',
    fontSize: 12,
    fontWeight: '600',
  },
  nearbyBadge: {
    backgroundColor: 'rgba(46, 213, 115, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(46, 213, 115, 0.3)',
  },
  nearbyText: {
    color: '#2ed573',
    fontSize: 12,
    fontWeight: '700',
  },

  mapContainer: {
    flex: 1,
  },
  mapImage: {
    width: '100%',
    height: '100%',
  },

  onlineCounter: {
    position: 'absolute',
    bottom: 130,
    right: 24,
    backgroundColor: 'rgba(20, 20, 50, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(108, 92, 231, 0.3)',
    zIndex: 100,
  },
  onlineText: {
    color: '#a855f7',
    fontSize: 13,
    fontWeight: '700',
  },
  chatButton: {
    position: 'absolute',
    bottom: 60,
    left: SCREEN_W / 2 - 28,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(20, 20, 50, 0.8)',
    borderWidth: 2,
    borderColor: 'rgba(108, 92, 231, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  chatButtonEmoji: {
    fontSize: 24,
  },
  chatBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ff4757',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  chatBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
});
