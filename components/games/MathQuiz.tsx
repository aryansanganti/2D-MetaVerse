import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { MathRound, RoundResult } from '@/hooks/useChallenge';

interface MathQuizProps {
  round: MathRound | null;
  scores: { local: number; remote: number };
  opponentName: string;
  localId: string;
  roundResult: RoundResult | null;
  onSubmitAnswer: (answer: number) => void;
  onQuit: () => void;
}

export default function MathQuiz({
  round,
  scores,
  opponentName,
  localId,
  roundResult,
  onSubmitAnswer,
  onQuit,
}: MathQuizProps) {
  const [input, setInput] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [countdown, setCountdown] = useState(15);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Reset on new round
  useEffect(() => {
    if (round) {
      setInput('');
      setSubmitted(false);
      setCountdown(15);
    }
  }, [round?.roundIndex]);

  // Countdown timer
  useEffect(() => {
    if (!round || submitted) return;

    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Time's up — auto-submit wrong answer
          if (!submitted) {
            setSubmitted(true);
            onSubmitAnswer(-99999);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [round?.roundIndex, submitted]);

  // Pulse animation for timer when low
  useEffect(() => {
    if (countdown <= 5 && countdown > 0) {
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 150, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [countdown]);

  const handleSubmit = () => {
    if (submitted || !input.trim()) return;
    const num = parseFloat(input.trim());
    if (isNaN(num)) return;
    setSubmitted(true);
    if (timerRef.current) clearInterval(timerRef.current);
    onSubmitAnswer(num);
  };

  const handleNumpad = (val: string) => {
    if (submitted) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (val === 'DEL') {
      setInput((prev) => prev.slice(0, -1));
    } else if (val === 'GO') {
      handleSubmit();
    } else {
      setInput((prev) => prev + val);
    }
  };

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

  const numpadKeys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['-', '0', '.'],
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onQuit} style={styles.quitBtn} activeOpacity={0.7}>
          <Ionicons name="close" size={20} color="#ff4757" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Math Quiz</Text>
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

      {/* Timer */}
      <Animated.View style={[styles.timerContainer, { transform: [{ scale: pulseAnim }] }]}>
        <Text style={[styles.timerText, countdown <= 5 && { color: '#ff4757' }]}>
          {countdown}s
        </Text>
      </Animated.View>

      {/* Equation */}
      <LinearGradient
        colors={['rgba(108, 92, 231, 0.25)', 'rgba(60, 45, 150, 0.1)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.equationCard}
      >
        <Text style={styles.equationText}>{round.equation}</Text>
      </LinearGradient>

      {/* Input display */}
      <View style={styles.inputDisplay}>
        <Text style={styles.inputText}>{input || '?'}</Text>
        {submitted && !roundResult && (
          <View style={styles.submittedBadge}>
            <Ionicons name="checkmark-circle" size={20} color="#ffa502" />
            <Text style={[styles.submittedText, { color: '#ffa502' }]}>Waiting for opponent...</Text>
          </View>
        )}
        {roundResult && roundResult.gameType === 'math' && (
          <View style={styles.resultFeedback}>
            {(() => {
              if (roundResult.winnerId === localId) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } else if (roundResult.winnerId !== 'tie') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              }
              return null;
            })()}
            <Text style={styles.correctAnswerLabel}>Correct Answer: {roundResult.correctAnswer}</Text>
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
          </View>
        )}
      </View>

      {/* Numpad */}
      <View style={styles.numpad}>
        {numpadKeys.map((row, ri) => (
          <View key={ri} style={styles.numpadRow}>
            {row.map((key) => (
              <TouchableOpacity
                key={key}
                style={styles.numKey}
                onPress={() => handleNumpad(key)}
                activeOpacity={0.6}
                disabled={submitted}
              >
                <Text style={styles.numKeyText}>{key}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
        <View style={styles.numpadRow}>
          <TouchableOpacity
            style={[styles.numKey, styles.delKey]}
            onPress={() => handleNumpad('DEL')}
            activeOpacity={0.6}
            disabled={submitted}
          >
            <Ionicons name="backspace" size={22} color="#ff4757" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.numKey, styles.goKey, submitted && { opacity: 0.4 }]}
            onPress={() => handleNumpad('GO')}
            activeOpacity={0.6}
            disabled={submitted}
          >
            <Text style={styles.goKeyText}>GO</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a1a',
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
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
    marginBottom: 12,
    gap: 16,
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
  timerContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  timerText: {
    color: '#ffa502',
    fontSize: 20,
    fontWeight: '800',
  },
  equationCard: {
    borderWidth: 1.5,
    borderColor: 'rgba(108, 92, 231, 0.5)',
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#6c5ce7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  equationText: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 2,
  },
  inputDisplay: {
    alignItems: 'center',
    marginBottom: 16,
  },
  inputText: {
    color: '#a855f7',
    fontSize: 36,
    fontWeight: '800',
    minHeight: 44,
  },
  submittedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  submittedText: {
    color: '#2ed573',
    fontSize: 13,
    fontWeight: '600',
  },
  numpad: {
    gap: 8,
  },
  numpadRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  numKey: {
    width: 72,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(20, 20, 50, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(108, 92, 231, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numKeyText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '600',
  },
  delKey: {
    flex: 1,
    backgroundColor: 'rgba(255, 71, 87, 0.1)',
    borderColor: 'rgba(255, 71, 87, 0.2)',
  },
  goKey: {
    flex: 2,
    backgroundColor: '#6c5ce7',
    borderColor: '#6c5ce7',
  },
  goKeyText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
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
  resultFeedback: {
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  correctAnswerLabel: {
    color: '#8888bb',
    fontSize: 14,
    fontWeight: '600',
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
});
