// SPDX-License-Identifier: GPL-3.0-only
import { loc_0c45 } from "./loc_0c45.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { loc_418d } from "./loc_418d.js";
import { ARM_ANIM_TABLE } from "./names.js";
/**
 * loc_417a — (re)arm an object record, then fall into its countdown tail.
 *
 * Looks up the arm-animation pointer for the record's arm index (rec+0x17) in the pointer table,
 * points the record at that sequence, seats the (rec+0x11) countdown, bumps the (rec+0x02) state,
 * then tails into the shared object countdown/dwell continuation.
 *
 * LIVE-OUT: none — a shared object-state tail; all effect is in memory.
 */
const REC_ARM_INDEX = 0x17;
const REC_COUNTDOWN = 0x11;
const REC_STATE = 0x02;
const COUNTDOWN_SEED = 0x30;

export function loc_417a(m, rec = m.regs.ix) {
  const { mem8 } = m;
  loc_0c45(m, mem8[rec + REC_ARM_INDEX], ARM_ANIM_TABLE); // DE := table[arm index]
  setActorAnimation(m, rec); // point the record at the looked-up sequence (consumes DE)
  mem8[rec + REC_COUNTDOWN] = COUNTDOWN_SEED;
  mem8[rec + REC_STATE] = mem8[rec + REC_STATE] + 1;
  return loc_418d(m, rec);
}
