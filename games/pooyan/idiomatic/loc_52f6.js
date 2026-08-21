// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  SCRIPT_ADVANCE_GUARD,
  SLOT_SWEEP_LATCH,
  ENEMY_ACTOR_TABLE,
  SLOT_SWEEP_CKSUM_BASE,
  TAMPER_STRIKES_SLOTSWEEP,
} from "./names.js";
import { loc_0020 } from "./loc_0020.js";
/**
 * loc_52f6 — gated slot sweep with a code-region checksum tripwire.
 *
 * Runs only while the advance guard is set and the sweep latch is still clear. Counts the
 * empty records (leading word zero) among six stride-0x18 slots; with fewer than four free
 * it bails. Otherwise it latches the free count, then folds a running sum over a fixed
 * twenty-three-byte code block; if that sum misses its expected value it bumps a tamper
 * strike counter.
 *
 * LIVE-OUT: none. The trampoline caller ignores the result and runs the next routine.
 */

const SLOT_COUNT = 6; // records swept
const SLOT_STRIDE = 0x18; // record pitch
const MIN_FREE = 4; // fewer free than this and the sweep bails
const CKSUM_LEN = 0x17; // bytes folded into the running sum
const CKSUM_LO = 0x15; // expected low byte of the sum
const CKSUM_HI = 0x09; // expected high byte of the sum

export function loc_52f6(m) {
  const { mem8 } = m;

  if (mem8[SCRIPT_ADVANCE_GUARD] === 0) return; // guard clear
  if (mem8[SLOT_SWEEP_LATCH] !== 0) return; // already swept

  let free = 0;
  let rec = ENEMY_ACTOR_TABLE;
  for (let i = 0; i < SLOT_COUNT; i++) {
    if ((mem8[rec] | mem8[rec + 1]) === 0) free++; // empty: leading word zero
    rec = u16(rec + SLOT_STRIDE);
  }
  if (free < MIN_FREE) return;
  mem8[SLOT_SWEEP_LATCH] = free;

  let sum = 0;
  let src = SLOT_SWEEP_CKSUM_BASE;
  for (let i = 0; i < CKSUM_LEN; i++) {
    sum = loc_0020(m, sum, mem8[src])[1]; // fold: sum += code[src]
    src = u16(src - 1);
  }
  if ((sum & 0xff) === CKSUM_LO && (sum >> 8) === CKSUM_HI) return; // checksum matches
  mem8[TAMPER_STRIKES_SLOTSWEEP] = u8(mem8[TAMPER_STRIKES_SLOTSWEEP] + 1);
}
