// SPDX-License-Identifier: GPL-3.0-only
import { u16, u8 } from "../../../core/int.js";
import {
  ACTIVE_PLAYER,
  CABINET_MODE_FLAG,
  HIGH_SCORE_INSERT_RANK,
  PLAYER2_START_CLEAR_BLOCK,
  loc_8565,
  loc_8811,
  loc_8812,
  loc_8dfd,
  loc_8e21,
  loc_8e23,
  loc_8e24,
  loc_8e25,
  loc_8e26,
  loc_8e27,
  loc_8e2b,
  FIRE_PHASE_SEED,
} from "./names.js";

/**
 * loc_7eb2 — write-anim dispatch entry 0. Seeds the animation work-block from the pass count.
 *
 * Two count-driven walks advance a record pointer (+3 per pass) and a stamp pointer (+2 per pass);
 * a seed of 0 runs 256 passes (the count wraps down through 0). Selects the source pointer from
 * the cabinet and active-player flags, stamps the landing address, and seeds the fixed fields.
 *
 * LIVE-OUT: none — a void handler; only the memory writes survive.
 */

const RECORD_STRIDE = 0x03; // +3 per pass
const WRITE_PTR_STEP = 0x02; //  +2 per pass
const STAMP_BYTE = 0x11; //      written at the landing address

export function loc_7eb2(m) {
  const { mem8, mem16 } = m;

  const count = mem8[HIGH_SCORE_INSERT_RANK]; // pass count for both walks

  mem16[loc_8e27] = loc_8565; // stash the stamp base (read back for the second walk)
  mem8[loc_8e25] = 0x03;
  mem16[loc_8e2b] = FIRE_PHASE_SEED;

  // Record walk: pointer += 3 per pass (a 0 seed runs 256 passes).
  let recordPtr = loc_8dfd;
  let b = count;
  do {
    recordPtr = u16(recordPtr + RECORD_STRIDE);
    b = u8(b - 1);
  } while (b !== 0);
  mem16[PLAYER2_START_CLEAR_BLOCK] = recordPtr;

  // Source pointer: default, unless cabinet flag clear AND active-player flag set -> alternate.
  let srcPtr = loc_8811;
  if (mem8[CABINET_MODE_FLAG] === 0 && mem8[ACTIVE_PLAYER] !== 0) srcPtr = loc_8812;
  mem16[loc_8e21] = srcPtr;

  // Stamp-pointer walk: pointer += 2 per pass (same seed).
  let writePtr = mem16[loc_8e27]; // the stamp base
  let b2 = count;
  do {
    writePtr = u16(writePtr + WRITE_PTR_STEP);
    b2 = u8(b2 - 1);
  } while (b2 !== 0);
  mem16[loc_8e27] = writePtr; // advanced pointer

  mem8[writePtr] = STAMP_BYTE; // stamp at the landing address
  mem8[loc_8e23] = STAMP_BYTE;
  mem8[loc_8e26] = 0x01;
  mem8[loc_8e24] = 0x0c;
}
