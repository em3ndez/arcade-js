// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearActorArena — zero-fill the whole 0x18-stride actor record arena at board init.
 *
 * Clears the 0x200-byte block starting at ACTOR_TABLE (the player/lead record, the enemy
 * sub-array, and the rest of the arena) so a fresh board starts with no stale actor state.
 * Takes no inputs and calls nothing.
 *
 * LIVE-OUT: memory only — 0x200 zeroed bytes; returns nothing.
 */
import { ACTOR_TABLE } from "./names.js";

const ARENA_BYTES = 0x200; // ACTOR_TABLE .. ACTOR_TABLE+0x1ff inclusive

export function clearActorArena(m) {
  const { mem8 } = m;
  for (let i = 0; i < ARENA_BYTES; i++) mem8[ACTOR_TABLE + i] = 0;
}
