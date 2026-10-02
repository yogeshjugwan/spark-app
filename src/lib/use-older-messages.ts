import { useMemo, useRef, useState } from 'react';

import type { ChatMessage } from './chat-api';

/**
 * Older-message paging for a chat. The newest page lives in the React Query cache (the socket
 * appends to it); scrolling up prepends older pages here. Returns everything oldest → newest.
 */
export function useOlderMessages(
  newest: { messages: ChatMessage[]; hasMore: boolean } | undefined,
  fetchBefore: (id: number) => Promise<{ messages: ChatMessage[]; hasMore: boolean }>,
) {
  const [older, setOlder] = useState<ChatMessage[]>([]);
  const [hasOlder, setHasOlder] = useState(true);
  const loading = useRef(false);

  const loadOlder = async () => {
    const first = older[0] ?? newest?.messages[0];
    if (!first || !hasOlder || !newest?.hasMore || loading.current) return;
    loading.current = true;
    try {
      const page = await fetchBefore(first.id);
      setOlder((p) => [...page.messages, ...p]);
      setHasOlder(page.hasMore);
    } catch {
      // Scrolling up again retries.
    } finally {
      loading.current = false;
    }
  };

  const messages = useMemo(() => [...older, ...(newest?.messages ?? [])], [older, newest]);
  return { messages, loadOlder };
}
