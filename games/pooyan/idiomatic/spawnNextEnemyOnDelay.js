// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { launchWolfIntoSlot } from "./launchWolfIntoSlot.js";
import { SHARED_FRAME_DELAY_TIMER, WAVE_NUMBER, ENEMY_ACTOR_TABLE, SPRITE_OBJECT_TABLE } from "./names.js";
/**
 * spawnNextEnemyOnDelay — per-frame enemy spawner driver (delay-gated).
 *
 * WHAT IT IS
 * The pacing valve for an armed wave of enemies. When a wave is set up, all of its wolves are armed
 * at once, but they must not appear on screen in a single clump — they trickle in, one at a time,
 * with a breathing gap between each. This routine runs once per frame and is what enforces that gap:
 * it counts down a shared release delay, and only when the delay has elapsed does it try to bring the
 * next wolf to life. It is the loop that offers each of the wave's record slots, in turn, to the
 * per-record launch attempt, and it stops the moment one wolf is released.
 *
 * ROLE IN THE MACHINE
 * The wave's enemies are described by two parallel 0x18-byte record tables kept in step with each
 * other: an ENEMY-ACTOR record (position, state, animation) at ENEMY_ACTOR_TABLE (0x8ae0), and a
 * paired SPRITE-OBJECT record (the second on-screen sprite a wolf is drawn with) at
 * SPRITE_OBJECT_TABLE (0x8b70). There are eight slot pairs, one stride (0x18) apart. This driver
 * gates on two things before it touches them: the shared release delay SHARED_FRAME_DELAY_TIMER
 * (0x8929) must have reached zero, and the wave-release index WAVE_NUMBER (0x892d) must not yet have
 * reached eight (all eight releases done). Only then does it sweep the eight pairs and hand each to
 * launchWolfIntoSlot, which skips an already-live slot and fills the first free one — reseeding the
 * delay and bumping WAVE_NUMBER as it goes, so the next wolf waits its turn.
 *
 * ROM 0x756d-0x7594.  Grounding: [seen].
 *
 * LIVE-OUT
 * None returned — every effect lands in memory. This routine itself decrements SHARED_FRAME_DELAY_TIMER
 * (0x8929) on a still-running delay; on a release its callee writes the enemy-actor record and (from
 * wave two) the paired sprite-object record, reseeds SHARED_FRAME_DELAY_TIMER, and advances
 * WAVE_NUMBER (0x892d). The loop pointers and counter are locals no other routine reads.
 */
// Layout constants for the two paired record tables: eight slots, one 0x18-byte record apart, and
// the wave-release index value (8) that marks every wolf already released.
const RECORD_STRIDE = 0x18;
const RECORD_COUNT = 0x08;
const ALL_WAVES_SPAWNED = 0x08;

export function spawnNextEnemyOnDelay(m) {
  const { mem8 } = m;
  // RELEASE-DELAY GATE. SHARED_FRAME_DELAY_TIMER (0x8929) is the inter-release gap counter. While it
  // is still non-zero the gap has not elapsed, so tick it down by one and do nothing else this frame
  // — no wolf is offered until the delay reaches zero. This is what spaces the wolves out in time.
  if (mem8[SHARED_FRAME_DELAY_TIMER] !== 0) {
    mem8[SHARED_FRAME_DELAY_TIMER]--; // tick the release-delay counter toward zero
    return;
  }
  // WAVE-BUDGET GATE. WAVE_NUMBER (0x892d) counts releases across the wave; once it reaches eight the
  // whole wave has been let out, so there is nothing left to release — return without touching a slot.
  if (mem8[WAVE_NUMBER] === ALL_WAVES_SPAWNED) return; // every wave member already launched

  // SWEEP THE EIGHT PAIRED SLOTS. Walk the enemy-actor table (0x8ae0) and the sprite-object table
  // (0x8b70) in lockstep, one record (0x18 bytes) per iteration, offering each pair to the launch
  // attempt. The two cursors always point at matching slots so a wolf's actor and its paired sprite
  // are set up together.
  let ix = ENEMY_ACTOR_TABLE;
  let iy = SPRITE_OBJECT_TABLE;
  for (let i = 0; i < RECORD_COUNT; i++) {
    // Offer this slot pair to the per-record launch attempt. It returns true for an already-occupied
    // slot (keep sweeping toward a free one) and false the instant it releases a wolf into a free
    // slot — a release ends the sweep at once, so exactly one wolf is let out per elapsed delay.
    if (!launchWolfIntoSlot(m, ix, iy)) return; // a wolf launched -> caller-skip aborts the sweep
    // Advance both cursors to the next paired record; u16 keeps each a 16-bit address on wrap.
    ix = u16(ix + RECORD_STRIDE);
    iy = u16(iy + RECORD_STRIDE);
  }
}
