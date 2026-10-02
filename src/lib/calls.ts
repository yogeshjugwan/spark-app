import { router } from 'expo-router';
import InCallManager from 'react-native-incall-manager';
import { mediaDevices, MediaStream, RTCIceCandidate, RTCPeerConnection, RTCSessionDescription } from 'react-native-webrtc';
import type { Socket } from 'socket.io-client';
import { create } from 'zustand';

import { api } from './api';
import { getSocket } from './use-chat-socket';
import { isInGroupCall } from './group-call-state';

export type CallType = 'audio' | 'video';
export type CallPhase = 'outgoing' | 'incoming' | 'connecting' | 'active' | 'ended';
export interface CallPeer {
  id: number;
  name: string;
  photoUrl: string | null;
}
interface CallInfo {
  id: number;
  matchId: number;
  callerId: number;
  calleeId: number;
  type: CallType;
}
export type Signal = { type: 'offer' | 'answer'; sdp: string } | { type: 'candidate'; candidate: RTCIceCandidateInit };
export interface RTCIceCandidateInit {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
}

interface CallState {
  call: CallInfo | null;
  peer: CallPeer | null;
  phase: CallPhase | null;
  local: MediaStream | null;
  remote: MediaStream | null;
  muted: boolean;
  cameraOff: boolean;
  speaker: boolean;
  answeredAt: number | null;
  /** Why the call ended, shown briefly before the screen closes. */
  endedText: string | null;
}

const idle: CallState = {
  call: null,
  peer: null,
  phase: null,
  local: null,
  remote: null,
  muted: false,
  cameraOff: false,
  speaker: false,
  answeredAt: null,
  endedText: null,
};
export const useCall = create<CallState>(() => idle);
const set = useCall.setState;
const get = useCall.getState;

// Connection bits that aren't UI state.
let pc: RTCPeerConnection | null = null;
let pendingCandidates: RTCIceCandidateInit[] = [];
// Signals that arrive before our peer connection exists (callee still opening the camera).
let earlySignals: Signal[] = [];
let iceServers: RTCConfiguration['iceServers'] | null = null;
type RTCConfiguration = ConstructorParameters<typeof RTCPeerConnection>[0] & { iceServers?: unknown[] };

/** The socket, waiting a few seconds for it to connect (e.g. the app was just opened from a call push). */
async function connectedSocket() {
  for (let i = 0; i < 40; i++) {
    const s = getSocket();
    if (s?.connected) return s;
    await new Promise((r) => setTimeout(r, 150));
  }
  return null;
}

