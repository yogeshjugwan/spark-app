import { router } from 'expo-router';
import InCallManager from 'react-native-incall-manager';
import { MediaStream, RTCIceCandidate, RTCPeerConnection, RTCSessionDescription } from 'react-native-webrtc';
import type { Socket } from 'socket.io-client';
import { create } from 'zustand';

import { useAuth } from './auth-store';
import { emit, getMedia, loadIceServers, on, useCall, type CallType, type RTCIceCandidateInit, type Signal } from './calls';
import { setInGroupCall } from './group-call-state';

export interface GroupCallPerson {
  id: number;
  name: string;
  photoUrl: string | null;
}
export interface GroupCallInfo {
  id: number;
  groupId: number;
  groupName: string;
  groupPhotoUrl: string | null;
  type: CallType;
  status: 'active' | 'ended';
  startedById: number;
  createdAt: string;
  participants: GroupCallPerson[];
}
export type GroupPhase = 'incoming' | 'joining' | 'in-call' | 'ended';

export interface RemotePeer {
  person: GroupCallPerson;
  stream: MediaStream | null;
  state: 'connecting' | 'connected' | 'failed';
}

interface State {
  call: GroupCallInfo | null;
  phase: GroupPhase | null;
  /** Who rang us (incoming screen). */
  from: GroupCallPerson | null;
  local: MediaStream | null;
  peers: Record<number, RemotePeer>;
  muted: boolean;
  cameraOff: boolean;
  speaker: boolean;
  joinedAt: number | null;
  endedText: string | null;
}
const idle: State = { call: null, phase: null, from: null, local: null, peers: {}, muted: false, cameraOff: false, speaker: true, joinedAt: null, endedText: null };
export const useGroupCall = create<State>(() => idle);
const set = useGroupCall.setState;
const get = useGroupCall.getState;

// One RTCPeerConnection per other participant (mesh).
const conns = new Map<number, RTCPeerConnection>();
const pendingIce = new Map<number, RTCIceCandidateInit[]>();
// Signals that arrive before we've created the connection for that person.
const early = new Map<number, Signal[]>();

const me = () => useAuth.getState().user?.id ?? 0;
const personFrom = (call: GroupCallInfo | null, id: number): GroupCallPerson => call?.participants.find((p) => p.id === id) ?? { id, name: 'Someone', photoUrl: null };

function patchPeer(id: number, patch: Partial<RemotePeer>) {
  const { peers, call } = get();
  const cur = peers[id] ?? { person: personFrom(call, id), stream: null, state: 'connecting' as const };
  set({ peers: { ...peers, [id]: { ...cur, ...patch } } });
}

async function connectionFor(callId: number, peerId: number) {
  const existing = conns.get(peerId);
  if (existing) return existing;
  const local = get().local;
  const conn = new RTCPeerConnection({ iceServers: (await loadIceServers()) as never });
  conns.set(peerId, conn);
  pendingIce.set(peerId, []);
  local?.getTracks().forEach((t) => conn.addTrack(t, local));
  on(conn, 'icecandidate', (e) => {
    if (e.candidate) emit('gcall:signal', { callId, to: peerId, data: { type: 'candidate', candidate: e.candidate.toJSON() } }).catch(() => {});
  });
  on(conn, 'track', (e) => {
    if (e.streams[0]) patchPeer(peerId, { stream: e.streams[0] });
  });
  on(conn, 'connectionstatechange', () => {
    if (conn.connectionState === 'connected') patchPeer(peerId, { state: 'connected' });
    if (conn.connectionState === 'failed') patchPeer(peerId, { state: 'failed' });
  });
  patchPeer(peerId, {});
  // Anything that arrived before this connection existed.
  for (const sig of early.get(peerId)?.splice(0) ?? []) await handleSignal(callId, peerId, sig);
  return conn;
}

async function offerTo(callId: number, peerId: number) {
  const conn = await connectionFor(callId, peerId);
  const offer = await conn.createOffer({});
  await conn.setLocalDescription(offer);
  await emit('gcall:signal', { callId, to: peerId, data: { type: 'offer', sdp: offer.sdp } });
}

async function flush(peerId: number) {
  const conn = conns.get(peerId);
  if (!conn) return;
  for (const c of pendingIce.get(peerId) ?? []) await conn.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
  pendingIce.set(peerId, []);
}

