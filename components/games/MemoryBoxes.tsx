import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { MemoryRound, RoundResult } from '@/hooks/useChallenge';

const { width: SCREEN_W } = Dimensions.get('window');

interface MemoryBoxesProps {
  round: MemoryRound | null;
  scores: { local: number; remote: number };
  opponentName: string;
  localId: string;
  roundResult: RoundResult | null;
  onSubmitAnswer: (selectedBoxes: number[]) => void;
  onQuit: () => void;
}

type Phase = 'waiting' | 'observe' | 'recall' | 'submitted' | 'revealed';

export default function MemoryBoxes({
  round,
  scores,
  opponentName,
  localId,
  roundResult,
  onSubmitAnswer,
  onQuit,
}: MemoryBoxesProps) {
  const [phase, setPhase] = useState<Phase>('waiting');
  const [selectedBoxes, setSelectedBoxes] = useState<number[]>([]);
  const [litBoxes, setLitBoxes] = useState<Set<number>>(new Set());
  const [correctSet, setCorrectSet] = useState<Set<number>>(new Set());
  const [countdown, setCountdown] = useState(0);
  const flashAnim = useRef(new Animated.Value(0)).current;

  // Reset on new round
  useEffect(() => {
    if (!round) {
      setPhase('waiting');
      return;
    }

    setSelectedBoxes([]);
    setCorrectSet(new Set(round.sequence));
    setLitBoxes(new Set(round.sequence));
    setPhase('observe');
    setCountdown(Math.ceil(round.observeTimeMs / 1000));

    // Start observe countdown
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Transition to recall phase
    const timer = setTimeout(() => {
      setLitBoxes(new Set());
      setPhase('recall');
      setCountdown(10); // 10 seconds to recall
    }, round.observeTimeMs);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [round?.roundIndex]);

  // Recall countdown
  useEffect(() => {
    if (phase !== 'recall') return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Time's up — auto submit
          clearInterval(interval);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [phase]);

  const toggleBox = (index: number) => {
    if (phase !== 'recall') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setSelectedBoxes((prev) => {
      if (prev.includes(index)) {
        return prev.filter((i) => i !== index);
      }
      return [...prev, index];
    });
  };

  const handleSubmit = () => {
    if (phase === 'submitted') return;
    setPhase('submitted');
    onSubmitAnswer(selectedBoxes);
  };

  // Show revealed phase when round result comes in
  useEffect(() => {
    if (roundResult && roundResult.gameType === 'memory' && phase === 'submitted') {
      setCorrectSet(new Set(roundResult.correctSequence || []));
      setPhase('revealed');
    }
  }, [roundResult]);

  if (!round) {
    return (
      <View style={styles.container}>
        <View style={styles.waitingCard}>
          <Ionicons name="hourglass" size={36} color="#ffa502" />
          <Text style={styles.waitingText}>Waiting for next round...</Text>
        </View>
      </View>
    );
  }

  const gridSize = round.gridSize;
  const totalCells = gridSize * gridSize;
  const cellGap = 8;
  const gridPadding = 20;
  const cellSize = (SCREEN_W - gridPadding * 2 - cellGap * (gridSize - 1)) / gridSize;

  const phaseLabel =
    phase === 'observe' ? 'Memorize the pattern!' :
      phase === 'recall' ? 'Tap the boxes!' :
        phase === 'submitted' ? 'Waiting for result...' :
          phase === 'revealed' ? 'Results' : '';

  const phaseColor =
    phase === 'observe' ? '#ffa502' :
      phase === 'recall' ? '#2ed573' :
        phase === 'revealed' ? '#a855f7' : '#8888bb';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onQuit} style={styles.quitBtn} activeOpacity={0.7}>
          <Ionicons name="close" size={20} color="#ff4757" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Memory Boxes</Text>
        <Text style={styles.roundLabel}>
          Round {round.roundIndex + 1}/{round.totalRounds}
        </Text>
      </View>

      {/* Scoreboard */}
      <View style={styles.scoreboard}>
        <View style={styles.scoreCard}>
          <Text style={styles.scoreLabel}>You</Text>
          <Text style={styles.scoreValue}>{scores.local}</Text>
        </View>
        <View style={styles.vsCircle}>
          <Text style={styles.vsText}>VS</Text>
        </View>
        <View style={styles.scoreCard}>
          <Text style={styles.scoreLabel}>{opponentName}</Text>
          <Text style={styles.scoreValue}>{scores.remote}</Text>
        </View>
      </View>

      {/* Phase indicator */}
      <View style={styles.phaseRow}>
        <Text style={[styles.phaseText, { color: phaseColor }]}>{phaseLabel}</Text>
        <Text style={[styles.timerText, countdown <= 3 && { color: '#ff4757' }]}>
          {countdown}s
        </Text>
      </View>

      {/* Grid */}
      <View style={[styles.grid, { paddingHorizontal: gridPadding }]}>
        {Array.from({ length: totalCells }, (_, i) => {
          const isLit = litBoxes.has(i);
          const isSelected = selectedBoxes.includes(i);

          const isCorrect = correctSet.has(i);
          const isRevealedCorrectHit = phase === 'revealed' && isSelected && isCorrect;
          const isRevealedWrong = phase === 'revealed' && isSelected && !isCorrect;
          const isRevealedMissed = phase === 'revealed' && !isSelected && isCorrect;

          return (
            <TouchableOpacity
              key={i}
              style={[
                styles.cell,
                {
                  width: cellSize,
                  height: cellSize,
                  borderRadius: cellSize * 0.18,
                },
                isLit && styles.cellLit,
                isSelected && phase !== 'revealed' && styles.cellSelected,
                isRevealedCorrectHit && styles.cellCorrectHit,
                isRevealedWrong && styles.cellWrong,
                isRevealedMissed && styles.cellMissed,
              ]}
              onPress={() => toggleBox(i)}
              activeOpacity={phase === 'recall' ? 0.6 : 1}
              disabled={phase !== 'recall'}
            >
                {isRevealedCorrectHit && (
                  <Ionicons name="checkmark-circle" size={cellSize * 0.4} color="#fff" />
                )}
                {isRevealedWrong && (
                  <Ionicons name="close-circle" size={cellSize * 0.4} color="#fff" />
                )}
                {isRevealedMissed && (
                  <Ionicons name="ellipse-outline" size={cellSize * 0.4} color="#ffa502" />
                )}
              </TouchableOpacity>
            );
          }
        )}
      </View>

      {/* Submit button */}
      {phase === 'recall' && (
        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-up" size={20} color="#fff" />
          <Text style={styles.submitText}>Submit Answer</Text>
        </TouchableOpacity>
      )}

      {phase === 'submitted' && (
        <View style={styles.submittedBadge}>
          <Ionicons name="hourglass" size={20} color="#ffa502" />
          <Text style={[styles.submittedText, { color: '#ffa502' }]}>Waiting for opponent...</Text>
        </View>
      )}

      {phase === 'revealed' && roundResult && (
        <View style={styles.revealedFeedback}>
          {(() => {
            if (roundResult.winnerId === localId) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else if (roundResult.winnerId !== 'tie') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
            return null;
          })()}
          {roundResult.winnerId === localId ? (
            <View style={styles.feedbackRow}>
              <Ionicons name="checkmark-circle" size={22} color="#2ed573" />
              <Text style={[styles.feedbackText, { color: '#2ed573' }]}>+1 Point!</Text>
            </View>
          ) : roundResult.winnerId === 'tie' ? (
            <View style={styles.feedbackRow}>
              <Ionicons name="remove-circle" size={22} color="#ffa502" />
              <Text style={[styles.feedbackText, { color: '#ffa502' }]}>Tie - 0 Points</Text>
            </View>
          ) : (
            <View style={styles.feedbackRow}>
              <Ionicons name="close-circle" size={22} color="#ff4757" />
              <Text style={[styles.feedbackText, { color: '#ff4757' }]}>Wrong! 0 Points</Text>
            </View>
          )}
          <Text style={styles.legendHint}>Green = correct, Red = wrong pick, Orange outline = missed</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a1a',
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  quitBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 71, 87, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 12,
    flex: 1,
  },
  roundLabel: {
    color: '#8888bb',
    fontSize: 13,
    fontWeight: '600',
  },
  scoreboard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 16,
    paddingHorizontal: 20,
  },
  scoreCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(20, 20, 50, 0.6)',
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(108, 92, 231, 0.2)',
  },
  scoreLabel: {
    color: '#8888bb',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  scoreValue: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
  },
  vsCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(108, 92, 231, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsText: {
    color: '#6c5ce7',
    fontSize: 12,
    fontWeight: '800',
  },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  phaseText: {
    fontSize: 16,
    fontWeight: '700',
  },
  timerText: {
    color: '#ffa502',
    fontSize: 18,
    fontWeight: '800',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 24,
  },
  cell: {
    backgroundColor: 'rgba(20, 20, 50, 0.8)',
    borderWidth: 2,
    borderColor: 'rgba(108, 92, 231, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellLit: {
    backgroundColor: 'rgba(168, 85, 247, 0.7)',
    borderColor: '#d8b4fe',
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 8,
  },
  cellSelected: {
    backgroundColor: 'rgba(46, 213, 115, 0.4)',
    borderColor: '#2ed573',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6c5ce7',
    marginHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
  },
  submitText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  submittedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    paddingVertical: 16,
  },
  submittedText: {
    color: '#2ed573',
    fontSize: 14,
    fontWeight: '600',
  },
  waitingCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  waitingText: {
    color: '#8888bb',
    fontSize: 16,
    fontWeight: '600',
  },
  cellCorrectHit: {
    backgroundColor: 'rgba(46, 213, 115, 0.5)',
    borderColor: '#2ed573',
  },
  cellWrong: {
    backgroundColor: 'rgba(255, 71, 87, 0.5)',
    borderColor: '#ff4757',
  },
  cellMissed: {
    backgroundColor: 'rgba(255, 165, 2, 0.15)',
    borderColor: '#ffa502',
    borderStyle: 'dashed',
  },
  revealedFeedback: {
    alignItems: 'center',
    marginHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  feedbackText: {
    fontSize: 16,
    fontWeight: '800',
  },
  legendHint: {
    color: '#666690',
    fontSize: 11,
    textAlign: 'center',
  },
});
