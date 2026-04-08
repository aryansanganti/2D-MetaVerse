import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated as RNAnimated,
  ImageSourcePropType,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const AVATAR_SOURCES: Record<number, ImageSourcePropType> = {
  1: require('@/assets/char_1.png'),
  2: require('@/assets/char_2.png'),
  3: require('@/assets/char_3.png'),
  4: require('@/assets/char_4.png'),
  5: require('@/assets/char_5.png'),
};

interface AvatarProps {
  x: number;
  y: number;
  avatarId: number;
  nickname: string;
  isLocal: boolean;
  isNearby?: boolean;
  playerId?: string;
  onChat?: (playerId: string) => void;
  onChallenge?: (playerId: string, game: 'math' | 'memory') => void;
}

export default function Avatar({
  x,
  y,
  avatarId,
  nickname,
  isLocal,
  isNearby = false,
  playerId,
  onChat,
  onChallenge,
}: AvatarProps) {
  const animX = useRef(new RNAnimated.Value(x)).current;
  const animY = useRef(new RNAnimated.Value(y)).current;
  const [menuOpen, setMenuOpen] = useState(false);
  const [showGamePicker, setShowGamePicker] = useState(false);

  useEffect(() => {
    if (isLocal) {
      animX.setValue(x);
      animY.setValue(y);
    } else {
      RNAnimated.parallel([
        RNAnimated.timing(animX, {
          toValue: x,
          duration: 120,
          useNativeDriver: true,
        }),
        RNAnimated.timing(animY, {
          toValue: y,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [x, y, isLocal]);

  // Close menu if player walks out of range
  useEffect(() => {
    if (!isNearby && menuOpen) {
      setMenuOpen(false);
      setShowGamePicker(false);
    }
  }, [isNearby, menuOpen]);

  const handleAvatarTap = () => {
    if (isLocal) return;
    if (!isNearby) return;
    setMenuOpen((prev) => !prev);
    setShowGamePicker(false);
  };

  const handleChat = () => {
    setMenuOpen(false);
    setShowGamePicker(false);
    if (playerId && onChat) onChat(playerId);
  };

  const handleChallengeSelect = (game: 'math' | 'memory') => {
    setMenuOpen(false);
    setShowGamePicker(false);
    if (playerId && onChallenge) onChallenge(playerId, game);
  };

  const source = AVATAR_SOURCES[avatarId] || AVATAR_SOURCES[1];

  return (
    <RNAnimated.View
      style={[
        styles.container,
        {
          transform: [{ translateX: animX }, { translateY: animY }],
          zIndex: isLocal ? 100 : menuOpen ? 150 : 50,
        },
      ]}
    >
      {/* Context Menu — floating above avatar */}
      {menuOpen && !isLocal && (
        <View style={styles.contextMenu}>
          {!showGamePicker ? (
            <>
              <TouchableOpacity style={styles.menuItem} onPress={handleChat} activeOpacity={0.7}>
                <Ionicons name="chatbubble" size={14} color="#a855f7" />
                <Text style={styles.menuText}>Chat</Text>
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => setShowGamePicker(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="game-controller" size={14} color="#ffa502" />
                <Text style={styles.menuText}>Challenge</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleChallengeSelect('math')}
                activeOpacity={0.7}
              >
                <Ionicons name="calculator" size={14} color="#2ed573" />
                <Text style={styles.menuText}>Math Quiz</Text>
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleChallengeSelect('memory')}
                activeOpacity={0.7}
              >
                <Ionicons name="grid" size={14} color="#ff6b81" />
                <Text style={styles.menuText}>Memory</Text>
              </TouchableOpacity>
            </>
          )}
          <View style={styles.menuArrow} />
        </View>
      )}

      {/* Proximity glow ring */}
      {isNearby && !isLocal && (
        <View style={styles.proximityRing} />
      )}

      {/* Nickname label */}
      <View style={[styles.nameTag, isLocal && styles.nameTagLocal]}>
        <Text style={styles.nameText} numberOfLines={1}>
          {isLocal ? `${nickname} (You)` : nickname}
        </Text>
      </View>

      {/* Avatar image — tappable for remote players */}
      <TouchableOpacity
        onPress={handleAvatarTap}
        activeOpacity={isLocal ? 1 : 0.7}
        disabled={isLocal}
      >
        <Image source={source} style={styles.avatarImage} />
      </TouchableOpacity>

      {/* Mic indicator for nearby users */}
      {isNearby && !isLocal && !menuOpen && (
        <View style={styles.micBadge}>
          <Ionicons name="mic" size={12} color="#2ed573" />
        </View>
      )}
    </RNAnimated.View>
  );
}

const AVATAR_SIZE = 48;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignItems: 'center',
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  avatarImage: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    resizeMode: 'contain',
  },
  nameTag: {
    position: 'absolute',
    top: -22,
    backgroundColor: 'rgba(10, 10, 30, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(108, 92, 231, 0.3)',
  },
  nameTagLocal: {
    borderColor: 'rgba(108, 92, 231, 0.7)',
    backgroundColor: 'rgba(108, 92, 231, 0.2)',
  },
  nameText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    maxWidth: 80,
  },
  proximityRing: {
    position: 'absolute',
    width: AVATAR_SIZE + 16,
    height: AVATAR_SIZE + 16,
    borderRadius: (AVATAR_SIZE + 16) / 2,
    borderWidth: 2,
    borderColor: 'rgba(46, 213, 115, 0.5)',
    top: -8,
    left: -8,
    backgroundColor: 'rgba(46, 213, 115, 0.08)',
  },
  micBadge: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(10, 10, 30, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextMenu: {
    position: 'absolute',
    bottom: AVATAR_SIZE + 28,
    alignSelf: 'center',
    backgroundColor: 'rgba(16, 16, 36, 0.97)',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(108, 92, 231, 0.4)',
    paddingVertical: 6,
    paddingHorizontal: 4,
    minWidth: 120,
    shadowColor: '#6c5ce7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
    borderRadius: 8,
  },
  menuText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  menuDivider: {
    height: 1,
    backgroundColor: 'rgba(108, 92, 231, 0.15)',
    marginHorizontal: 8,
  },
  menuArrow: {
    position: 'absolute',
    bottom: -6,
    alignSelf: 'center',
    width: 12,
    height: 12,
    backgroundColor: 'rgba(16, 16, 36, 0.97)',
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: 'rgba(108, 92, 231, 0.4)',
    transform: [{ rotate: '45deg' }],
    left: '50%',
    marginLeft: -6,
  },
});
