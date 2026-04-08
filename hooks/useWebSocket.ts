import { useRef, useState, useCallback, useEffect } from 'react';
import { JoystickDirection } from '@/components/Joystick';
import { ChatMessage } from '@/components/ChatWindow';

export interface RemotePlayer {
  id: string;
  x: number;
  y: number;
  dir: JoystickDirection;
  nickname: string;
  avatarId: number;
}

interface UseWebSocketOptions {
  serverUrl: string;
  nickname: string;
  avatarId: number;
  onChallengeMessage?: (data: any) => void;
}

export default function useWebSocket({
  serverUrl,
  nickname,
  avatarId,
  onChallengeMessage,
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [remotePlayers, setRemotePlayers] = useState<
    Record<string, RemotePlayer>
  >({});
  const [localId, setLocalId] = useState<string>('');
  const [connected, setConnected] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const throttleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentRef = useRef<{ x: number; y: number; dir: string }>({
    x: 0,
    y: 0,
    dir: 'idle',
  });

  // Store challenge callback in a ref so ws.onmessage always gets the latest
  const challengeCallbackRef = useRef(onChallengeMessage);
  challengeCallbackRef.current = onChallengeMessage;

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(serverUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        // Send join message
        ws.send(
          JSON.stringify({
            type: 'join',
            nickname,
            avatarId,
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case 'welcome':
              setLocalId(data.id);

              break;

            case 'state':
              // Full state sync — all players
              setRemotePlayers((prev) => {
                const next: Record<string, RemotePlayer> = {};
                for (const player of data.players) {
                  if (player.id !== data.yourId) {
                    next[player.id] = player;
                  }
                }
                return next;
              });
              break;

            case 'player_joined':
              if (data.player.id !== localId) {
                setRemotePlayers((prev) => ({
                  ...prev,
                  [data.player.id]: data.player,
                }));
              }
              break;

            case 'player_moved':
              setRemotePlayers((prev) => {
                if (!prev[data.id]) return prev;
                return {
                  ...prev,
                  [data.id]: {
                    ...prev[data.id],
                    x: data.x,
                    y: data.y,
                    dir: data.dir,
                  },
                };
              });
              break;

            case 'player_left':
              setRemotePlayers((prev) => {
                const next = { ...prev };
                delete next[data.id];
                return next;
              });
              break;

            case 'chat':
              setChatMessages((prev) => [
                ...prev,
                {
                  id: data.id,
                  senderId: data.senderId,
                  senderName: data.senderName,
                  text: data.text,
                  timestamp: data.timestamp,
                  isLocal: false,
                },
              ]);
              break;

            case 'challenge_invite':
            case 'challenge_response':
            case 'challenge_declined':
            case 'game_sync_math':
            case 'game_sync_memory':
            case 'round_result':
            case 'game_result':
              challengeCallbackRef.current?.(data);
              break;
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        setConnected(false);
        // Attempt reconnect after 2 seconds
        setTimeout(() => {
          if (wsRef.current === ws) {
            connect();
          }
        }, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      // Connection failed, retry
      setTimeout(connect, 2000);
    }
  }, [serverUrl, nickname, avatarId, localId]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  // Throttled position update — max 10 ticks/sec (100ms)
  const sendPosition = useCallback(
    (x: number, y: number, dir: JoystickDirection) => {
      const rounded = {
        x: Math.round(x),
        y: Math.round(y),
        dir,
      };

      // Skip if position hasn't changed
      if (
        rounded.x === lastSentRef.current.x &&
        rounded.y === lastSentRef.current.y &&
        rounded.dir === lastSentRef.current.dir
      ) {
        return;
      }

      if (throttleRef.current) return;

      throttleRef.current = setTimeout(() => {
        throttleRef.current = null;
      }, 100);

      lastSentRef.current = rounded;

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'move',
            x: rounded.x,
            y: rounded.y,
            dir: rounded.dir,
          })
        );
      }
    },
    []
  );

  const sendChat = useCallback(
    (text: string) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const msgId = `local-${Date.now()}`;
        // Add to local messages immediately
        setChatMessages((prev) => [
          ...prev,
          {
            id: msgId,
            senderId: localId,
            senderName: nickname,
            text,
            timestamp: Date.now(),
            isLocal: true,
          },
        ]);
        wsRef.current.send(
          JSON.stringify({
            type: 'chat',
            text,
          })
        );
      }
    },
    [localId, nickname]
  );

  useEffect(() => {
    return () => {
      disconnect();
      if (throttleRef.current) clearTimeout(throttleRef.current);
    };
  }, []);

  return {
    connect,
    disconnect,
    sendPosition,
    sendChat,
    chatMessages,
    remotePlayers,
    localId,
    connected,

    wsRef,
  };
}
