
import { api } from './api';
import { uploadForm } from './upload-form';
import type { LocalFile } from './profile-api';

type Ok<T> = { success: true; message?: string; data: T };

export type MessageType = 'text' | 'image' | 'voice' | 'gift' | 'request' | 'call' | 'video' | 'file' | 'location' | 'contact' | 'poll' | 'sticker';
export interface LinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  site: string;
}
/** Type-specific payload from the server. */
export interface MessageData {
  link?: LinkPreview;
  mentions?: number[];
  albumId?: string;
  width?: number;
  height?: number;
  gif?: string;
  // file
  name?: string;
  size?: number;
  mime?: string;
  // location
  lat?: number;
  lng?: number;
  label?: string | null;
  live?: boolean;
  until?: string;
  // contact
  phone?: string;
  // poll
  question?: string;
  options?: string[];
  multi?: boolean;
  waveform?: string;
  updatedAt?: string;
  callId?: number;
  joined?: number;
  // system notes ("turned on disappearing messages")
  system?: string;
}
export interface QuotedMessage {
  id: number;
  senderId: number;
  type: MessageType;
  body: string | null;
  meta: string | null;
  deleted: boolean;
}
export interface Reaction {
  userId: number;
  emoji: string;
}
export interface ChatMessage {
  /** Server id; negative for a message still being sent from this phone. */
  id: number;
  clientId: string | null;
  matchId: number | null;
  groupId: number | null;
  senderId: number;
  type: MessageType;
  body: string | null;
  url: string | null;
  durationSec: number | null;
  meta: string | null;
  deleted: boolean;
  replyTo: QuotedMessage | null;
  reactions: Reaction[];
  votes: { userId: number; option: number }[];
  data: MessageData | null;
  editedAt: string | null;
  forwarded: boolean;
  viewOnce: boolean;
  expiresAt: string | null;
  createdAt: string;
  /** Local only: optimistic send state. */
  status?: 'sending' | 'failed';
  /** Local only: file on this phone while an image/voice message uploads. */
  localUri?: string;
}
export interface ChatUser {
  id: number;
  name: string;
  photoUrl: string | null;
  online: boolean;
  lastSeenAt: string | null;
}
export interface DirectConversation {
  kind: 'match';
  matchId: number;
  user: ChatUser;
  lastMessage: ChatMessage | null;
  otherLastRead: number;
  otherLastDelivered: number;
  unread: number;
  updatedAt: string;
  prefs: ChatPrefs;
}
export interface ChatPrefs {
  pinned: boolean;
  mutedUntil: string | null;
  archived: boolean;
  markedUnread: boolean;
  wallpaper: string | null;
}
export interface GroupConversation {
  kind: 'group';
  groupId: number;
  name: string;
  photoUrl: string | null;
  memberCount: number;
  lastMessage: (ChatMessage & { senderName: string }) | null;
  unread: number;
  updatedAt: string;
  prefs: ChatPrefs;
}
export type Conversation = DirectConversation | GroupConversation;

export interface GroupMember {
  id: number;
  name: string;
  photoUrl: string | null;
  role: 'admin' | 'member';
}
export interface GroupDetails {
  id: number;
  name: string;
  description: string | null;
  photoUrl: string | null;
  adminsOnly: boolean;
  disappearSec: number | null;
  inviteCode: string | null;
  myRole: 'admin' | 'member';
  members: GroupMember[];
}
export interface GroupThread {
  messages: ChatMessage[];
  hasMore: boolean;
  group: GroupDetails;
}
export interface Thread {
  messages: ChatMessage[];
  hasMore: boolean;
  myLastRead: number;
  otherLastRead: number;
  otherLastDelivered: number;
  user: ChatUser;
}
export type GiftCode = 'rose' | 'chocolate' | 'ring';
export interface Gift {
  code: GiftCode;
  label: string;
  emoji: string;
  price: number;
}
export interface Wallet {
  coins: number;
  gifts: Gift[];
}
export interface Announcement {
  id: number;
  title: string;
  body: string;
  createdAt: string;
}
export type ReportReason = 'fake_profile' | 'inappropriate' | 'harassment' | 'scam' | 'underage' | 'other';

/** Sent with every message: a phone-made id (so retries don't duplicate) and the quoted message. */
export interface SendOpts {
  clientId: string;
  replyToId?: number;
}
const optFields = (o: SendOpts) => ({ clientId: o.clientId, ...(o.replyToId && { replyToId: String(o.replyToId) }) });

