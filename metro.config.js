// Learn more https://docs.expo.dev/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Native-only call libraries: on web, resolve them to small stand-ins (calls are phone-only).
const WEB_SHIMS = {
  'react-native-webrtc': path.resolve(__dirname, 'shims/webrtc.web.js'),
  'react-native-incall-manager': path.resolve(__dirname, 'shims/incall-manager.web.js'),
};
const resolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && WEB_SHIMS[moduleName]) return { type: 'sourceFile', filePath: WEB_SHIMS[moduleName] };
  return (resolve ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
