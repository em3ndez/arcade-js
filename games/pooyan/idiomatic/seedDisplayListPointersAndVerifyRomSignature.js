// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { reinitRoundArenaAndPlayfieldIfImageIntact } from "./reinitRoundArenaAndPlayfieldIfImageIntact.js";
import {
  SUBPHASE_TICK,
  DISPLAY_LIST_SRC_PTR_ALT,
  DISPLAY_LIST_SRC_PTR,
  DISPLAY_LIST_DST_PTR_ALT,
  DISPLAY_LIST_DST_PTR,
  SELFTEST_DISPATCH_STATE,
  SELFTEST_REF_COPY_BOOT,
  ATTRACT_LIST_SRC_ALT_SEED,
  ATTRACT_LIST_SRC_SEED,
  ATTRACT_LIST_DST_SEED,
  PLAYFIELD_PAINT_START,
  BOOT_CODE_BASE,
  SELFTEST_LOOP2_SCAN_BASE,
} from "./names.js";
/**
 * seedDisplayListPointersAndVerifyRomSignature — attract/self-test state 0.
 *
 * Seeds the attract display-list pointer pairs and clears the sub-phase tick, advances the
 * self-test dispatch selector, then runs a two-stage program-signature check: loop 1 compares the
 * first eight boot bytes against their reference copy, loop 2 compares a 0x74-byte program window
 * against its reference copy. A loop-2 divergence aborts into the screen re-init handler; an intact
 * image (both references are verbatim copies of the checked code) returns after the loops with only
 * the seed writes applied.
 *
 * LIVE-OUT: none — a tail-dispatched state handler; the loop scratch registers are consumed by
 * nobody. `ix` is read only on the loop-1-mismatch path, which an intact image never reaches.
 */
const LOOP1_COUNT = 0x08; //   boot bytes checked in loop 1
const LOOP2_COUNT = 0x74; //   program bytes checked in loop 2

export function seedDisplayListPointersAndVerifyRomSignature(m, ix = m.regs.ix) {
  const { mem8 } = m;

  mem8[SUBPHASE_TICK] = 0x00;
  mem8[DISPLAY_LIST_SRC_PTR_ALT] = ATTRACT_LIST_SRC_ALT_SEED;
  mem8[DISPLAY_LIST_SRC_PTR_ALT + 1] = ATTRACT_LIST_SRC_ALT_SEED >> 8;
  mem8[DISPLAY_LIST_SRC_PTR] = ATTRACT_LIST_SRC_SEED;
  mem8[DISPLAY_LIST_SRC_PTR + 1] = ATTRACT_LIST_SRC_SEED >> 8;
  mem8[DISPLAY_LIST_DST_PTR_ALT] = PLAYFIELD_PAINT_START;
  mem8[DISPLAY_LIST_DST_PTR_ALT + 1] = PLAYFIELD_PAINT_START >> 8;
  mem8[DISPLAY_LIST_DST_PTR] = ATTRACT_LIST_DST_SEED;
  mem8[DISPLAY_LIST_DST_PTR + 1] = ATTRACT_LIST_DST_SEED >> 8;
  mem8[SELFTEST_DISPATCH_STATE] = mem8[SELFTEST_DISPATCH_STATE] + 1; // advance the selector

  // Loop 1: the first eight boot bytes vs their reference copy.
  let ref = SELFTEST_REF_COPY_BOOT;
  let src = BOOT_CODE_BASE;
  let count = LOOP1_COUNT;
  let mismatch = false;
  for (;;) {
    if (mem8[src] !== mem8[ref]) { mismatch = true; break; }
    ref = u16(ref + 1);
    src = u16(src + 1);
    if (--count !== 0) continue;
    break;
  }
  if (!mismatch) { //                    clean loop 1: reseat the loop-2 walk (ref carries straight on)
    ix = SELFTEST_LOOP2_SCAN_BASE;
    count = LOOP2_COUNT;
  }

  // Loop 2: the program window vs its reference copy; any miss aborts into the re-init handler.
  for (;;) {
    if (mem8[ix] !== mem8[ref]) return reinitRoundArenaAndPlayfieldIfImageIntact(m);
    ref = u16(ref + 1);
    ix = u16(ix + 1); // the hardware walks the low byte with a carry up: a 16-bit increment
    if (--count !== 0) continue;
    break;
  }
}
