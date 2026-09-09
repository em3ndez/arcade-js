// SPDX-License-Identifier: GPL-3.0-only
import { readEaromCell } from "./readEaromCell.js";
import { loc_00, loc_f9, loc_fa, HIGH_SCORE_TABLE, EAROM_DATA_WINDOW, EAROM_CONTROL } from "./names.js";

/**
 * tickEaromWriteback — periodic NVRAM erase/write machine that flushes the RAM high-score
 * mirror back one slot per pass. Runs every 4th frame; alternates a scan/erase half and a
 * commit half, driven by a slot cursor and a phase bit. [code]
 */
export function tickEaromWriteback(m) {
  const { mem8 } = m;
  let a = mem8[loc_00] & 0x03;               // frame phase
  if (a !== 0) return;                        // act only every 4th frame
  mem8[EAROM_CONTROL] = a;                         // a == 0: release the control lines
  let x = mem8[loc_f9];                       // writeback cursor
  if (x & 0x80) return;                       // no slot pending
  const phase = mem8[loc_fa];
  mem8[loc_fa] = phase >> 1;                  // shift out old bit0
  if ((phase & 0x01) !== 0) {                 // commit half
    mem8[EAROM_CONTROL] = 0x02;                    // arm write
    mem8[EAROM_CONTROL] = 0x0a;                    // strobe: commit the latched byte
    mem8[loc_f9] = x - 1;
    return;
  }
  // scan/erase half
  for (;;) {
    a = readEaromCell(m, a, x);              // A = cell[X]
    if (a !== mem8[HIGH_SCORE_TABLE + x]) {          // mismatch -> dirty slot
      mem8[loc_f9] = x;                       // park on the dirty slot
      mem8[EAROM_CONTROL] = 0x06;                  // arm erase
      const want = mem8[HIGH_SCORE_TABLE + x];        // the RAM byte to persist
      mem8[EAROM_DATA_WINDOW + x] = want;
      mem8[EAROM_CONTROL] = 0x0e;                  // strobe: erase cell (write commits next phase)
      mem8[loc_fa] = mem8[loc_fa] + 1;        // flip to the commit phase
      return;
    }
    x = (x - 1) & 0xff;
    if (x & 0x80) break;                      // every slot matched
  }
  mem8[loc_f9] = x;                            // x == 0xff: nothing pending
}
