import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

interface ProximityIndicatorProps {
  x: number;
  y: number;
  radius: number;
  hasNearbyUsers: boolean;
}

export default function ProximityIndicator({
  x,
  y,
  radius,
  hasNearbyUsers,
}: ProximityIndicatorProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.15)).current;

  useEffect(() => {
    if (hasNearbyUsers) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pulseAnim, {
              toValue: 1.08,
              duration: 1200,
              useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
              toValue: 0.25,
              duration: 1200,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 1200,
              useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
              toValue: 0.1,
              duration: 1200,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
      opacityAnim.setValue(0.08);
    }
  }, [hasNearbyUsers]);

  const size = radius * 2;

  return (
    <Animated.View
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: radius,
          left: x + 24 - radius, // offset to center on avatar (AVATAR_SIZE/2 = 24)
          top: y + 24 - radius,
          opacity: opacityAnim,
          transform: [{ scale: pulseAnim }],
          borderColor: hasNearbyUsers
            ? 'rgba(46, 213, 115, 0.4)'
            : 'rgba(108, 92, 231, 0.2)',
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
    backgroundColor: 'transparent',
    zIndex: 5,
  },
});
