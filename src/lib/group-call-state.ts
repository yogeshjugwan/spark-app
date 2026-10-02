/** Tiny shared flag so the 1:1 and group call engines don't import each other. */
let inGroupCall = false;
export const isInGroupCall = () => inGroupCall;
export const setInGroupCall = (v: boolean) => {
  inGroupCall = v;
};
