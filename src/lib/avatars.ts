/**
 * Illustrated placeholder portraits (DiceBear "lorelei"), used for marketing art
 * and for users who haven't added a photo yet. Generated art — not real people.
 *
 * `transparent` drops the background tint so the figure can sit directly on the
 * page (the welcome screen's cut-out portraits).
 */
export function avatarUrl(seed: string, size = 256, { transparent = false } = {}) {
  const bg = transparent ? '' : '&backgroundColor=f7d6e8,e9dcf7,fde2d4';
  return `https://api.dicebear.com/9.x/lorelei/png?seed=${encodeURIComponent(seed)}&size=${size}${bg}`;
}
