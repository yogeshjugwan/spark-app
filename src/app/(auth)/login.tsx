import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/form-message';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { ApiError } from '@/lib/api';
import { authApi } from '@/lib/auth-api';
import { useAuth } from '@/lib/auth-store';
import { codeLoginSchema, loginSchema, type LoginForm } from '@/lib/validation';

type Mode = 'password' | 'code';

export default function LoginScreen() {
  const signIn = useAuth((s) => s.signIn);
  const [mode, setMode] = useState<Mode>('password');
  const passwordRef = useRef<TextInput>(null);

  const { control, handleSubmit, getValues, clearErrors } = useForm<LoginForm>({
    resolver: zodResolver(mode === 'password' ? loginSchema : codeLoginSchema),
    defaultValues: { identifier: '', password: '' },
  });

  const goVerify = (identifier: string, purpose: 'login' | 'verify') =>
    router.push({ pathname: '/verify', params: { identifier, purpose } });

  const login = useMutation({
    mutationFn: (v: LoginForm) => authApi.login({ identifier: v.identifier.trim(), password: v.password }),
    onSuccess: (res) => signIn(res.data),
    onError: async (err) => {
      // Not verified yet: send a verification code and go straight to the code screen.
      if (err instanceof ApiError && err.status === 403) {
        const identifier = getValues('identifier').trim();
        await authApi.sendOtp({ identifier, purpose: 'verify' }).catch(() => {});
        goVerify(identifier, 'verify');
      }
    },
  });

  const sendCode = useMutation({
    mutationFn: (identifier: string) => authApi.sendOtp({ identifier, purpose: 'login' }),
    onSuccess: (_res, identifier) => goVerify(identifier, 'login'),
  });

  const submit = handleSubmit((v) => {
    if (mode === 'password') login.mutate(v);
    else sendCode.mutate(v.identifier.trim());
  });

  const busy = login.isPending || sendCode.isPending;
  const error = mode === 'password' ? login.error : sendCode.error;
  const message = error instanceof ApiError && error.status === 403 ? null : error?.message;

  const switchMode = () => {
    clearErrors();
    login.reset();
    sendCode.reset();
    setMode(mode === 'password' ? 'code' : 'password');
  };

  return (
    <Screen
      footer={
        <>
          <Button title={mode === 'password' ? 'Log in' : 'Send me a code'} loading={busy} onPress={submit} />
          <Button
            title={mode === 'password' ? 'Log in with a code instead' : 'Log in with a password instead'}
            variant="ghost"
            disabled={busy}
            onPress={switchMode}
          />
          <Button title="New to Spark? Create an account" variant="ghost" size="sm" disabled={busy} onPress={() => router.replace('/signup')} />
        </>
      }>
      <ThemedText type="subtitle">Welcome back</ThemedText>
      <ThemedText themeColor="textSecondary">
        {mode === 'password'
          ? 'Log in with your email or phone number.'
          : "We'll send a one-time code to your email or phone."}
      </ThemedText>

      <FormMessage message={message} />

      <Controller
        control={control}
        name="identifier"
        render={({ field, fieldState }) => (
          <TextField
            label="Email or phone"
            icon="person-outline"
            placeholder="you@gmail.com or 98765 43210"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="username"
            textContentType="username"
            returnKeyType={mode === 'password' ? 'next' : 'send'}
            onSubmitEditing={() => (mode === 'password' ? passwordRef.current?.focus() : submit())}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
          />
        )}
      />

      {mode === 'password' && (
        <Controller
          control={control}
          name="password"
          render={({ field, fieldState }) => (
            <TextField
              ref={passwordRef}
              label="Password"
              icon="lock-closed-outline"
              placeholder="Your password"
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={submit}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
            />
          )}
        />
      )}
    </Screen>
  );
}