async function handleSignal(callId: number, from: number, d: Signal) {
  try {
    if (d.type === 'offer') {
      const conn = await connectionFor(callId, from);
      await conn.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: d.sdp }));
      await flush(from);
      const answer = await conn.createAnswer();
      await conn.setLocalDescription(answer);
      await emit('gcall:signal', { callId, to: from, data: { type: 'answer', sdp: answer.sdp } });
    } else if (d.type === 'answer') {
      const conn = conns.get(from);
      if (!conn) return;
      await conn.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: d.sdp }));
      await flush(from);
    } else if (d.type === 'candidate') {
      const conn = conns.get(from);
      if (conn?.remoteDescription) await conn.addIceCandidate(new RTCIceCandidate(d.candidate));
      else pendingIce.set(from, [...(pendingIce.get(from) ?? []), d.candidate]);
    }
  } catch {
    // One bad candidate isn't fatal; a broken pair shows up as that tile's "failed" state.
  }
}

function dropPeer(id: number) {
  conns.get(id)?.close();
  conns.delete(id);
  pendingIce.delete(id);
  early.delete(id);
  const { [id]: _gone, ...rest } = get().peers;
  set({ peers: rest });
}

function teardown(endedText: string | null) {
  InCallManager.stopRingtone();
  InCallManager.stop();
  for (const id of [...conns.keys()]) dropPeer(id);
  get().local?.getTracks().forEach((t) => t.stop());
  setInGroupCall(false);
  set({ phase: 'ended', local: null, peers: {}, endedText });
  setTimeout(() => {
    if (get().phase === 'ended') set(idle);
  }, 1200);
}

function audioRoute(type: CallType) {
  InCallManager.start({ media: type === 'video' ? 'video' : 'audio' });
  InCallManager.setKeepScreenOn(true);
  // Group calls default to the loudspeaker (several voices).
  InCallManager.setForceSpeakerphoneOn(true);
  set({ speaker: true });
}

const busy = () => {
  const p = get().phase;
  return (p && p !== 'ended') || (useCall.getState().phase && useCall.getState().phase !== 'ended');
};

// ---------------------------------------------------------------- actions

/** Start a call in a group (joins the running one if there is one). */
export async function startGroupCall(groupId: number, type: CallType) {
  if (busy()) throw new Error("You're already on a call");
  const local = await getMedia(type).catch(() => {
    throw new Error(type === 'video' ? 'Allow camera and microphone access to video call.' : 'Allow microphone access to call.');
  });
  setInGroupCall(true);
  set({ ...idle, phase: 'joining', local });
  router.push('/group-call');
  try {
    const res = await emit<{ call: GroupCallInfo; peers: number[] }>('gcall:start', { groupId, type });
    set({ call: res.call, phase: 'in-call', joinedAt: Date.now() });
    audioRoute(res.call.type);
    // Joined a call that was already running: offer to everyone there.
    for (const id of res.peers) offerTo(res.call.id, id).catch(() => dropPeer(id));
  } catch (e) {
    teardown(e instanceof Error ? e.message : "Couldn't start the call");
  }
}

/** Join from the ringing screen or the chat's "Join" button. */
export async function joinGroupCall(callId: number, type?: CallType) {
  const { phase, call } = get();
  if (phase === 'in-call' && call?.id === callId) return router.push('/group-call');
  if (phase !== 'incoming' && busy()) throw new Error("You're already on a call");
  InCallManager.stopRingtone();
  const wanted = type ?? call?.type ?? 'audio';
  const local = await getMedia(wanted).catch(() => null);
  if (!local) {
    teardown(wanted === 'video' ? 'Allow camera and microphone access to join.' : 'Allow microphone access to join.');
    throw new Error('Permission needed');
  }
  setInGroupCall(true);
  set({ phase: 'joining', local });
  // From the ringing screen we're already on /group-call; from the chat card we open it.
  if (phase !== 'incoming') router.push('/group-call');
  try {
    const res = await emit<{ call: GroupCallInfo; peers: number[] }>('gcall:join', { callId });
    set({ call: res.call, phase: 'in-call', joinedAt: Date.now(), from: null });
    audioRoute(res.call.type);
    for (const id of res.peers) offerTo(callId, id).catch(() => dropPeer(id));
  } catch (e) {
    teardown(e instanceof Error ? e.message : "Couldn't join the call");
  }
}

