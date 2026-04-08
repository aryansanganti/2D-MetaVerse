import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ChallengeInvite, GameResult, GameType } from '@/hooks/useChallenge';

interface ChallengeModalProps {
  // Incoming invite
  pendingInvite: ChallengeInvite | null;
  onAccept: () => void;
  onDecline: () => void;
  // Sending state
  isSending: boolean;
  // Game result
  gameResult: GameResult | null;
  localId: string;
  onDismissResult: () => void;
}

export default function ChallengeModal({
  pendingInvite,
  onAccept,
  onDecline,
  isSending,
  gameResult,
  localId,
  onDismissResult,
}: ChallengeModalProps) {
  // Show game result
  if (gameResult) {
    const didWin = gameResult.winnerId === localId;
    return (
      <Modal transparent animationType="fade" visible>
        <View style={styles.overlay}>
          <LinearGradient colors={['rgba(30, 25, 60, 0.95)', 'rgba(15, 12, 35, 0.98)']} style={styles.card}>
            <View style={[styles.resultIcon, { backgroundColor: didWin ? 'rgba(46, 213, 115, 0.15)' : 'rgba(255, 71, 87, 0.15)' }]}>
              <Ionicons
                name={didWin ? 'trophy' : 'sad'}
                size={48}
                color={didWin ? '#2ed573' : '#ff4757'}
              />
            </View>
            <Text style={styles.resultTitle}>
              {didWin ? 'You Won!' : 'You Lost!'}
            </Text>
            <Text style={styles.resultSubtitle}>
              {didWin
                ? `You beat ${gameResult.loserName}!`
                : `${gameResult.winnerName} won this round.`}
            </Text>
            {gameResult.reason ? (
              <Text style={styles.resultReason}>{gameResult.reason}</Text>
            ) : null}
            <TouchableOpacity style={styles.primaryButton} onPress={onDismissResult} activeOpacity={0.7}>
              <Text style={styles.primaryButtonText}>Back to Map</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>
    );
  }

  // Show incoming invite
  if (pendingInvite) {
    const gameName = pendingInvite.gameType === 'math' ? 'Math Quiz' : 'Memory Boxes';
    const gameIcon = pendingInvite.gameType === 'math' ? 'calculator' : 'grid';
    const gameColor = pendingInvite.gameType === 'math' ? '#2ed573' : '#ff6b81';

    return (
      <Modal transparent animationType="fade" visible>
        <View style={styles.overlay}>
          <LinearGradient colors={['rgba(30, 25, 60, 0.95)', 'rgba(15, 12, 35, 0.98)']} style={styles.card}>
            <View style={[styles.iconCircle, { backgroundColor: `${gameColor}20` }]}>
              <Ionicons name={gameIcon as any} size={32} color={gameColor} />
            </View>
            <Text style={styles.title}>Challenge!</Text>
            <Text style={styles.subtitle}>
              <Text style={styles.bold}>{pendingInvite.fromName}</Text> challenged you to
            </Text>
            <Text style={[styles.gameName, { color: gameColor }]}>{gameName}</Text>

            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.declineButton} onPress={onDecline} activeOpacity={0.7}>
                <Ionicons name="close" size={18} color="#ff4757" />
                <Text style={styles.declineText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.acceptButton} onPress={onAccept} activeOpacity={0.7}>
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text style={styles.acceptText}>Accept</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </Modal>
    );
  }

  // Show sending/waiting state
  if (isSending) {
    return (
      <Modal transparent animationType="fade" visible>
        <View style={styles.overlay}>
          <LinearGradient colors={['rgba(30, 25, 60, 0.95)', 'rgba(15, 12, 35, 0.98)']} style={styles.card}>
            <Ionicons name="hourglass" size={36} color="#ffa502" />
            <Text style={styles.title}>Waiting...</Text>
            <Text style={styles.subtitle}>Waiting for opponent to respond</Text>
          </LinearGradient>
        </View>
      </Modal>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(108, 92, 231, 0.5)',
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },
  subtitle: {
    color: '#8888bb',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  bold: {
    color: '#ffffff',
    fontWeight: '700',
  },
  gameName: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  declineButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 71, 87, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 71, 87, 0.3)',
  },
  declineText: {
    color: '#ff4757',
    fontSize: 15,
    fontWeight: '700',
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#6c5ce7',
  },
  acceptText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  resultIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  resultTitle: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 4,
  },
  resultSubtitle: {
    color: '#8888bb',
    fontSize: 14,
    marginBottom: 4,
  },
  resultReason: {
    color: '#666690',
    fontSize: 12,
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: '#6c5ce7',
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 14,
    marginTop: 16,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
