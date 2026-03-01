
import { useUnifiedChat } from '@/packages/hooks/chat/useUnifiedChat';

export function useTextChat() {
  return useUnifiedChat({
    mode: 'text',
    autoConnect: true,
  });
}

export type { ChatMessage } from '@/packages/hooks/chat/useUnifiedChat';