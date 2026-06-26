/**
 * Seeded pseudo-random number generator (mulberry32).
 *
 * The RNG state is a single 32-bit integer stored in GameState, so all
 * randomness is deterministic and serializable. Every consumer takes the
 * current state and returns the next state alongside the value — the engine
 * never relies on `Math.random`, guaranteeing reproducible games and replays.
 */

export interface RngStep {
  value: number; // float in [0, 1)
  state: number;
}

/** Advance the generator one step, returning a float in [0, 1) and new state. */
export function nextRandom(state: number): RngStep {
  let a = state | 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: a };
}

/** Return an integer in [0, maxExclusive) and the new state. */
export function nextInt(state: number, maxExclusive: number): { value: number; state: number } {
  const step = nextRandom(state);
  return { value: Math.floor(step.value * maxExclusive), state: step.state };
}

/**
 * Fisher–Yates shuffle that consumes the RNG deterministically.
 * Returns a NEW array plus the advanced RNG state (does not mutate input).
 */
export function shuffle<T>(items: readonly T[], state: number): { result: T[]; state: number } {
  const result = items.slice();
  let s = state;
  for (let i = result.length - 1; i > 0; i -= 1) {
    const step = nextInt(s, i + 1);
    s = step.state;
    const j = step.value;
    const tmp = result[i] as T;
    result[i] = result[j] as T;
    result[j] = tmp;
  }
  return { result, state: s };
}

/** Derive a well-distributed 32-bit seed from an arbitrary number. */
export function makeSeed(input: number): number {
  let h = input | 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return (h ^ (h >>> 16)) | 0;
}
