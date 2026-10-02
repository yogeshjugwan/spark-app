import { showLiveNotification, type LiveNote } from './live-notify';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';
import { create } from 'zustand';

import { useAuth } from './auth-store';
import { chatApi, chatKeys, type ChatMessage, type ChatUser, type Conversation, type GroupThread, type Thread } from './chat-api';
import { attachCallHandlers } from './calls';
import { attachGroupCallHandlers } from './group-calls';
import { API_URL } from './config';

let socket: Socket | null = null;

/** The live socket, if signed in and connected (used for call signalling). */
export function getSocket() {
  return socket;
}

const threadKey = (m: Pick<ChatMessage, 'groupId' | 'matchId'>) => (m.groupId ? chatKeys.groupThread(m.groupId) : chatKeys.thread(m.matchId!));

/**
 * Put a message into its cached thread exactly once. The REST reply and the socket echo both
 * arrive, and an optimistic copy (matched by clientId) is replaced by the server's.
 */
export function upsertMessage(qc: QueryClient, m: ChatMessage) {
  qc.setQueryData<Thread | GroupThread>(threadKey(m), (t) => {
    if (!t) return t;
    const i = t.messages.findIndex((x) => x.id === m.id || (!!m.clientId && x.clientId === m.clientId));
    if (i === -1) return { ...t, messages: [...t.messages, m] };
    const messages = t.messages.slice();
    messages[i] = m;
    return { ...t, messages };
  });
}

/** Change (or with `null`, drop) matching messages in a cached thread. */
export function patchMessage(
  qc: QueryClient,
  conv: Pick<ChatMessage, 'groupId' | 'matchId'>,
  match: (m: ChatMessage) => boolean,
  patch: (m: ChatMessage) => ChatMessage | null,
) {
  qc.setQueryData<Thread | GroupThread>(threadKey(conv), (t) => {
    if (!t) return t;
    const messages = t.messages.flatMap((m) => {
      if (!match(m)) return [m];
      const next = patch(m);
      return next ? [next] : [];
    });
    return { ...t, messages };
  });
}

// "typing…" per 1:1 chat, shown in the chat header and the chat list. Cleared after 3 s.
export const useTyping = create<{ typing: Record<number, number> }>(() => ({ typing: {} }));
const typingTimers = new Map<number, ReturnType<typeof setTimeout>>();
function setTyping(matchId: number, on: boolean) {
  clearTimeout(typingTimers.get(matchId));
  useTyping.setState((s) => {
    const typing = { ...s.typing };
    if (on) typing[matchId] = Date.now();
    else delete typing[matchId];
    return { typing };
  });
  if (on) typingTimers.set(matchId, setTimeout(() => setTyping(matchId, false), 3000));
}

let lastTypingSent = 0;
/** Throttled "I'm typing" signal to the other person. */
export function emitTyping(matchId: number) {
  if (Date.now() - lastTypingSent < 2000) return;
  lastTypingSent = Date.now();
  socket?.emit('typing', { matchId });
}

/** Update someone's presence wherever it's cached (chat list rows and open threads). */
function applyPresence(qc: QueryClient, e: { userId: number; online: boolean; lastSeenAt: string }) {
  const patchUser = (u: ChatUser) => (u.id === e.userId ? { ...u, online: e.online, lastSeenAt: e.lastSeenAt } : u);
  qc.setQueryData<Conversation[]>(chatKeys.list, (list) => list?.map((c) => (c.kind === 'match' ? { ...c, user: patchUser(c.user) } : c)));
  qc.setQueriesData<Thread | Conversation[]>({ queryKey: ['chats'] }, (t) => (t && !Array.isArray(t) && t.user ? { ...t, user: patchUser(t.user) } : t));
}

/** One socket for the signed-in session; keeps chat caches live. Mount once in the app layout. */
export function useChatSocket() {
  const qc = useQueryClient();
  const token = useAuth((s) => s.tokens?.accessToken);
  const me = useAuth((s) => s.user?.id);

  useEffect(() => {
    if (!token) return;
    const s = io(API_URL, { auth: { token }, transports: ['websocket'] });
    socket = s;

    s.on('message', (m: ChatMessage) => {
      upsertMessage(qc, m);
      if (m.matchId && m.senderId !== me) {
        setTyping(m.matchId, false);
        chatApi.markDelivered(m.matchId, m.id).catch(() => {}); // ✓✓ for the sender
      }
      qc.invalidateQueries({ queryKey: chatKeys.list, exact: true });
    });
    s.on('notify', (n: LiveNote) => showLiveNotification(n));
    s.on('message:update', (m: ChatMessage) => {
      upsertMessage(qc, m);
      qc.invalidateQueries({ queryKey: chatKeys.list, exact: true });
    });
    const bump = (matchId: number, patch: { otherLastDelivered: number; otherLastRead?: number }) => {
      const merge = <T extends { otherLastDelivered: number; otherLastRead: number }>(x: T): T => ({
        ...x,
        otherLastDelivered: Math.max(x.otherLastDelivered, patch.otherLastDelivered),
        otherLastRead: Math.max(x.otherLastRead, patch.otherLastRead ?? 0),
      });
      qc.setQueryData<Thread>(chatKeys.thread(matchId), (t) => (t ? merge(t) : t));
      qc.setQueryData<Conversation[]>(chatKeys.list, (list) => list?.map((c) => (c.kind === 'match' && c.matchId === matchId ? merge(c) : c)));
    };
    s.on('delivered', (e: { matchId: number; messageId: number }) => bump(e.matchId, { otherLastDelivered: e.messageId }));
    s.on('read', (e: { matchId: number; messageId: number }) => bump(e.matchId, { otherLastDelivered: e.messageId, otherLastRead: e.messageId }));
    s.on('presence', (e: { userId: number; online: boolean; lastSeenAt: string }) => applyPresence(qc, e));
    // Group created/renamed/membership changed.
    s.on('group', (e: { groupId: number }) => {
      qc.invalidateQueries({ queryKey: chatKeys.list, exact: true });
      qc.invalidateQueries({ queryKey: chatKeys.groupThread(e.groupId) });
    });
    s.on('typing', (e: { matchId: number; userId: number }) => setTyping(e.matchId, true));
    // Pinned message, disappearing timer, view-once opens: refetch the chat's state.
    const refreshState = (e: { kind: 'match' | 'group'; id: number }) => qc.invalidateQueries({ queryKey: chatKeys.state(e) });
    s.on('pin', refreshState);
    s.on('disappearing', refreshState);
    s.on('prefs', () => {
      qc.invalidateQueries({ queryKey: chatKeys.list, exact: true });
      qc.invalidateQueries({ queryKey: ['conv-state'] });
    });
    s.on('opened', () => qc.invalidateQueries({ queryKey: ['conv-state'] }));
    s.on('story', () => qc.invalidateQueries({ queryKey: chatKeys.stories }));
    s.on('story:view', () => qc.invalidateQueries({ queryKey: chatKeys.stories }));
    // After a reconnect (network blip, app back from background) refetch what we may have missed.
    s.io.on('reconnect', () => {
      qc.invalidateQueries({ queryKey: ['chats'] });
      qc.invalidateQueries({ queryKey: ['groups'] });
    });
    attachCallHandlers(s);
    attachGroupCallHandlers(s, (groupId) => qc.invalidateQueries({ queryKey: ['group-call', groupId] }));
    return () => {
      s.disconnect();
      if (socket === s) socket = null;
    };
  }, [token, qc, me]);
}