export async function emit<T = unknown>(event: string, body: unknown): Promise<T> {
  const s = await connectedSocket();
  if (!s) throw new Error("You're offline. Check your connection and try again.");
  const res = (await s.timeout(8000).emitWithAck(event, body)) as { ok: true; data: T } | { ok: false; error: string };
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

export async function loadIceServers() {
  if (iceServers) return iceServers;
  try {
    const res = await api<{ data: { iceServers: RTCConfiguration['iceServers'] } }>('/api/calls/ice-servers', { authed: true });
    iceServers = res.data.iceServers;
  } catch {
    iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
  }
  return iceServers;
}

export async function getMedia(type: CallType) {
  if (type === 'audio') return mediaDevices.getUserMedia({ audio: true, video: false });
  // Front camera first; phones/emulators without one fall back to any camera, then to voice only.
  try {
    return await mediaDevices.getUserMedia({ audio: true, video: { facingMode: 'user', width: 720, height: 1280, frameRate: 30 } });
  } catch {
    try {
      return await mediaDevices.getUserMedia({ audio: true, video: true });
    } catch {
      return mediaDevices.getUserMedia({ audio: true, video: false });
    }
  }
}

// react-native-webrtc's typings resolve event-target-shim v5 (hoisted) instead of v6, so
// addEventListener is missing from the types even though it exists at runtime.
interface PeerEvents {
  icecandidate: { candidate: { toJSON(): RTCIceCandidateInit } | null };
  track: { streams: MediaStream[] };
  connectionstatechange: unknown;
}
export function on<K extends keyof PeerEvents>(conn: RTCPeerConnection, type: K, fn: (e: PeerEvents[K]) => void) {
  (conn as unknown as { addEventListener(t: string, f: (e: PeerEvents[K]) => void): void }).addEventListener(type, fn);
}

async function createPeer(call: CallInfo, local: MediaStream) {
  const conn = new RTCPeerConnection({ iceServers: (await loadIceServers()) as never });
  pc = conn;
  pendingCandidates = [];
  local.getTracks().forEach((t) => conn.addTrack(t, local));

  on(conn, 'icecandidate', (e) => {
    if (e.candidate) emit('call:signal', { callId: call.id, data: { type: 'candidate', candidate: e.candidate.toJSON() } }).catch(() => {});
  });
  on(conn, 'track', (e) => {
    const stream = e.streams[0];
    if (stream) set({ remote: stream });
  });
  on(conn, 'connectionstatechange', () => {
    if (conn.connectionState === 'connected' && get().phase !== 'active') set({ phase: 'active', answeredAt: get().answeredAt ?? Date.now() });
    // A dropped network: give up after the browser-level "failed" state.
    if (conn.connectionState === 'failed') hangUp();
  });
  return conn;
}

async function flushCandidates() {
  if (!pc) return;
  for (const c of pendingCandidates) await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
  pendingCandidates = [];
}

function audioRoute(type: CallType) {
  InCallManager.start({ media: type === 'video' ? 'video' : 'audio' });
  InCallManager.setKeepScreenOn(true);
  // Video calls default to the loudspeaker, voice calls to the earpiece — like a phone.
  InCallManager.setForceSpeakerphoneOn(type === 'video');
  set({ speaker: type === 'video' });
}

function teardown(endedText: string | null) {
  InCallManager.stopRingtone();
  InCallManager.stop();
  pc?.close();
  pc = null;
  pendingCandidates = [];
  earlySignals = [];
  const { local } = get();
  local?.getTracks().forEach((t) => t.stop());
  set({ phase: 'ended', local: null, remote: null, endedText });
  // Leave the "Call ended" state on screen for a moment, then close it.
  setTimeout(() => {
    if (get().phase === 'ended') set(idle); // the call screen closes itself when phase goes null
  }, 1200);
}

const ENDED_TEXT: Record<string, string> = {
  ended: 'Call ended',
  missed: 'No answer',
  declined: 'Declined',
  cancelled: 'Call cancelled',
};

// ---------------------------------------------------------------- actions

/** Start a call from a chat. Opens the call screen immediately. */
export async function startCall(matchId: number, type: CallType, peer: CallPeer) {
  if (get().phase && get().phase !== 'ended') throw new Error("You're already on a call");
  const local = await getMedia(type).catch(() => {
    throw new Error(type === 'video' ? 'Allow camera and microphone access to video call.' : 'Allow microphone access to call.');
  });
  set({ ...idle, peer, phase: 'outgoing', local, cameraOff: false });
  router.push('/call');
  try {
    const call = await emit<CallInfo>('call:start', { matchId, type });
    set({ call });
    audioRoute(type);
  } catch (e) {
    teardown(e instanceof Error ? e.message : "Couldn't start the call");
  }
}

export async function acceptCall() {
  const { call } = get();
  if (!call || get().phase !== 'incoming') return;
  InCallManager.stopRingtone();
  set({ phase: 'connecting' });
  earlySignals = [];
  try {
    // Answer first so the ring timeout can't fire while a permission prompt is open;
    // the caller's offer is buffered until the peer connection below exists.
    await emit('call:accept', { callId: call.id });
    const local = await getMedia(call.type).catch(() => {
      throw new Error(call.type === 'video' ? 'Allow camera and microphone access to answer.' : 'Allow microphone access to answer.');
    });
    set({ local });
    await createPeer(call, local);
    audioRoute(call.type);
    for (const sig of earlySignals.splice(0)) await handleSignal(call, sig);
  } catch (e) {
    emit('call:end', { callId: call.id }).catch(() => {});
    teardown(e instanceof Error ? e.message : "Couldn't answer the call");
  }
}

export function declineCall() {
  const { call } = get();
  if (call) emit('call:decline', { callId: call.id }).catch(() => {});
  teardown('Declined');
}

export function hangUp() {
  const { call } = get();
  if (call) emit('call:end', { callId: call.id }).catch(() => {});
  teardown(ENDED_TEXT.ended);
}

export function toggleMute() {
  const muted = !get().muted;
  get().local?.getAudioTracks().forEach((t) => (t.enabled = !muted));
  set({ muted });
}

export function toggleCamera() {
  const cameraOff = !get().cameraOff;
  get().local?.getVideoTracks().forEach((t) => (t.enabled = !cameraOff));
  set({ cameraOff });
}

export function flipCamera() {
  get()
    .local?.getVideoTracks()
    .forEach((t) => (t as unknown as { _switchCamera: () => void })._switchCamera());
}

export function toggleSpeaker() {
  const speaker = !get().speaker;
  InCallManager.setForceSpeakerphoneOn(speaker);
  set({ speaker });
}

/**
 * Show the ringing screen for an incoming call. Called from the socket event, or when the app
 * is opened from a call notification (then `ring` is false: the notification already rang).
 */
export function presentIncoming(call: CallInfo, from: CallPeer, { ring = true } = {}) {
  const { phase, call: current } = get();
  if (current?.id === call.id && phase && phase !== 'ended') return; // already showing it
  // Already busy here: the server has its own busy check; just ignore extra rings.
  if (phase && phase !== 'ended') return;
  if (isInGroupCall()) return;
  set({ ...idle, call, peer: from, phase: 'incoming' });
  if (ring) InCallManager.startRingtone('_DEFAULT_', [0, 1000, 1000], 'playback', 30);
  router.push('/call');
}

/**
 * Opened from a call notification: show that call if it's still ringing. Only the call the
 * notification was for — a stale notification must never pick up (or answer) a newer call.
 */
export async function openPendingCall({ callId, answer = false }: { callId: number; answer?: boolean }) {
  try {
    const res = await api<{ data: { call: CallInfo; from: CallPeer } | null }>('/api/calls/pending', { authed: true });
    if (!res.data || res.data.call.id !== callId) return false; // it stopped ringing before the app opened
    presentIncoming(res.data.call, res.data.from, { ring: !answer });
    if (answer) await acceptCall();
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- socket events

/** Wire call events onto the app's socket (called once per connection). */
export function attachCallHandlers(s: Socket) {
  s.on('call:incoming', (e: { call: CallInfo; from: CallPeer }) => presentIncoming(e.call, e.from));

  s.on('call:accepted', async (e: { call: CallInfo }) => {
    const { call, phase, local } = get();
    if (!call || call.id !== e.call.id) return;
    // Callee's *other* device: someone answered elsewhere, stop ringing here.
    if (phase === 'incoming') return teardown('Answered on another device');
    // Caller: the other side picked up — send the offer.
    if (phase === 'outgoing' && local) {
      set({ phase: 'connecting' });
      try {
        const conn = await createPeer(call, local);
        const offer = await conn.createOffer({});
        await conn.setLocalDescription(offer);
        await emit('call:signal', { callId: call.id, data: { type: 'offer', sdp: offer.sdp } });
      } catch {
        hangUp();
      }
    }
  });

  s.on('call:signal', async (e: { callId: number; data: Signal }) => {
    const { call } = get();
    if (!call || call.id !== e.callId) return;
    if (!pc) {
      earlySignals.push(e.data);
      return;
    }
    await handleSignal(call, e.data);
  });

  s.on('call:ended', (e: { callId: number; status: string }) => {
    const { call, phase } = get();
    if (!call || call.id !== e.callId || phase === 'ended') return;
    teardown(ENDED_TEXT[e.status] ?? 'Call ended');
  });
}

async function handleSignal(call: CallInfo, d: Signal) {
  if (!pc) return;
  try {
    if (d.type === 'offer') {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: d.sdp }));
      await flushCandidates();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await emit('call:signal', { callId: call.id, data: { type: 'answer', sdp: answer.sdp } });
    } else if (d.type === 'answer') {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: d.sdp }));
      await flushCandidates();
    } else if (d.type === 'candidate') {
      // Candidates can arrive before the remote description; queue until it's set.
      if (pc.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(d.candidate));
      else pendingCandidates.push(d.candidate);
    }
  } catch {
    // A single bad candidate isn't fatal; a failed negotiation shows up as connectionState "failed".
  }
}

// Development helper: inspect call state from the debugger (`__call.getState()`).
if (__DEV__) (globalThis as { __call?: unknown }).__call = useCall;