const form = (field: string, file: LocalFile, extra: Record<string, string> = {}) => uploadForm(field, file, extra);

export const chatApi = {
  conversations: () => api<Ok<{ conversations: Conversation[] }>>('/api/chats', { authed: true }),
  thread: (matchId: number, before?: number) =>
    api<Ok<Thread>>(`/api/chats/${matchId}/messages${before ? `?before=${before}` : ''}`, { authed: true }),
  sendText: (matchId: number, body: string, o: SendOpts) =>
    api<Ok<{ message: ChatMessage }>>(`/api/chats/${matchId}/messages`, { method: 'POST', body: { body, ...o }, authed: true }),
  sendImage: (matchId: number, file: LocalFile, o: SendOpts) =>
    api<Ok<{ message: ChatMessage }>>(`/api/chats/${matchId}/image`, { method: 'POST', body: form('image', file, optFields(o)), authed: true }),
  sendVoice: (matchId: number, file: LocalFile, durationSec: number, o: SendOpts) =>
    api<Ok<{ message: ChatMessage }>>(`/api/chats/${matchId}/voice`, {
      method: 'POST',
      body: form('voice', file, { durationSec: String(durationSec), ...optFields(o) }),
      authed: true,
    }),
  markDelivered: (matchId: number, messageId: number) =>
    api<Ok<unknown>>(`/api/chats/${matchId}/delivered`, { method: 'POST', body: { messageId }, authed: true }),
  react: (messageId: number, emoji: string | null) =>
    api<Ok<{ message: ChatMessage }>>(`/api/messages/${messageId}/reaction`, { method: 'PUT', body: { emoji }, authed: true }),
  deleteMessage: (messageId: number, forEveryone: boolean) =>
    api<Ok<{ message?: ChatMessage }>>(`/api/messages/${messageId}${forEveryone ? '?for=everyone' : ''}`, { method: 'DELETE', authed: true }),
  sendGift: (matchId: number, gift: GiftCode, note?: string) =>
    api<Ok<{ message: ChatMessage; wallet: Wallet }>>(`/api/chats/${matchId}/gift`, { method: 'POST', body: { gift, note }, authed: true }),
  sendRequest: (matchId: number, kind: 'image' | 'video') =>
    api<Ok<{ message: ChatMessage }>>(`/api/chats/${matchId}/request`, { method: 'POST', body: { kind }, authed: true }),
  markRead: (matchId: number, messageId: number) =>
    api<Ok<unknown>>(`/api/chats/${matchId}/read`, { method: 'POST', body: { messageId }, authed: true }),
  wallet: () => api<Ok<Wallet>>('/api/wallet', { authed: true }),
  announcements: () => api<Ok<{ announcements: Announcement[] }>>('/api/announcements', { authed: true }),
  report: (userId: number, reason: ReportReason, details?: string) =>
    api<Ok<unknown>>('/api/reports', { method: 'POST', body: { userId, reason, details }, authed: true }),
};

export const groupApi = {
  create: (name: string, memberIds: number[]) =>
    api<Ok<{ group: GroupDetails }>>('/api/groups', { method: 'POST', body: { name, memberIds }, authed: true }),
  details: (id: number) => api<Ok<{ group: GroupDetails }>>(`/api/groups/${id}`, { authed: true }),
  rename: (id: number, name: string) => api<Ok<{ group: GroupDetails }>>(`/api/groups/${id}`, { method: 'PATCH', body: { name }, authed: true }),
  addMembers: (id: number, userIds: number[]) =>
    api<Ok<{ group: GroupDetails }>>(`/api/groups/${id}/members`, { method: 'POST', body: { userIds }, authed: true }),
  removeMember: (id: number, userId: number) => api<Ok<unknown>>(`/api/groups/${id}/members/${userId}`, { method: 'DELETE', authed: true }),
  thread: (id: number, before?: number) => api<Ok<GroupThread>>(`/api/groups/${id}/messages${before ? `?before=${before}` : ''}`, { authed: true }),
  sendText: (id: number, body: string, o: SendOpts) =>
    api<Ok<{ message: ChatMessage }>>(`/api/groups/${id}/messages`, { method: 'POST', body: { body, ...o }, authed: true }),
  sendImage: (id: number, file: LocalFile, o: SendOpts) =>
    api<Ok<{ message: ChatMessage }>>(`/api/groups/${id}/image`, { method: 'POST', body: form('image', file, optFields(o)), authed: true }),
  sendVoice: (id: number, file: LocalFile, durationSec: number, o: SendOpts) =>
    api<Ok<{ message: ChatMessage }>>(`/api/groups/${id}/voice`, {
      method: 'POST',
      body: form('voice', file, { durationSec: String(durationSec), ...optFields(o) }),
      authed: true,
    }),
  markRead: (id: number, messageId: number) => api<Ok<unknown>>(`/api/groups/${id}/read`, { method: 'POST', body: { messageId }, authed: true }),
};

