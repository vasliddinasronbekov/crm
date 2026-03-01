// packages/mobile-ui/src/components/CourseCard.tsx

import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { theme } from '../theme';

interface CourseCardProps {
  title: string;
  teacher?: string;
  progress?: number; // 0 to 1
  imageUrl?: string;
}

export const CourseCard: React.FC<CourseCardProps> = ({
  title,
  teacher,
  progress = 0,
  imageUrl,
}) => {
  return (
    <View style={styles.container}>
      <Image
        source={{ uri: imageUrl || 'https://via.placeholder.com/150' }}
        style={styles.image}
      />
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {teacher && <Text style={styles.teacher}>{teacher}</Text>}
        {progress > 0 && (
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.white,
    marginBottom: theme.spacing.md,
    ...theme.shadows.md,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 150,
  },
  content: {
    padding: theme.spacing.md,
  },
  title: {
    ...theme.typography.h3,
    marginBottom: theme.spacing.xs,
  },
  teacher: {
    ...theme.typography.body,
    color: theme.colors.gray600,
    marginBottom: theme.spacing.md,
  },
  progressContainer: {
    height: 8,
    width: '100%',
    backgroundColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.round,
  },
  progressBar: {
    height: '100%',
    backgroundColor: theme.colors.primary500,
    borderRadius: theme.borderRadius.round,
  },
});
