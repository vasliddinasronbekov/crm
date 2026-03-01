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
      <View pointerEvents="none" style={styles.shine} />
      <View pointerEvents="none" style={styles.orb} />
      <View style={styles.contentWrap}>{children}</View>
    </>
  );

  if (!onPress) {
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
      backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.78)',
      borderRadius: 26,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.82)',
      overflow: 'hidden',
      ...theme.shadows.lg,
    },
    contentWrap: {
      position: 'relative',
      zIndex: 2,
    },
    shine: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '42%',
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.32)',
    },
    orb: {
      position: 'absolute',
      top: -36,
      right: -18,
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.36)',
      zIndex: 1,
    },
    cardPressed: {
      opacity: 0.96,
      transform: [{ scale: 0.99 }],
    },
  });
