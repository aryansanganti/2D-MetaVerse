import { useState, useCallback, useRef, useEffect } from 'react';

export type ChallengeState = 'idle' | 'sending' | 'receiving' | 'playing';
export type GameType = 'math' | 'memory';

export interface ChallengeInvite {
  fromId: string;
  fromName: string;
  gameType: GameType;
}

export interface MathRound {
  equation: string;
  answer: number;
  roundIndex: number;
  totalRounds: number;
}

export interface MemoryRound {
  gridSize: number;
  sequence: number[];
  observeTimeMs: number;
  roundIndex: number;
  totalRounds: number;
}

export interface RoundResult {
  gameType: GameType;
  winnerId: string;
  correctAnswer?: number;
  correctSequence?: number[];
  roundIndex: number;
}

export interface GameResult {
  winnerId: string;
  winnerName: string;
  loserId: string;
  loserName: string;
  reason: string;
}

interface UseChallengeOptions {
  localId: string;
  wsRef: React.RefObject<WebSocket | null>;
}

export default function useChallenge({ localId, wsRef }: UseChallengeOptions) {
  const [state, setState] = useState<ChallengeState>('idle');
  const [opponentId, setOpponentId] = useState<string>('');
  const [opponentName, setOpponentName] = useState<string>('');
  const [gameType, setGameType] = useState<GameType>('math');
  const [pendingInvite, setPendingInvite] = useState<ChallengeInvite | null>(null);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);

  // Math game state
  const [mathRound, setMathRound] = useState<MathRound | null>(null);
  const [mathScores, setMathScores] = useState<{ local: number; remote: number }>({ local: 0, remote: 0 });

  // Memory game state
  const [memoryRound, setMemoryRound] = useState<MemoryRound | null>(null);
  const [memoryScores, setMemoryScores] = useState<{ local: number; remote: number }>({ local: 0, remote: 0 });

  // Round result feedback
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);

  const send = useCallback((data: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, [wsRef]);

  // Send a challenge invite
  const sendInvite = useCallback((targetId: string, game: GameType) => {
    setState('sending');
    setOpponentId(targetId);
    setGameType(game);
    send({ type: 'challenge_invite', targetId, gameType: game });
  }, [send]);

  // Respond to an invite
  const respondToInvite = useCallback((accept: boolean) => {
    if (!pendingInvite) return;
    send({
      type: 'challenge_response',
      targetId: pendingInvite.fromId,
      accepted: accept,
      gameType: pendingInvite.gameType,
    });
    if (accept) {
      setState('playing');
      setOpponentId(pendingInvite.fromId);
      setOpponentName(pendingInvite.fromName);
      setGameType(pendingInvite.gameType);
      setMathScores({ local: 0, remote: 0 });
      setMemoryScores({ local: 0, remote: 0 });
    } else {
      setState('idle');
    }
    setPendingInvite(null);
  }, [pendingInvite, send]);

  // Submit answer for math game
  const submitMathAnswer = useCallback((answer: number) => {
    send({ type: 'game_action', gameType: 'math', answer });
  }, [send]);

  // Submit answer for memory game
  const submitMemoryAnswer = useCallback((selectedBoxes: number[]) => {
    send({ type: 'game_action', gameType: 'memory', selectedBoxes });
  }, [send]);

  // Handle incoming challenge messages
  const handleChallengeMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'challenge_invite':
        setPendingInvite({
          fromId: data.fromId,
          fromName: data.fromName,
          gameType: data.gameType,
        });
        setState('receiving');
        break;

      case 'challenge_response':
        if (data.accepted) {
          setState('playing');
          setOpponentName(data.fromName || '');
          setMathScores({ local: 0, remote: 0 });
          setMemoryScores({ local: 0, remote: 0 });
        } else {
          setState('idle');
          setOpponentId('');
        }
        break;

      case 'challenge_declined':
        setState('idle');
        setOpponentId('');
        break;

      case 'game_sync_math':
        setMathRound({
          equation: data.equation,
          answer: data.answer,
          roundIndex: data.roundIndex,
          totalRounds: data.totalRounds,
        });
        break;

      case 'game_sync_memory':
        setMemoryRound({
          gridSize: data.gridSize,
          sequence: data.sequence,
          observeTimeMs: data.observeTimeMs,
          roundIndex: data.roundIndex,
          totalRounds: data.totalRounds,
        });
        break;

      case 'round_result':
        setRoundResult({
          gameType: data.gameType,
          winnerId: data.winnerId,
          correctAnswer: data.correctAnswer,
          correctSequence: data.correctSequence,
          roundIndex: data.roundIndex,
        });
        if (data.gameType === 'math') {
          setMathScores((prev) => ({
            local: data.winnerId === localId ? prev.local + 1 : prev.local,
            remote: data.winnerId !== localId && data.winnerId !== 'tie' ? prev.remote + 1 : prev.remote,
          }));
        } else {
          setMemoryScores((prev) => ({
            local: data.winnerId === localId ? prev.local + 1 : prev.local,
            remote: data.winnerId !== localId && data.winnerId !== 'tie' ? prev.remote + 1 : prev.remote,
          }));
        }
        break;

      case 'game_result':
        setGameResult({
          winnerId: data.winnerId,
          winnerName: data.winnerName,
          loserId: data.loserId,
          loserName: data.loserName,
          reason: data.reason || '',
        });
        break;
    }
  }, [localId]);

  // Reset to idle
  const resetChallenge = useCallback(() => {
    setState('idle');
    setOpponentId('');
    setOpponentName('');
    setPendingInvite(null);
    setGameResult(null);
    setMathRound(null);
    setMemoryRound(null);
    setRoundResult(null);
    setMathScores({ local: 0, remote: 0 });
    setMemoryScores({ local: 0, remote: 0 });
  }, []);

  return {
    state,
    opponentId,
    opponentName,
    gameType,
    pendingInvite,
    gameResult,
    mathRound,
    mathScores,
    memoryRound,
    memoryScores,
    roundResult,
    sendInvite,
    respondToInvite,
    submitMathAnswer,
    submitMemoryAnswer,
    handleChallengeMessage,
    resetChallenge,
  };
}
