/**
 * Public entry point for the pure game core.
 *
 * The core is framework-agnostic: it must never import React, the DOM, or any
 * third-party runtime package. Everything here is plain, deterministic,
 * serializable TypeScript so the engine can be unit-tested with Node's native
 * test runner and reused unchanged by the UI, the AI bots, and (future) a
 * server for online play.
 */

/** Save/serialization format version. Bumped when GameState shape changes. */
export const STATE_VERSION = 1;

/** Human-readable engine identifier, surfaced in logs and save metadata. */
export const ENGINE_NAME = 'myspolly-core';
