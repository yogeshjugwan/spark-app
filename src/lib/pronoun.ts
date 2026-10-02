import type { Gender } from './types';

/** Possessive pronoun for "Hear her voice" (Figma copy), inclusive for non-binary people. */
export function possessive(gender: Gender) {
  return gender === 'woman' ? 'her' : gender === 'man' ? 'his' : 'their';
}
