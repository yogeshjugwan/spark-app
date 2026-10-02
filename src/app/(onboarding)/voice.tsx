import { OnboardingStep } from '@/components/profile/onboarding-step';
import { VoiceRecorder } from '@/components/profile/voice-recorder';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-store';
import { useOwnProfile } from '@/lib/use-profile';

/** Last step. Finishing flips the route guard from setup to the main tabs. */
export default function VoiceStep() {
  const { profile } = useOwnProfile();
  const finishOnboarding = useAuth((s) => s.finishOnboarding);
  const voice = profile?.profile?.voice ?? null;

  return (
    <OnboardingStep
      step={5}
      title="Let them hear your voice"
      subtitle="A short voice intro shows up as “Hear my voice” on your profile. It's optional."
      footer={
        <>
          <Button title={voice ? 'Finish' : 'Finish without voice'} variant={voice ? 'primary' : 'secondary'} onPress={finishOnboarding} />
        </>
      }>
      <VoiceRecorder current={voice} />
    </OnboardingStep>
  );
}
