import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useAuth } from './auth-store';
import { chatApi, chatKeys, convApi, newClientId, type ChatMessage, type MessageData, type MessageType, type RichContent, type SendOpts } from './chat-api';
import { patchMessage, upsertMessage } from './use-chat-socket';

export type ConversationRef = { kind: 'match'; id: number } | { kind: 'group'; id: number };
export type Draft =
  | { type: 'text'; body: string; mentions?: number[] }
  | { type: 'image'; uri: string; caption?: string; viewOnce?: boolean; albumId?: string; width?: number; height?: number }
  | { type: 'video'; uri: string; durationSec?: number; caption?: string; viewOnce?: boolean }
  | { type: 'voice'; uri: string; durationSec: number; viewOnce?: boolean; waveform?: string }
  | { type: 'file'; uri: string; name: string; mime: string; size: number }
  | Exclude<RichContent, { type: 'text' }>;

const where = (c: ConversationRef) => (c.kind === 'group' ? { groupId: c.id, matchId: null } : { matchId: c.id, groupId: null });

function post(c: ConversationRef, d: Draft, o: SendOpts) {
  switch (d.type) {
    case 'image':
      return convApi.media(c, 'image', { uri: d.uri, name: 'photo.jpg', type: 'image/jpeg' }, { ...o, caption: d.caption, viewOnce: d.viewOnce, albumId: d.albumId });
    case 'video':
      return convApi.media(c, 'video', { uri: d.uri, name: 'video.mp4', type: 'video/mp4' }, { ...o, caption: d.caption, viewOnce: d.viewOnce, durationSec: d.durationSec });
    case 'voice':
      return convApi.media(c, 'voice', { uri: d.uri, name: 'voice.m4a', type: 'audio/mp4' }, { ...o, durationSec: d.durationSec, viewOnce: d.viewOnce, waveform: d.waveform });
    case 'file':
      return convApi.media(c, 'file', { uri: d.uri, name: d.name, type: d.mime }, o);
    default:
      return convApi.send(c, d, o);
  }
}

/** What the optimistic bubble looks like before the server answers. */
function optimisticContent(d: Draft): { type: MessageType; body: string | null; localUri?: string; durationSec: number | null; meta: string | null; data: MessageData | null; viewOnce: boolean } {
  const base = { durationSec: null, meta: null, data: null, viewOnce: false, body: null };
  switch (d.type) {
    case 'text':
      return { ...base, type: 'text', body: d.body, data: d.mentions?.length ? { mentions: d.mentions } : null };
    case 'image':
      return { ...base, type: 'image', body: d.caption ?? null, localUri: d.uri, viewOnce: !!d.viewOnce, data: { albumId: d.albumId, width: d.width, height: d.height } };
    case 'video':
      return { ...base, type: 'video', body: d.caption ?? null, localUri: d.uri, durationSec: d.durationSec ?? null, viewOnce: !!d.viewOnce };
    case 'voice':
      return { ...base, type: 'voice', localUri: d.uri, durationSec: d.durationSec, viewOnce: !!d.viewOnce, data: d.waveform ? { waveform: d.waveform } : null };
    case 'file':
      return { ...base, type: 'file', localUri: d.uri, data: { name: d.name, size: d.size, mime: d.mime } };
    case 'location':
      return { ...base, type: 'location', data: { lat: d.lat, lng: d.lng, label: d.label ?? null, live: !!d.liveMinutes } };
    case 'contact':
      return { ...base, type: 'contact', data: { name: d.name, phone: d.phone } };
    case 'poll':
      return { ...base, type: 'poll', body: d.question, data: { question: d.question, options: d.options, multi: d.multi } };
    case 'sticker':
      return { ...base, type: 'sticker', meta: d.code };
    case 'gif':
      return { ...base, type: 'image', data: { gif: d.url, width: d.width, height: d.height } };
  }
}

/**
 * WhatsApp-style sending for one conversation: the bubble appears instantly (⏱), becomes the
 * server's message on success (✓), or turns red with a retry on failure. Retries reuse the same
 * clientId, so the server never stores a message twice.
 */