/** A 1:1 chat or a group — the new endpoints work for both. */
export type ConvRef = { kind: 'match' | 'group'; id: number };
export interface ConvState {
  disappearSec: number | null;
  canSend: boolean;
  isAdmin: boolean;
  pinned: ChatMessage | null;
  starredIds: number[];
  opened: { messageId: number; userId: number }[];
  prefs: ChatPrefs;
}
export type MediaKind = 'image' | 'video' | 'file' | 'voice';
export type RichContent =
  | { type: 'text'; body: string; mentions?: number[] }
  | { type: 'location'; lat: number; lng: number; label?: string; liveMinutes?: 15 | 60 | 480 }
  | { type: 'contact'; name: string; phone: string }
  | { type: 'poll'; question: string; options: string[]; multi: boolean }
  | { type: 'sticker'; code: string }
  | { type: 'gif'; url: string; width: number; height: number };
export interface MediaOpts extends SendOpts {
  caption?: string;
  durationSec?: number;
  viewOnce?: boolean;
  albumId?: string;
  waveform?: string;
}

const c = (r: ConvRef) => `/api/c/${r.kind}/${r.id}`;
export const convApi = {
  send: (r: ConvRef, content: RichContent, o: SendOpts) =>
    api<Ok<{ message: ChatMessage }>>(`${c(r)}/messages`, { method: 'POST', body: { ...content, ...o }, authed: true }),
  media: (r: ConvRef, kind: MediaKind, file: LocalFile, o: MediaOpts) =>
    api<Ok<{ message: ChatMessage }>>(`${c(r)}/media`, {
      method: 'POST',
      body: form('file', file, {
        kind,
        ...optFields(o),
        ...(o.caption && { caption: o.caption }),
        ...(o.durationSec !== undefined && { durationSec: String(o.durationSec) }),
        ...(o.viewOnce && { viewOnce: 'true' }),
        ...(o.albumId && { albumId: o.albumId }),
        ...(o.waveform && { waveform: o.waveform }),
      }),
      authed: true,
    }),
  state: (r: ConvRef) => api<Ok<ConvState>>(`${c(r)}/state`, { authed: true }),
  prefs: (r: ConvRef, p: Partial<ChatPrefs>) => api<Ok<{ prefs: ChatPrefs }>>(`${c(r)}/prefs`, { method: 'PUT', body: p, authed: true }),
  clear: (r: ConvRef) => api<Ok<unknown>>(`${c(r)}/clear`, { method: 'POST', authed: true }),
  pin: (r: ConvRef, messageId: number | null) => api<Ok<unknown>>(`${c(r)}/pin`, { method: 'PUT', body: { messageId }, authed: true }),
  disappearing: (r: ConvRef, seconds: number | null) => api<Ok<unknown>>(`${c(r)}/disappearing`, { method: 'PUT', body: { seconds }, authed: true }),
  search: (r: ConvRef, q: string) => api<Ok<{ messages: ChatMessage[] }>>(`${c(r)}/search?q=${encodeURIComponent(q)}`, { authed: true }),
  gallery: (r: ConvRef, tab: 'media' | 'links' | 'docs') => api<Ok<{ messages: ChatMessage[] }>>(`${c(r)}/gallery?tab=${tab}`, { authed: true }),
  searchAll: (q: string) => api<Ok<{ messages: (ChatMessage & { senderName: string })[] }>>(`/api/search?q=${encodeURIComponent(q)}`, { authed: true }),
  edit: (messageId: number, body: string) => api<Ok<{ message: ChatMessage }>>(`/api/messages/${messageId}`, { method: 'PATCH', body: { body }, authed: true }),
  forward: (messageIds: number[], targets: ConvRef[]) =>
    api<Ok<{ messages: ChatMessage[] }>>('/api/messages/forward', { method: 'POST', body: { messageIds, targets }, authed: true }),
  star: (messageId: number, on: boolean) => api<Ok<unknown>>(`/api/messages/${messageId}/star`, { method: 'PUT', body: { on }, authed: true }),
  starred: () => api<Ok<{ messages: (ChatMessage & { senderName: string })[] }>>('/api/starred', { authed: true }),
  vote: (messageId: number, options: number[]) =>
    api<Ok<{ message: ChatMessage }>>(`/api/messages/${messageId}/vote`, { method: 'PUT', body: { options }, authed: true }),
  live: (messageId: number, lat: number, lng: number, stop = false) =>
    api<Ok<{ message: ChatMessage }>>(`/api/messages/${messageId}/location`, { method: 'PUT', body: { lat, lng, stop }, authed: true }),
  open: (messageId: number) => api<Ok<{ url: string; type: MessageType; durationSec: number | null }>>(`/api/messages/${messageId}/open`, { method: 'POST', authed: true }),
};

