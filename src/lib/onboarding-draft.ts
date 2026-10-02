import { create } from 'zustand';
import type { Gender } from './types';

/**
 * Step 1 answers held until step 2: the API creates a profile only once it has
 * birthday + gender + who you want to meet together.
 */
interface Draft {
  name: string;
  birthDate: string | null;
  gender: Gender | null;
  countryCode: string | null;
  set: (patch: Partial<Omit<Draft, 'set'>>) => void;
}

export const useOnboardingDraft = create<Draft>((set) => ({
  name: '',
  birthDate: null,
  gender: null,
  countryCode: null,
  set: (patch) => set(patch),
}));
