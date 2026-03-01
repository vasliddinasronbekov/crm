import React from 'react';

import { LessonCollectionScreen } from '../components/learning/LessonCollectionScreen';

export const ArticlesScreen = () => (
  <LessonCollectionScreen
    kind="article"
    title="Articles & Notes"
    subtitle="Open short lessons, reading passages, and article-style content from the same study library."
    icon="text-box-multiple-outline"
    accentColor="#7c3aed"
  />
);
