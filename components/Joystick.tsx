import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';

const JOYSTICK_SIZE = 140;
const KNOB_SIZE = 56;
const MAX_DISTANCE = (JOYSTICK_SIZE - KNOB_SIZE) / 2;

export type JoystickDirection = 'up' | 'down' | 'left' | 'right' | 'idle';

interface JoystickProps {
  onMove: (dx: number, dy: number, direction: JoystickDirection) => void;
  onRelease: () => void;
}

function getDirection(dx: number, dy: number): JoystickDirection {
  'worklet';
  if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return 'idle';
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  }
  return dy > 0 ? 'down' : 'up';
}

export default function Joystick({ onMove, onRelease }: JoystickProps) {
  const knobX = useSharedValue(0);
  const knobY = useSharedValue(0);

  const handleMove = useCallback(
    (dx: number, dy: number, dir: JoystickDirection) => {
      onMove(dx, dy, dir);
    },
    [onMove]
  );

  const handleRelease = useCallback(() => {
    onRelease();
  }, [onRelease]);

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      const dist = Math.sqrt(e.translationX ** 2 + e.translationY ** 2);
      const clampedDist = Math.min(dist, MAX_DISTANCE);
      const angle = Math.atan2(e.translationY, e.translationX);
      const x = clampedDist * Math.cos(angle);
      const y = clampedDist * Math.sin(angle);

      knobX.value = x;
      knobY.value = y;

      const normalizedX = x / MAX_DISTANCE;
      const normalizedY = y / MAX_DISTANCE;
      const dir = getDirection(x, y);

      runOnJS(handleMove)(normalizedX, normalizedY, dir);
    })
    .onEnd(() => {
      knobX.value = withSpring(0, { damping: 15, stiffness: 150 });
      knobY.value = withSpring(0, { damping: 15, stiffness: 150 });
      runOnJS(handleRelease)();
    });

  const knobStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: knobX.value },
      { translateY: knobY.value },
    ],
  }));

  return (
    <View style={styles.container}>
      <View style={styles.base}>
        {/* Direction markers */}
        <View style={[styles.dirMarker, styles.markerUp]} />
        <View style={[styles.dirMarker, styles.markerDown]} />
        <View style={[styles.dirMarker, styles.markerLeft]} />
        <View style={[styles.dirMarker, styles.markerRight]} />

        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.knob, knobStyle]} />
        </GestureDetector>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 40,
    left: 24,
    zIndex: 100,
  },
  base: {
    width: JOYSTICK_SIZE,
    height: JOYSTICK_SIZE,
    borderRadius: JOYSTICK_SIZE / 2,
    backgroundColor: 'rgba(20, 20, 50, 0.7)',
    borderWidth: 2,
    borderColor: 'rgba(108, 92, 231, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  knob: {
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    backgroundColor: 'rgba(108, 92, 231, 0.8)',
    borderWidth: 2,
    borderColor: 'rgba(168, 85, 247, 0.6)',
    shadowColor: '#6c5ce7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 6,
  },
  dirMarker: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(108, 92, 231, 0.3)',
  },
  markerUp: { top: 12 },
  markerDown: { bottom: 12 },
  markerLeft: { left: 12 },
  markerRight: { right: 12 },
});
