// SPDX-License-Identifier: GPL-3.0-only
/**
 * serviceBarrelSlotIfLive — the barrel walk's per-slot gate: hand a live record to the motion
 * dispatch, or step the staging cursor past the record this slot leaves alone.
 *
 * This is the head of every pass round the walk. It reads one byte — the record's OBJ_ACTIVE —
 * and picks between the two halves of the loop body. A live record is handed whole to the motion
 * dispatch, which takes the staging cursor over with it. Anything else is skipped, and the skip's
 * whole job is to move that cursor over the four bytes this slot did not write. It moves three of
 * them; the fourth belongs to the between-slots step both halves converge on, so the cursor
 * arrives on a record boundary whichever half ran.
 *
 * THE TEST IS EQUALITY WITH 1, NOT A BIT TEST, and the difference is real rather than pedantic:
 * a record holding 2 is skipped exactly as one holding 0 is, so a slot that has been spoken for
 * but is not yet running never reaches the motion dispatch. A bit test would have admitted it.
 * That is what the IF LIVE in the name means, and it is the routine's whole behaviour on the skip
 * arm. Whether a fourth value can occur at all is NOT established here.
 *
 * WHAT THIS FILE DOES NOT CLAIM: it writes no memory and interprets no field of the record beyond
 * that one flag, so what the records HOLD and what the staged bytes MEAN are not derivable here.
 *
 * LIVE-OUT: the staging cursor's low byte, left in the register the continuation reads it from,
 * plus the propagated return value. NO accumulator and NO flag: the two operations that follow on
 * either continuation rewrite every bit of the flag byte except the carry, and the four
 * operations here (one decrement, three increments) leave the carry alone, so it passes through
 * unchanged.
 */

import { OBJ_ACTIVE } from "./names.js";

export function serviceBarrelSlotIfLive(m) {
  const { regs, mem8 } = m;

  // An active record — and only a flag of exactly 1 counts — is animated and staged by the
  // active-slot dispatch, which advances the staging cursor itself as it writes.
  if (mem8[regs.ix + OBJ_ACTIVE] === 1) return m.call(0x1f93);

  // Otherwise this slot stages nothing, so its four sprite bytes keep whatever they held and the
  // cursor simply steps over them. Three moves here, the fourth in the between-slots step. Only
  // the cursor's low byte moves, so it can never leave the page it is in.
  regs.l = regs.l + 3;
  return m.call(0x1f8d);
}
