// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearActorArenaAndCounters — tear down all actor state and hand off to the next
 * in-play sub-state.
 *
 * ROM 0x2ae8-0x2b03. Grounding: [seen].
 *
 * This is the teardown handler reached when the in-play sub-state (PLAY_STATE_INDEX,
 * 0x880a) is 7. It resets the engine's live actor bookkeeping so the next phase
 * starts clean, then advances the sub-state so the machine moves on.
 *
 * Three things happen:
 *   - The actor arena at ACTOR_TABLE (0x8a80) is blanked. The arena is the array of
 *     fixed 0x18-byte actor records (slot 0 the player/lead, the rest enemies and
 *     bookkeeping); zeroing it drops every live actor. This teardown clears a slightly
 *     larger span than the plain board-init wipe — a 0x241-byte block (a seeding
 *     store plus a 0x240-byte block-copy on the hardware).
 *   - The three spawn/wave/rope counters are reset to 0:
 *       · SPAWN_PHASE_COUNTER (0x8902) — the per-round phase counter that selects the
 *         spawn/fire mode branch.
 *       · WAVE_ARRIVAL_COUNTER (0x8903) — the per-stage counter bumped as enemies
 *         arrive, which also bounds the rope-segment count.
 *       · ROPE_SEGMENT_COUNT (0x8931) — the count of currently-extended rope segments.
 *     With all three at 0 the next stage begins with no wave progress and no rope out.
 *   - PLAY_STATE_INDEX (0x880a) is forced to 6, the sub-state this teardown hands off
 *     to.
 *
 * A leaf: it calls nothing.
 *
 * LIVE-OUT: memory only — the zeroed arena, the three cleared counters, and
 * PLAY_STATE_INDEX = 6. No register or flag is returned.
 */
import {
  ACTOR_TABLE,
  SPAWN_PHASE_COUNTER,
  WAVE_ARRIVAL_COUNTER,
  ROPE_SEGMENT_COUNT,
  PLAY_STATE_INDEX,
} from "./names.js";

// Teardown span of the arena: one seeding store at ACTOR_TABLE plus a 0x240-byte
// block-copy on the hardware = 0x241 bytes cleared in total.
const ACTOR_ARENA_LEN = 0x241;

// The in-play sub-state this teardown advances PLAY_STATE_INDEX to on completion.
const STATE_AFTER_TEARDOWN = 6;

export function clearActorArenaAndCounters(m) {
  const { mem8 } = m;

  // Blank the actor arena, dropping every live actor so the next phase starts clean.
  for (let i = 0; i < ACTOR_ARENA_LEN; i++) mem8[ACTOR_TABLE + i] = 0;

  // Reset the spawn/wave/rope progress counters — no wave progress, no rope extended.
  mem8[SPAWN_PHASE_COUNTER] = 0;
  mem8[WAVE_ARRIVAL_COUNTER] = 0;
  mem8[ROPE_SEGMENT_COUNT] = 0;

  // Advance the in-play sub-state so the machine leaves teardown for the next phase.
  mem8[PLAY_STATE_INDEX] = STATE_AFTER_TEARDOWN;
}
