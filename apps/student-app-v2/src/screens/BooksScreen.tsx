import React from 'react';

import { LessonCollectionScreen } from '../components/learning/LessonCollectionScreen';

export const BooksScreen = () => (
  <LessonCollectionScreen
    kind="book"
    title="Books & eBooks"
    subtitle="Read structured lesson books, handouts, and long-form study material with progress-aware access."
    icon="book-open-page-variant-outline"
    accentColor="#16a34a"
  />
);
