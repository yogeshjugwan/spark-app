// Web version of react-native-webrtc: browsers have WebRTC built in, so this maps the
// react-native-webrtc API (toURL + RTCView) onto the browser's own objects.
import { createElement, useCallback } from 'react';
import { StyleSheet } from 'react-native';

const hasWebRTC = typeof window !== 'undefined' && !!window.RTCPeerConnection;
const unsupported = () => Promise.reject(new Error('This browser does not support calls.'));

// RTCView takes a stream URL; keep a registry from URL to stream.
const streams = new Map();
const localIds = new Set();
if (hasWebRTC) {
  window.MediaStream.prototype.toURL = function toURL() {
    streams.set(this.id, this);
    return this.id;
  };
  window.MediaStream.prototype.release = function release() {
    this.getTracks().forEach((t) => t.stop());
    streams.delete(this.id);
  };
  if (window.MediaStreamTrack) window.MediaStreamTrack.prototype._switchCamera = () => {};
}

export const mediaDevices = hasWebRTC
  ? {
      getUserMedia: async (constraints) => {
        const s = await navigator.mediaDevices.getUserMedia(constraints);
        localIds.add(s.id);
        return s;
      },
      enumerateDevices: () => navigator.mediaDevices.enumerateDevices(),
    }
  : { getUserMedia: unsupported };

export const MediaStream = hasWebRTC ? window.MediaStream : class {};
export const RTCPeerConnection = hasWebRTC
  ? window.RTCPeerConnection
  : class {
      constructor() {
        throw new Error('This browser does not support calls.');
      }
    };
export const RTCIceCandidate = hasWebRTC ? window.RTCIceCandidate : class {};
export const RTCSessionDescription = hasWebRTC ? window.RTCSessionDescription : class {};

/** <video> showing a stream. Your own camera is muted so you don't hear yourself. */
export function RTCView({ streamURL, style, objectFit = 'contain', mirror }) {
  const ref = useCallback(
    (el) => {
      if (!el) return;
      el.srcObject = streams.get(streamURL) ?? null;
      el.play?.().catch(() => {});
    },
    [streamURL],
  );
  const flat = StyleSheet.flatten(style) ?? {};
  return createElement('video', {
    ref,
    autoPlay: true,
    playsInline: true,
    muted: localIds.has(streamURL),
    style: { ...flat, objectFit, transform: mirror ? 'scaleX(-1)' : undefined, backgroundColor: 'transparent' },
  });
}

export default {};
