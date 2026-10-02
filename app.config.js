// Extends app.json with settings that depend on files/env that aren't checked in.
const fs = require('node:fs');
const path = require('node:path');

module.exports = ({ config }) => {
  const googleServices = path.join(__dirname, 'google-services.json');
  return {
    ...config,
    android: {
      ...config.android,
      // Firebase config for Android push (FCM). Download from the Firebase console.
      ...(fs.existsSync(googleServices) && { googleServicesFile: './google-services.json' }),
    },
    extra: {
      ...config.extra,
      // Expo project id (from `eas init`), required to get an Expo push token.
      eas: { ...config.extra?.eas, ...(process.env.EAS_PROJECT_ID && { projectId: process.env.EAS_PROJECT_ID }) },
    },
  };
};