export const groupExtraApi = {
  activeCall: (id: number) => api<Ok<{ call: import('./group-calls').GroupCallInfo | null }>>(`/api/groups/${id}/call`, { authed: true }),
  info: (id: number, b: { name?: string; description?: string | null; adminsOnly?: boolean }) =>
    api<Ok<{ group: GroupDetails }>>(`/api/groups/${id}/info`, { method: 'PATCH', body: b, authed: true }),
  photo: (id: number, file: LocalFile) => api<Ok<{ group: GroupDetails }>>(`/api/groups/${id}/photo`, { method: 'POST', body: form('image', file), authed: true }),
  role: (id: number, userId: number, role: 'admin' | 'member') =>
    api<Ok<{ group: GroupDetails }>>(`/api/groups/${id}/members/${userId}/role`, { method: 'PUT', body: { role }, authed: true }),
  invite: (id: number, enabled: boolean) => api<Ok<{ inviteCode: string | null }>>(`/api/groups/${id}/invite`, { method: 'PUT', body: { enabled }, authed: true }),
  preview: (code: string) =>
    api<Ok<{ group: { id: number; name: string; description: string | null; photoUrl: string | null; memberCount: number } }>>(`/api/groups/invite/${code}`, { authed: true }),
  join: (code: string) => api<Ok<{ group: GroupDetails }>>(`/api/groups/invite/${code}/join`, { method: 'POST', authed: true }),
};

export interface Story {
  id: number;
  type: 'text' | 'image' | 'video';
  url: string | null;
  body: string | null;
  bg: string | null;
  createdAt: string;
  expiresAt: string;
  viewCount: number;
  seen: boolean;
}
export interface StoryGroup {
  user: { id: number; name: string; photoUrl: string | null };
  stories: Story[];
  allSeen: boolean;
  mine: boolean;
}
export const storyApi = {
  feed: () => api<Ok<{ feed: StoryGroup[] }>>('/api/stories', { authed: true }),
  text: (body: string, bg: string) => api<Ok<{ story: Story }>>('/api/stories/text', { method: 'POST', body: { body, bg }, authed: true }),
  media: (kind: 'image' | 'video', file: LocalFile, caption?: string) =>
    api<Ok<{ story: Story }>>('/api/stories/media', { method: 'POST', body: form('file', file, { kind, ...(caption && { caption }) }), authed: true }),
  view: (id: number, emoji?: string | null) => api<Ok<unknown>>(`/api/stories/${id}/view`, { method: 'POST', body: emoji === undefined ? {} : { emoji }, authed: true }),
  viewers: (id: number) =>
    api<Ok<{ viewers: { id: number; name: string; photoUrl: string | null; emoji: string | null; at: string }[] }>>(`/api/stories/${id}/viewers`, { authed: true }),
  remove: (id: number) => api<Ok<unknown>>(`/api/stories/${id}`, { method: 'DELETE', authed: true }),
};

export const chatKeys = {
  list: ['chats'] as const,
  thread: (matchId: number) => ['chats', matchId] as const,
  groupThread: (groupId: number) => ['groups', groupId] as const,
  wallet: ['wallet'] as const,
  announcements: ['announcements'] as const,
  state: (r: ConvRef) => ['conv-state', r.kind, r.id] as const,
  stories: ['stories'] as const,
  starred: ['starred'] as const,
};

