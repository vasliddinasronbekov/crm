import React, { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@eduvoice/mobile-shared';

interface GlassCardProps {
  children?: any;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, onPress, style }) => {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const content = (
    <>
      <View pointerEvents="none" style={styles.topGlow} />
      <View pointerEvents="none" style={styles.bottomGlow} />
      <View pointerEvents="none" style={styles.sideAccent} />
      <View style={styles.contentWrap}>{children}</View>
    </>
  );

  if (onPress === undefined) {
    return <View style={[styles.card, style]}>{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, style, pressed && styles.cardPressed]}
    >
      {content}
    </Pressable>
  );
};

const createStyles = (theme: any, isDark: boolean) =>
  StyleSheet.create({
    card: {
      backgroundColor: isDark ? 'rgba(18, 26, 42, 0.86)' : 'rgba(255, 255, 255, 0.92)',
      borderRadius: 22,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(148, 163, 184, 0.22)' : 'rgba(148, 163, 184, 0.26)',
      overflow: 'hidden',
      ...theme.shadows.lg,
    },
    contentWrap: {
      position: 'relative',
      zIndex: 2,
    },
    topGlow: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '48%',
      backgroundColor: isDark ? 'rgba(96, 165, 250, 0.09)' : 'rgba(219, 234, 254, 0.72)',
    },
    bottomGlow: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: '36%',
      backgroundColor: isDark ? 'rgba(30, 41, 59, 0.42)' : 'rgba(248, 250, 252, 0.72)',
    },
    sideAccent: {
      position: 'absolute',
      top: 10,
      right: 10,
      width: 54,
      height: 8,
      borderRadius: 999,
      backgroundColor: isDark ? 'rgba(147, 197, 253, 0.42)' : 'rgba(59, 130, 246, 0.38)',
      zIndex: 1,
    },
    cardPressed: {
      opacity: 0.985,
      transform: [{ scale: 0.995 }],
    },
  });
