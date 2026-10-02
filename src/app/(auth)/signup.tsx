import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/form-message';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { ApiError } from '@/lib/api';
import { authApi } from '@/lib/auth-api';
import { signupSchema, type SignupForm } from '@/lib/validation';

export default function SignupScreen() {
  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const { control, handleSubmit, setError } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: '', email: '', phone: '', password: '' },
  });

  const signup = useMutation({
    mutationFn: (v: SignupForm) =>
      authApi.signup({
        name: v.name,
        email: v.email || undefined,
        phone: v.phone || undefined,
        password: v.password,
      }),
    onSuccess: (_res, v) => {
      // Verify the email first if there is one; the phone can be verified later.
      router.push({ pathname: '/verify', params: { identifier: v.email || v.phone, purpose: 'verify' } });
    },
    onError: (err) => {
      if (!(err instanceof ApiError)) return;
      if (err.status === 409) {
        setError(/phone/.test(err.message) ? 'phone' : 'email', { message: err.message });
      }
      for (const fe of err.fieldErrors) {
        if (fe.field in signupSchema.shape) setError(fe.field as keyof SignupForm, { message: fe.message });
      }
    },
  });

  const formError =
    signup.error && !(signup.error instanceof ApiError && (signup.error.status === 409 || signup.error.fieldErrors.length))
      ? signup.error.message
      : null;

  return (
    <Screen
      footer={
        <Button
          title="Create account"
          loading={signup.isPending}
          onPress={handleSubmit((v) => signup.mutate(v))}
        />
      }>
      <ThemedText type="subtitle">Create your account</ThemedText>
      <ThemedText themeColor="textSecondary">
        We&apos;ll send a code to confirm it&apos;s really you.
      </ThemedText>

      <FormMessage message={formError} />

      <Controller
        control={control}
        name="name"
        render={({ field, fieldState }) => (
          <TextField
            label="First name"
            icon="person-outline"
            placeholder="Your first name"
            autoComplete="given-name"
            textContentType="givenName"
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <TextField
            ref={emailRef}
            label="Email"
            icon="mail-outline"
            placeholder="you@gmail.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => phoneRef.current?.focus()}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="phone"
        // "Add an email or a phone number" lives on the email field; re-check it when the phone changes.
        rules={{ deps: ['email'] }}
        render={({ field, fieldState }) => (
          <TextField
            ref={phoneRef}
            label="Phone (optional)"
            icon="call-outline"
            placeholder="98765 43210"
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            hint="Add an email, a phone number, or both."
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field, fieldState }) => (
          <TextField
            ref={passwordRef}
            label="Password"
            icon="lock-closed-outline"
            placeholder="At least 8 characters"
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={handleSubmit((v) => signup.mutate(v))}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            hint="Use letters and at least one number."
          />
        )}
      />
    </Screen>
  );
}
