// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { advanceOverlapScanToNextSlot } from "./advanceOverlapScanToNextSlot.js";
import { loc_613d } from "./loc_613d.js";
import { queueSoundCommand09 } from "./queueSoundCommand09.js";
import { FLIP_SCREEN_FLAG, loc_8d45, loc_8c91, loc_8ca9 } from "./names.js";
/**
 * loc_5fa2 — one pass of the six-slot overlap scan: does the record at recPtr overlap the target box?
 *
 * An empty slot (record byte0 == 0) or a non-type-5 record (byte2 != 5) advances to the next slot.
 * Otherwise it measures the axis distances between the record's position box and the target, biasing
 * the X box by the screen-flip sign, and applies per-axis windows — the wider pair (0x10 / 0x12) when
 * the hit type is 3, the tighter pair (8 / 8) otherwise. Any axis outside its window advances. A full
 * overlap of a type-3 record retargets and retires it; a full overlap of any other type flags the two
 * struck-record cells, enqueues the hit sound, and skip-returns.
 *
 * SEATING: the miss branches TAIL to the advance-and-loop latch; the type-3 hit TAILs to the retire
 * handler; the general hit is a caller-skip (pop af; ret) dissolved to a boolean. Return protocol
 * (shared with the latch): true = the sweep exhausted with no hit, false = a hit aborts the caller's
 * loop. LIVE-OUT: the boolean plus memory (the invariant hit type is threaded to the latch's re-entry).
 */

const RECORD_TYPE = 0x05; //  the only record type the scan considers
const TYPE3_DX = 0x10; //     type-3 X window (wider)
const TYPE3_DY = 0x12; //     type-3 Y window
const NEAR_D = 0x08; //       tight window for every other type
const X_BIAS_NORMAL = 0x06; //  screen-flag set -> +6 X bias
const X_BIAS_FLIPPED = 0xfb; // screen-flag clear -> -5 X bias
const Y_BIAS = 0x08; //       both boxes carry a fixed +8 Y bias
const TARGET_LOW_A = 0x48; //   target box low byte picking the first struck cell
const STRUCK_PARTNER = 0x06;

const absDiff = (x, y) => (x >= y ? x - y : y - x);

export function loc_5fa2(m, recPtr = m.regs.hl, posPtr = m.regs.ix, slots = m.regs.b, type = m.regs.c, target = m.regs.iy) {
  const { mem8 } = m;

  // empty slot or non-type-5 record -> advance to the next slot (thread the invariant type)
  if (mem8[recPtr] === 0 || mem8[recPtr + 2] !== RECORD_TYPE) {
    return (m.regs.c = type, advanceOverlapScanToNextSlot(m, posPtr, recPtr, slots));
  }

  const tight = type === 0x03;
  const xBias = mem8[FLIP_SCREEN_FLAG] !== 0 ? X_BIAS_NORMAL : X_BIAS_FLIPPED;
  const posX = u8(mem8[posPtr] + xBias);
  const posY = u8(mem8[posPtr + 2] + Y_BIAS);
  const dx = absDiff(mem8[target], posX);
  const dy = absDiff(u8(mem8[target + 2] + Y_BIAS), posY);

  // outside either window -> advance
  if (dx >= (tight ? TYPE3_DX : NEAR_D) || dy >= (tight ? TYPE3_DY : NEAR_D)) {
    return (m.regs.c = type, advanceOverlapScanToNextSlot(m, posPtr, recPtr, slots));
  }

  if (tight) {
    // type-3 overlap: retarget onto this record, tally the hit, retire it
    mem8[loc_8d45] = u8(mem8[loc_8d45] + 1);
    return loc_613d(m, recPtr);
  }

  // general overlap: flag the struck record's cell + its partner, sound the hit, skip-return
  const cell = (target & 0xff) === TARGET_LOW_A ? loc_8c91 : loc_8ca9;
  mem8[cell] = 0x01;
  mem8[cell + STRUCK_PARTNER] = 0x01;
  queueSoundCommand09(m);
  return false;
}
