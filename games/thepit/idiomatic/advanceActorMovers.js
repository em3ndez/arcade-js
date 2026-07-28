// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceActorMovers — advance the two-sprite actor's record(s) through the shared
 * move/collision driver, then stage its sprite records for display.  ROM 0x3a13.
 *
 * This is the two-sprite actor's per-frame update once it enters its late/travel
 * phase (the caller hands the frame here instead of running the simple inline walk
 * step). The move/collision driver works out of one fixed working block, so each
 * record is advanced the same way: copy the 17-byte record into the working block,
 * run the driver to step and collide it in place, then copy the result back.
 *
 *   - The primary actor record is always advanced.
 *   - The second (twin) record is advanced only while its gate byte is set; when the
 *     gate is clear the twin is left as it stands and this frame moves straight on.
 *
 * Either way the routine finishes by staging both sprite records into the sprite
 * buffer, so the freshly-advanced positions are what draws next frame.
 *
 * Touches only fixed work RAM; takes nothing and returns nothing.
 *
 * Memory-equivalent to the frozen oracle — equivalence-3a13.test.js.
 * GATE:     real captured attract dispatches (the demo runs the actor's primary record
 *           through here from ~frame 700, but the second-record gate is 0 for all of
 *           attract) + a crafted entry that pokes the gate nonzero on both sides to
 *           drive the twin record too. Compared to the oracle over work RAM (dumpState)
 *           outside the dead top-of-stack scratch the oracle's driver call leaves.
 *           Teeth catch a dropped copy-back and a skipped second record.
 * LIVE-OUT: memory-only — the advanced record(s) and the two staged sprite records.
 *           The move driver and the sprite-staging tail leave no register a caller reads
 *           (the actor is reached by tail-jump; dead ABI).
 * NAMES:    ACTOR_X (0x810a, primary record base), TWIN_X (0x811b, second record base),
 *           DIAMOND_COLLECTED (0x8078, read here as the second-record gate — the shared byte
 *           whose twin-advance coupling vs reuse is unproven, see ram.js) from ram.js. Kept
 *           hex: 0x8083 (the driver's shared working block) has no ram.js name yet.
 */

import { ACTOR_X, TWIN_X, DIAMOND_COLLECTED } from "./ram.js";
import { stepEnemyMover } from "./stepEnemyMover.js";
import { stageActorSpriteRecords } from "./stageActorSpriteRecords.js";

// The move/collision driver's shared working block: a record is copied in, driven in
// place, then copied back out.
const MOVER_SCRATCH = 0x8083;
// Second-record gate: nonzero means also advance the twin record this frame. This is the
// same physical byte as DIAMOND_COLLECTED (0x8078); whether the twin-advance couples to the
// diamond-collect flag or merely reuses the byte is UNPROVEN (see ram.js caveat).
// Object records are 17 bytes each; the primary and twin sit back to back.
const RECORD_SIZE = 17;

/** Advance one 17-byte object record through the move/collision driver: copy it into
 *  the driver's working block, run the driver, then copy the stepped result back. */
function driveRecordThroughMover(m, recordBase) {
  const { mem8 } = m;
  for (let i = 0; i < RECORD_SIZE; i++) mem8[MOVER_SCRATCH + i] = mem8[recordBase + i];
  stepEnemyMover(m);
  for (let i = 0; i < RECORD_SIZE; i++) mem8[recordBase + i] = mem8[MOVER_SCRATCH + i];
}

export function advanceActorMovers(m) {
  const { mem8 } = m;

  // The primary actor record always steps this frame.
  driveRecordThroughMover(m, ACTOR_X);

  // The twin record steps too only while its gate is set.
  if (mem8[DIAMOND_COLLECTED] !== 0) driveRecordThroughMover(m, TWIN_X);

  // Both paths finish by staging the two sprite records for the display.
  return stageActorSpriteRecords(m);
}
