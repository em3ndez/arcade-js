// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_2334 } from "./loc_2334.js";
import { HUD_INTEGRITY_STRIP_A, COLORRAM_CHECKSUM_SENTINEL } from "./names.js";
/**
 * loc_77c8 — clear an actor slot, then re-seed it behind a colour-RAM integrity check.
 *
 * Always zeroes record fields +0,1,2,3,4,5,6,0x16. If the slot's spawn index (+0x13) is below 5 it
 * returns there. Otherwise it seeds +1=1, +2=3, +0x11=0x80 and walks 10 colour-RAM cells upward from
 * HUD_INTEGRITY_STRIP_A (0x20-row stride): each must equal its neighbour one row up, and the running
 * sum + 0x83 must equal the sentinel byte. A neighbour mismatch jumps into a data table (rst-0x38
 * garbage) — a tamper trap modelled as a throw; a sum mismatch tail-jumps to the tamper handler.
 *
 * LIVE-OUT: none (memory only) — an actor-slot (re)initialiser read back from IX.
 */

const CHECK_CELLS = 10; //   colour-RAM cells summed by the integrity walk
const ROW_STRIDE = 0x20; //  one tile row (the walk steps UP one row per cell)
const CHECKSUM_BIAS = 0x83; // added to the running sum before the sentinel compare

export function loc_77c8(m, record = m.regs.ix) {
  const { mem8 } = m;

  for (const off of [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x16]) mem8[record + off] = 0x00;
  if (mem8[record + 0x13] < 0x05) return; // spawn index below 5 -> slot stays cleared

  mem8[record + 0x01] = 0x01;
  mem8[record + 0x02] = 0x03;
  mem8[record + 0x11] = 0x80;

  let ptr = HUD_INTEGRITY_STRIP_A;
  let sum = 0;
  for (let i = 0; i < CHECK_CELLS; i++) {
    const cell = mem8[ptr];
    ptr = u16(ptr - ROW_STRIDE); // step up one row
    // a neighbour mismatch jumps into a data table (rst-0x38 garbage) — a tamper trap
    if (cell !== mem8[ptr]) throw new Error("loc_77c8: colour-RAM integrity mismatch (tamper trap)");
    sum = (sum + cell) & 0xff;
  }
  if (((sum + CHECKSUM_BIAS) & 0xff) !== mem8[COLORRAM_CHECKSUM_SENTINEL]) return loc_2334(m); // sum mismatch -> tamper handler
}
