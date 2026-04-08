import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

const AVATARS = [
  { id: 1, source: require('@/assets/char_1.png'), label: 'Blue Hoodie' },
  { id: 2, source: require('@/assets/char_2.png'), label: 'Suit' },
  { id: 3, source: require('@/assets/char_3.png'), label: 'Sporty' },
  { id: 4, source: require('@/assets/char_4.png'), label: 'Explorer' },
  { id: 5, source: require('@/assets/char_5.png'), label: 'Scientist' },
];

export default function LobbyScreen() {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(1);

  const handleJoin = () => {
    const trimmed = nickname.trim();
    if (!trimmed) {
      Alert.alert('Hold on!', 'Please enter a nickname to continue.');
      return;
    }
    if (trimmed.length < 2 || trimmed.length > 16) {
      Alert.alert('Invalid Name', 'Nickname must be 2–16 characters.');
      return;
    }
    router.push({
      pathname: '/game',
      params: { nickname: trimmed, avatarId: selectedAvatar.toString() },
    });
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0a0a1a', '#121230', '#1a1a40']}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        {/* Title */}
        <View style={styles.titleContainer}>
          <Ionicons name="flash" size={48} color="#a855f7" />
          <Text style={styles.title}>EchoGrid</Text>
          <Text style={styles.subtitle}>Spatial Metaverse</Text>
        </View>

        {/* Nickname Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>YOUR NAME</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter nickname..."
            placeholderTextColor="#555580"
            value={nickname}
            onChangeText={setNickname}
            maxLength={16}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Avatar Selection */}
        <View style={styles.avatarSection}>
          <Text style={styles.label}>CHOOSE AVATAR</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.avatarScroll}
          >
            {AVATARS.map((avatar) => (
              <TouchableOpacity
                key={avatar.id}
                style={[
                  styles.avatarCard,
                  selectedAvatar === avatar.id && styles.avatarCardSelected,
                ]}
                onPress={() => setSelectedAvatar(avatar.id)}
                activeOpacity={0.7}
              >
                <Image source={avatar.source} style={styles.avatarImage} />
                <Text
                  style={[
                    styles.avatarLabel,
                    selectedAvatar === avatar.id && styles.avatarLabelSelected,
                  ]}
                >
                  {avatar.label}
                </Text>
                {selectedAvatar === avatar.id && (
                  <View style={styles.checkBadge}>
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Join Button */}
        <TouchableOpacity
          style={[
            styles.joinButton,
            !nickname.trim() && styles.joinButtonDisabled,
          ]}
          onPress={handleJoin}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={
              nickname.trim()
                ? ['#6c5ce7', '#a855f7']
                : ['#333355', '#333355']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.joinGradient}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.joinText}>Join Room</Text>
              <Ionicons name="arrow-forward" size={18} color="#ffffff" />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        <Text style={styles.footerHint}>
          Move close to others to start talking
        </Text>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 48,
    marginBottom: 8,
  },
  title: {
    fontSize: 42,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 14,
    color: '#8888bb',
    marginTop: 6,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  inputContainer: {
    marginBottom: 28,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6c5ce7',
    letterSpacing: 2,
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#16162a',
    borderWidth: 1.5,
    borderColor: '#2a2a50',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 17,
    color: '#ffffff',
  },
  avatarSection: {
    marginBottom: 32,
  },
  avatarScroll: {
    paddingVertical: 8,
    gap: 12,
  },
  avatarCard: {
    width: 90,
    height: 120,
    backgroundColor: '#16162a',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#2a2a50',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  avatarCardSelected: {
    borderColor: '#6c5ce7',
    backgroundColor: '#1e1e3a',
    shadowColor: '#6c5ce7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  avatarImage: {
    width: 56,
    height: 56,
    resizeMode: 'contain',
  },
  avatarLabel: {
    fontSize: 10,
    color: '#666690',
    marginTop: 6,
    fontWeight: '600',
  },
  avatarLabelSelected: {
    color: '#a855f7',
  },
  checkBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#6c5ce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  joinButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  joinButtonDisabled: {
    opacity: 0.5,
  },
  joinGradient: {
    paddingVertical: 18,
    alignItems: 'center',
    borderRadius: 16,
  },
  joinText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1,
  },
  footerHint: {
    textAlign: 'center',
    color: '#555580',
    fontSize: 13,
  },
});