export function useConversation(conv: ConversationRef) {
  const qc = useQueryClient();
  const me = useAuth((s) => s.user?.id ?? 0);
  // Drafts of failed messages, keyed by clientId, so "retry" can resend them.
  const drafts = useDrafts();

  const deliverDraft = useCallback(
    async (clientId: string, draft: Draft, replyToId?: number): Promise<ChatMessage | null> => {
      try {
        const res = await post(conv, draft, { clientId, replyToId });
        upsertMessage(qc, res.data.message);
        drafts.delete(clientId);
        qc.invalidateQueries({ queryKey: chatKeys.list, exact: true });
        return res.data.message;
      } catch {
        patchMessage(qc, where(conv), (m) => m.clientId === clientId, (m) => ({ ...m, status: 'failed' }));
        return null;
      }
    },
    [conv, qc, drafts],
  );

  const send = useCallback(
    (draft: Draft, replyTo?: ChatMessage | null) => {
      const clientId = newClientId();
      const optimistic: ChatMessage = {
        id: -Date.now(),
        clientId,
        ...where(conv),
        senderId: me,
        ...optimisticContent(draft),
        url: null,
        deleted: false,
        replyTo: replyTo
          ? { id: replyTo.id, senderId: replyTo.senderId, type: replyTo.type, body: replyTo.body, meta: replyTo.meta, deleted: replyTo.deleted }
          : null,
        reactions: [],
        votes: [],
        editedAt: null,
        forwarded: false,
        expiresAt: null,
        createdAt: new Date().toISOString(),
        status: 'sending',
      };
      upsertMessage(qc, optimistic);
      drafts.set(clientId, { draft, replyToId: replyTo?.id });
      return deliverDraft(clientId, draft, replyTo?.id);
    },
    [conv, me, qc, drafts, deliverDraft],
  );

  const retry = useCallback(
    (m: ChatMessage) => {
      const saved = m.clientId ? drafts.get(m.clientId) : undefined;
      if (!saved || !m.clientId) return;
      patchMessage(qc, where(conv), (x) => x.clientId === m.clientId, (x) => ({ ...x, status: 'sending' }));
      deliverDraft(m.clientId, saved.draft, saved.replyToId);
    },
    [conv, qc, drafts, deliverDraft],
  );

  /** Drop a failed message that was never sent. */
  const discard = useCallback(
    (m: ChatMessage) => {
      if (m.clientId) drafts.delete(m.clientId);
      patchMessage(qc, where(conv), (x) => x.clientId === m.clientId, () => null);
    },
    [conv, qc, drafts],
  );

  const react = useCallback(
    async (m: ChatMessage, emoji: string | null) => {
      // Show it straight away; the server's broadcast confirms (or reverts on failure).
      const before = m.reactions;
      const reactions = [...m.reactions.filter((r) => r.userId !== me), ...(emoji ? [{ userId: me, emoji }] : [])];
      patchMessage(qc, where(conv), (x) => x.id === m.id, (x) => ({ ...x, reactions }));
      try {
        upsertMessage(qc, (await chatApi.react(m.id, emoji)).data.message);
      } catch {
        patchMessage(qc, where(conv), (x) => x.id === m.id, (x) => ({ ...x, reactions: before }));
      }
    },
    [conv, me, qc],
  );

  const remove = useCallback(
    async (m: ChatMessage, forEveryone: boolean) => {
      if (forEveryone) {
        const res = await chatApi.deleteMessage(m.id, true);
        if (res.data.message) upsertMessage(qc, res.data.message);
      } else {
        patchMessage(qc, where(conv), (x) => x.id === m.id, () => null);
        await chatApi.deleteMessage(m.id, false);
      }
      qc.invalidateQueries({ queryKey: chatKeys.list, exact: true });
    },
    [conv, qc],
  );

  /** Edit shows immediately; the server copy replaces it (or it reverts). */
  const edit = useCallback(
    async (m: ChatMessage, body: string) => {
      patchMessage(qc, where(conv), (x) => x.id === m.id, (x) => ({ ...x, body, editedAt: new Date().toISOString(), data: null }));
      try {
        upsertMessage(qc, (await convApi.edit(m.id, body)).data.message);
        qc.invalidateQueries({ queryKey: chatKeys.list, exact: true });
      } catch (e) {
        patchMessage(qc, where(conv), (x) => x.id === m.id, () => m);
        throw e;
      }
    },
    [conv, qc],
  );

  const vote = useCallback(
    async (m: ChatMessage, options: number[]) => {
      const before = m.votes;
      patchMessage(qc, where(conv), (x) => x.id === m.id, (x) => ({ ...x, votes: [...x.votes.filter((v) => v.userId !== me), ...options.map((option) => ({ userId: me, option }))] }));
      try {
        upsertMessage(qc, (await convApi.vote(m.id, options)).data.message);
      } catch {
        patchMessage(qc, where(conv), (x) => x.id === m.id, (x) => ({ ...x, votes: before }));
      }
    },
    [conv, me, qc],
  );

  return { send, retry, discard, react, remove, edit, vote };
}

// Module-level so a failed draft survives the chat screen re-rendering (not app restarts).
const draftStore = new Map<string, { draft: Draft; replyToId?: number }>();
function useDrafts() {
  return draftStore;
}
