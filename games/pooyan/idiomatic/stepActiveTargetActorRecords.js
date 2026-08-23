// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { advanceTargetActorState } from "./advanceTargetActorState.js";
import { advanceActorAnimationsUnlessGrabbing } from "./advanceActorAnimationsUnlessGrabbing.js";
import {
  ENEMY_TARGET_REC0,
  TARGET_SCAN_COUNTER,
  ANIM_SCRIPT_CURSOR,
  TARGET_SPAWN_ARM_LATCH,
} from "./names.js";
/**
 * Step the two target actor records. Each pass runs the per-object stepper on a record
 * whose presence bit0 is set; the pass count lives in a memory cell so it survives the stepper.
 * After both records it runs a tamper check on the anim-script cursor: a mismatch tail-jumps the
 * grab-record walk, a match zeroes the follow-up cell and returns.
 *
 * LIVE-OUT: none on the match path (the caller reads memory); the mismatch path forwards the
 * grab-record walk's own live-out.
 */

const STRIDE = 0x18; // target-record stride
const TAMPER_BIAS = 0x0c; // subtracted from the cursor before the reference
const TAMPER_REF = 0xc9; // reference byte

export function stepActiveTargetActorRecords(m) {
  const { mem8 } = m;

  let rec = ENEMY_TARGET_REC0;
  let count = 0x02;
  do {
    mem8[TARGET_SCAN_COUNTER] = count;
    if (mem8[rec] & 0x01) advanceTargetActorState(m, rec); // presence bit0 set -> step this object
    rec = u16(rec + STRIDE);
    count = u8(mem8[TARGET_SCAN_COUNTER] - 1);
  } while (count !== 0);

  // tamper check: the cursor must equal the biased reference
  if (u8(mem8[ANIM_SCRIPT_CURSOR] - TAMPER_BIAS - TAMPER_REF) !== 0) return advanceActorAnimationsUnlessGrabbing(m);
  mem8[TARGET_SPAWN_ARM_LATCH] = 0;
}
