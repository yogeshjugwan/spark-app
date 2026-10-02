# Dating App

Mobile app for iOS and Android. **Expo SDK 57 · React Native 0.86 · Expo Router · TypeScript.**
It talks to the API in `../dating-api`.

Done so far: welcome, sign up (email and/or phone), code verification, log in with a password or a code, a home screen, and log out. Logins persist across app restarts.

## Run it

1. Start the API (in `../dating-api`):
   ```bash
   npm run start:dev
   ```
2. Start the app. Port 8083 is used because this Mac already runs other Metro servers on 8081 and 8082:
   ```bash
   npx expo start --port 8083
   ```
   Press `a` for the Android emulator or `i` for the iOS simulator. For a real phone, scan the QR code with Expo Go (same Wi-Fi as the Mac).

In development, the app finds the API at `http://<your Mac's IP>:4000` automatically, so the emulator, the simulator and phones all work.
For production builds, set `EXPO_PUBLIC_API_URL`, for example `EXPO_PUBLIC_API_URL=https://api.example.com`.

Codes print in the API's terminal until Gmail/SMS are configured in `../dating-api/.env`.

## Checks

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # expo lint
npx expo-doctor      # dependency / config health
```

Add libraries with `npx expo install <package>` so versions match the Expo SDK.

## Layout

```
src/
  app/                       # screens (Expo Router: every file is a route)
    _layout.tsx              # providers, session restore, protected routes
    (auth)/                  # welcome, signup, login, verify: only when logged out
    (app)/                   # home: only when logged in
  components/ui/             # Screen, Button, TextField, OtpInput, FormMessage
  lib/
    config.ts                # API URL
    api.ts                   # fetch wrapper; refreshes expired tokens automatically
    auth-store.ts            # login state (Zustand)
    auth-api.ts              # /api/auth calls
    token-storage.ts         # tokens in Keychain / Keystore (expo-secure-store)
    validation.ts            # form rules (Zod), mirroring the API
  constants/theme.ts         # colors (light and dark), spacing
```

## How login works

- On launch, `_layout.tsx` restores saved tokens and calls `/api/auth/me`. The splash screen stays up until then.
- `Stack.Protected` shows the `(auth)` screens when logged out and the `(app)` screens when logged in. Signing in or out switches between them automatically.
- Access tokens last 15 minutes. On a 401, `api.ts` exchanges the refresh token for a new pair and retries once. If the refresh fails, you're logged out.
- Tokens are stored with `expo-secure-store`, never AsyncStorage.
