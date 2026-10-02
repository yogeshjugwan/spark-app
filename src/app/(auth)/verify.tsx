import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/form-message';
import { OtpInput } from '@/components/ui/otp-input';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { authApi } from '@/lib/auth-api';
import { useAuth } from '@/lib/auth-store';

const CODE_LENGTH = 6;
const RESEND_SECONDS = 60;

export default function VerifyScreen() {
  const { identifier = '', purpose = 'verify' } = useLocalSearchParams<{
    identifier: string;
    purpose: 'verify' | 'login';
  }>();
  const signIn = useAuth((s) => s.signIn);
  const [code, setCode] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [info, setInfo] = useState<string | null>(null);

  // Countdown for "Resend code".
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  const verify = useMutation({
    mutationFn: (otp: string) => authApi.verify({ identifier, otp }),
    // Signing in flips the auth guard, which switches to the app screens.
    onSuccess: (res) => signIn(res.data),
    onError: () => setCode(''),
  });

  const resend = useMutation({
    mutationFn: () => authApi.sendOtp({ identifier, purpose }),
    onSuccess: () => {
      verify.reset();
      setInfo('A new code is on its way. Use the newest one.');
      setSecondsLeft(RESEND_SECONDS);
    },
  });

  const onChange = (value: string) => {
    setCode(value);
    setInfo(null);
    if (verify.isError) verify.reset();
    if (value.length === CODE_LENGTH) verify.mutate(value);
  };

  const isEmail = identifier.includes('@');

  return (
    <Screen
      footer={
        <>
          <Button
            title="Continue"
            loading={verify.isPending}
            disabled={code.length !== CODE_LENGTH}
            onPress={() => verify.mutate(code)}
          />
          <Button
            title={secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : 'Resend code'}
            variant="ghost"
            loading={resend.isPending}
            disabled={secondsLeft > 0}
            onPress={() => resend.mutate()}
          />
        </>
      }>
      <ThemedText type="subtitle">Enter your code</ThemedText>
      <ThemedText themeColor="textSecondary">
        We sent a {CODE_LENGTH}-digit code to{' '}
        <ThemedText style={styles.bold}>{identifier}</ThemedText>.{' '}
        {isEmail ? 'Check your inbox and spam folder.' : 'It may take a minute to arrive.'}
      </ThemedText>

      <View style={styles.otp}>
        <OtpInput value={code} onChange={onChange} length={CODE_LENGTH} error={verify.isError} autoFocus />
      </View>

      <FormMessage message={verify.error?.message ?? resend.error?.message} />
      <FormMessage message={info} tone="info" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  bold: { fontWeight: 700 },
  otp: { paddingVertical: Spacing.three },
});
