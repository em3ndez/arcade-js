// SPDX-License-Identifier: GPL-3.0-only
/**
 * scanObjectsAtMarioX — find the first collision object standing at Mario's exact X.
 *
 * The broad phase of the per-frame object-collision check, run once a frame from the
 * update cascade. It walks the three collision-object records — four bytes each: X,
 * flags, attributes, Y — comparing every record's X against Mario's.
 *
 *   - On the FIRST record whose X equals Mario's, it hands that record to the narrow
 *     phase, which checks the Y alignment and the record's eligibility and, if both
 *     pass, registers the hit. Once a record matches the scan stops.
 *   - If no record's X matches, nothing is touched.
 *
 * The X test is exact equality, not a range, so a record has to line up with Mario to
 * the pixel before the narrow phase is consulted at all. The three records are
 * contiguous at a four-byte stride, all inside one page.
 *
 * LIVE-OUT: memory-only. Nothing on the no-match arm; on a match, whatever the narrow
 * phase writes — the hit trio, and only when the record is Y-aligned and eligible.
 */
import { MARIO_X, OBJECT_COLLISION_SPRITES } from "./names.js";
import { confirmObjectHit } from "./confirmObjectHit.js";

const RECORD_COUNT = 3;
const RECORD_STRIDE = 4;

export function scanObjectsAtMarioX(m) {
  const { regs, mem } = m;
  const marioX = mem.read8(MARIO_X);

  for (let i = 0; i < RECORD_COUNT; i++) {
    const record = OBJECT_COLLISION_SPRITES + i * RECORD_STRIDE;
    if (marioX === mem.read8(record)) {
      // X-match: hand the record to the narrow phase, which reads it out of the
      // register image, and stop scanning.
      regs.hl = record;
      confirmObjectHit(m);
      return;
    }
  }
  // No record shares Mario's X — return having touched nothing.
}