export function declineGroupCall() {
  const { call } = get();
  if (call) emit('gcall:decline', { callId: call.id }).catch(() => {});
  InCallManager.stopRingtone();
  set(idle);
}

export function leaveGroupCall() {
  const { call } = get();
  if (call) emit('gcall:leave', { callId: call.id }).catch(() => {});
  teardown('You left the call');
}

export function toggleGroupMute() {
  const muted = !get().muted;
  get().local?.getAudioTracks().forEach((t) => (t.enabled = !muted));
  set({ muted });
}
export function toggleGroupCamera() {
  const cameraOff = !get().cameraOff;
  get().local?.getVideoTracks().forEach((t) => (t.enabled = !cameraOff));
  set({ cameraOff });
}
export function flipGroupCamera() {
  get()
    .local?.getVideoTracks()
    .forEach((t) => (t as unknown as { _switchCamera: () => void })._switchCamera());
}
export function toggleGroupSpeaker() {
  const speaker = !get().speaker;
  InCallManager.setForceSpeakerphoneOn(speaker);
  set({ speaker });
}

/** Ringing screen for a group call someone started. */
export function presentGroupIncoming(call: GroupCallInfo, from: GroupCallPerson, { ring = true } = {}) {
  if (busy()) return;
  set({ ...idle, call, from, phase: 'incoming' });
  if (ring) InCallManager.startRingtone('_DEFAULT_', [0, 1000, 1000], 'playback', 30);
  router.push('/group-call');
}

// ---------------------------------------------------------------- socket events

export function attachGroupCallHandlers(s: Socket, onChange?: (groupId: number) => void) {
  for (const ev of ['gcall:incoming', 'gcall:joined', 'gcall:left', 'gcall:ended']) {
    s.on(ev, (e: { call?: GroupCallInfo; groupId?: number }) => {
      const gid = e.call?.groupId ?? e.groupId;
      if (gid) onChange?.(gid);
    });
  }
  s.on('gcall:incoming', (e: { call: GroupCallInfo; from: GroupCallPerson }) => presentGroupIncoming(e.call, e.from));

  s.on('gcall:joined', (e: { callId: number; user: GroupCallPerson; call: GroupCallInfo }) => {
    const { call, phase } = get();
    if (!call || call.id !== e.callId) return;
    // I joined on another phone: stop ringing here.
    if (e.user.id === me() && phase === 'incoming') return set(idle);
    set({ call: { ...call, participants: e.call.participants } });
    // The newcomer will send us an offer; show their tile straight away.
    if (phase === 'in-call' && e.user.id !== me()) patchPeer(e.user.id, { person: e.user });
  });

  s.on('gcall:left', (e: { callId: number; userId: number; call: GroupCallInfo }) => {
    const { call } = get();
    if (!call || call.id !== e.callId) return;
    set({ call: { ...call, participants: e.call.participants } });
    if (e.userId !== me()) dropPeer(e.userId);
  });

  s.on('gcall:declined', (e: { callId: number }) => {
    if (get().call?.id === e.callId && get().phase === 'incoming') {
      InCallManager.stopRingtone();
      set(idle);
    }
  });

  s.on('gcall:signal', async (e: { callId: number; from: number; data: Signal }) => {
    const { call, phase } = get();
    if (!call || call.id !== e.callId || phase !== 'in-call') return;
    // Answers/candidates for a connection we haven't made yet wait; offers create it.
    if (e.data.type !== 'offer' && !conns.has(e.from)) {
      early.set(e.from, [...(early.get(e.from) ?? []), e.data]);
      return;
    }
    await handleSignal(e.callId, e.from, e.data);
  });

  s.on('gcall:ended', (e: { callId: number }) => {
    const { call, phase } = get();
    if (!call || call.id !== e.callId) return;
    if (phase === 'incoming') {
      InCallManager.stopRingtone();
      return set(idle);
    }
    if (phase !== 'ended') teardown('Call ended');
  });
}

if (__DEV__) (globalThis as { __gcall?: unknown }).__gcall = useGroupCall;