/** Human label for a disappearing-messages timer. */
export const disappearLabel = (s: number | null) => (!s ? 'Off' : s >= 90 * 86400 ? '90 days' : s >= 7 * 86400 ? '7 days' : '24 hours');
export const fileSizeText = (n = 0) => (n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 ** 2).toFixed(1)} MB`);

/** Short preview for the chat list. */
export function preview(m: ChatMessage | null, mine: boolean) {
  if (!m) return 'You matched · say hi 👋';
  const you = mine ? 'You: ' : '';
  if (m.deleted) return mine ? 'You deleted this message' : 'This message was deleted';
  if (m.data?.system) return systemText(m, mine);
  switch (m.type) {
    case 'text':
      return you + m.body;
    case 'image':
      return m.data?.gif ? `${you}GIF` : m.viewOnce ? `${you}📷 View once photo` : `${you}📷 ${m.body || 'Photo'}`;
    case 'video':
      return m.viewOnce ? `${you}🎥 View once video` : `${you}🎥 ${m.body || 'Video'}`;
    case 'file':
      return `${you}📄 ${m.data?.name ?? 'Document'}`;
    case 'location':
      return `${you}📍 ${m.data?.live ? 'Live location' : 'Location'}`;
    case 'contact':
      return `${you}👤 ${m.data?.name ?? 'Contact'}`;
    case 'poll':
      return `${you}📊 ${m.data?.question ?? 'Poll'}`;
    case 'sticker':
      return `${you}Sticker`;
    case 'voice':
      return `${you}🎤 Voice message`;
    case 'gift':
      return `${you}🎁 Sent a gift`;
    case 'request':
      return `${you}Asked for ${m.meta === 'video' ? 'a video' : 'a photo'}`;
    case 'call':
      return callLabel(m, mine);
  }
}

/** "Video call · 2:05", "Missed voice call", … from a call message's meta (`video:ended`). */
export function callLabel(m: Pick<ChatMessage, 'meta' | 'durationSec'>, mine: boolean) {
  const [rawType, status] = (m.meta ?? 'audio:ended').split(':');
  if (rawType.startsWith('group-')) {
    const Kind = rawType === 'group-video' ? 'Group video call' : 'Group voice call';
    if (status === 'ongoing') return `${Kind} · tap to join`;
    if (status === 'missed') return `${Kind} · no one joined`;
    const s = m.durationSec ?? 0;
    return `${Kind} · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
  const type = rawType;
  const kind = type === 'video' ? 'video call' : 'voice call';
  const Kind = kind[0].toUpperCase() + kind.slice(1);
  if (status === 'ended') {
    const s = m.durationSec ?? 0;
    return `${Kind} · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
  if (status === 'missed') return mine ? `${Kind} · no answer` : `Missed ${kind}`;
  if (status === 'declined') return mine ? `${Kind} · declined` : `Declined ${kind}`;
  return mine ? `Cancelled ${kind}` : `Missed ${kind}`;
}

/** Short text for a quoted message in a reply. */
export function quoteText(q: Pick<QuotedMessage, 'type' | 'body' | 'meta' | 'deleted'>) {
  if (q.deleted) return 'This message was deleted';
  switch (q.type) {
    case 'text':
      return q.body ?? '';
    case 'image':
      return '📷 Photo';
    case 'voice':
      return '🎤 Voice message';
    case 'video':
      return '🎥 Video';
    case 'file':
      return '📄 Document';
    case 'location':
      return '📍 Location';
    case 'contact':
      return '👤 Contact';
    case 'poll':
      return '📊 Poll';
    case 'sticker':
      return 'Sticker';
    case 'gift':
      return '🎁 Gift';
    case 'request':
      return q.meta === 'video' ? 'Asked for a video' : 'Asked for a photo';
    case 'call':
      return '📞 Call';
  }
}

/** "last seen today at 10:32" / "last seen yesterday at …" / "last seen 12 Sep". */
export function lastSeenText(iso: string | null) {
  if (!iso) return 'offline';
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return `last seen today at ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `last seen yesterday at ${time}`;
  return `last seen ${d.toLocaleDateString([], { day: 'numeric', month: 'short' })}`;
}

/** A random id for optimistic messages (no crypto dependency needed for this). */
export function newClientId() {
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Centered system notes ("You turned on disappearing messages…"). */
export function systemText(m: Pick<ChatMessage, 'data'>, mine: boolean) {
  if (m.data?.system === 'disappearing') {
    const who = mine ? 'You' : 'They';
    return m.data.label === 'off' ? `${who} turned off disappearing messages.` : `${who} turned on disappearing messages. New messages will disappear after ${m.data.label}.`;
  }
  return '';
}
