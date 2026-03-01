import { lessonService } from '@eduvoice/mobile-shared';

import type { Lesson } from '../types';

export type LessonCollectionKind = 'book' | 'video' | 'article';

export const normalizeLessonType = (lessonType?: string): LessonCollectionKind | 'audio' | 'quiz' | 'assignment' | 'interactive' => {
  switch (lessonType) {
    case 'text':
    case 'article':
      return 'article';
    case 'book':
      return 'book';
    case 'video':
      return 'video';
    case 'audio':
      return 'audio';
    case 'quiz':
      return 'quiz';
    case 'assignment':
      return 'assignment';
    default:
      return 'interactive';
  }
};

export const filterLessonsByKind = (lessons: Lesson[], kind: LessonCollectionKind): Lesson[] =>
  lessons.filter((lesson) => normalizeLessonType(lesson.lesson_type) === kind);

export const fetchLessonCollection = async (kind: LessonCollectionKind): Promise<Lesson[]> => {
  const requestedType = kind === 'article' ? 'article' : kind;
  const targeted = await lessonService.getLessons({
    lesson_type: requestedType,
    page_size: 200,
  });

  const normalizedTargeted = filterLessonsByKind(targeted.results || [], kind);
  if (normalizedTargeted.length > 0 || kind !== 'article') {
    return normalizedTargeted;
  }

  const allLessons = await lessonService.getLessons({ page_size: 500 });
  return filterLessonsByKind(allLessons.results || [], kind);
};

export const getLessonCompletion = (lesson: Lesson): number =>
  lesson.student_progress?.completion_percentage || 0;

export const getLessonModuleTitle = (lesson: Lesson): string =>
  lesson.module_title || lesson.module_name || `Module ${lesson.module}`;

export const getLessonDurationSeconds = (lesson: Lesson): number =>
  lesson.video_duration_seconds || lesson.video_duration || lesson.duration_minutes * 60 || 0;

export const formatDuration = (seconds: number): string => {
  if (!seconds) return '0m';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${secs > 0 ? `${secs}s` : ''}`.trim();
  }

  return `${secs}s`;
};

export const stripHtml = (content?: string): string => {
  if (!content) return '';
  return content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
};
