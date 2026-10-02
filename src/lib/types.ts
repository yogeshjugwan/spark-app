// Shapes returned by the dating API (see dating-api/src/users/users.service.ts).

export interface User {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  hasGoogle: boolean;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
}

export interface Session {
  user: User;
  tokens: Tokens;
}

export interface FieldError {
  field: string;
  message: string;
}

// ---- Profiles (dating-api/src/profile/profile.service.ts) ----

export type Gender = 'woman' | 'man' | 'nonbinary';
export type InterestedIn = 'women' | 'men' | 'everyone';

export interface Interest {
  id: number;
  slug: string;
  label: string;
  emoji: string;
}

export interface Photo {
  id: number;
  /** Path on the API server, e.g. /uploads/<uuid>.jpg — resolve with mediaUrl(). */
  url: string;
  width: number;
  height: number;
  position: number;
}

export interface ProfileDetails {
  birthDate: string; // YYYY-MM-DD
  age: number;
  gender: Gender;
  interestedIn: InterestedIn;
  bio: string | null;
  jobTitle: string | null;
  city: string | null;
  countryCode: string | null;
  voice: { url: string; durationSec: number } | null;
  preferences: Preferences;
  hasLocation: boolean;
}

export interface Preferences {
  ageMin: number;
  ageMax: number;
  distanceKm: number;
}

export interface OwnProfile {
  name: string;
  profile: ProfileDetails | null;
  photos: Photo[];
  interests: Interest[];
  completion: {
    isComplete: boolean;
    missing: ('basics' | 'photos')[];
    minPhotos: number;
    maxPhotos: number;
  };
}

export interface ProfileUpdate {
  name?: string;
  birthDate?: string;
  gender?: Gender;
  interestedIn?: InterestedIn;
  bio?: string | null;
  jobTitle?: string | null;
  city?: string | null;
  countryCode?: string | null;
  interestIds?: number[];
  prefAgeMin?: number;
  prefAgeMax?: number;
  prefDistanceKm?: number;
}

// ---- Discovery (dating-api/src/discovery) ----

/** Someone else's profile as discovery returns it (Featured cards, Explore grid, profile screen). */
export interface DiscoverProfile {
  id: number;
  name: string;
  age: number;
  gender: Gender;
  countryCode: string | null;
  bio: string | null;
  jobTitle: string | null;
  city: string | null;
  distanceKm: number | null;
  likeCount: number;
  sharedInterests: number;
  youLiked: boolean;
  voice: { url: string; durationSec: number } | null;
  photos: { id: number; url: string; width: number; height: number }[];
  interests: Interest[];
  /** Only on /users/:id — set when you're matched. */
  matchId?: number | null;
}

export interface UserSummary {
  id: number;
  name: string;
  age: number | null;
  photoUrl: string | null;
}

export interface MatchInfo {
  id: number;
  createdAt: string;
  user: UserSummary;
  isNew?: boolean;
}

export interface SwipeResult {
  matched: boolean;
  match: MatchInfo | null;
}

export interface GuestProfile {
  firstName: string;
  age: number;
  blurUrl: string;
}
