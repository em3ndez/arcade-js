// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearActorArena — wipe the actor-record arena to zero at board init.
 *
 * ROM 0x19bc-0x19c9. Grounding: [seen].
 *
 * The arena is the block of RAM the engine uses to track every live actor on the
 * board — the player/lead actor and the enemies. It starts at ACTOR_TABLE (0x8a80)
 * and is laid out as an array of fixed 0x18-byte records: slot 0 is the player/lead
 * actor, and the later slots hold the enemy sub-array and the rest of the actor
 * bookkeeping. This routine blanks the whole 0x200-byte span (ACTOR_TABLE through
 * ACTOR_TABLE+0x1FF inclusive) so a fresh board begins with no actor carried over
 * from the previous one — no stale positions, states, or animation cursors.
 *
 * On the hardware this is a seed-and-propagate fill: the first byte is written to 0,
 * then a block-copy walks the zero forward across the remaining 0x1FF bytes. The
 * effect is simply "every byte in the span becomes 0", which is what the loop below
 * does directly.
 *
 * A pure leaf: it reads no input and calls nothing.
 *
 * LIVE-OUT: memory only — 0x200 zeroed bytes at ACTOR_TABLE. Returns nothing.
 */
import { ACTOR_TABLE } from "./names.js";

// Span of the arena: ACTOR_TABLE .. ACTOR_TABLE+0x1ff inclusive. On the hardware
// this is one seeding store plus a 0x1ff-byte block-copy = 0x200 bytes total.
const ARENA_BYTES = 0x200;

export function clearActorArena(m) {
  const { mem8 } = m;

  // Zero every byte of the actor arena, front to back, so no actor state survives
  // from the previous board into this one.
  for (let i = 0; i < ARENA_BYTES; i++) mem8[ACTOR_TABLE + i] = 0;
}
