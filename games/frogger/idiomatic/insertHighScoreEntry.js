// SPDX-License-Identifier: GPL-3.0-only
/**
 * insertHighScoreEntry — insert a 16-bit key (D high, E low) into the 5-entry descending table.
 * LIVE-OUT: memory + register A — the slot-index code, or 0 when nothing was inserted.
 */
import { HIGH_SCORE_TABLE_TOP_HI } from "./names.js";

const SLOTS = 5;
const STRIDE = 2; // 2 bytes/entry: key-high at the slot, key-low just below
const NO_SLOT = 0;

export function insertHighScoreEntry(m, dHi = m.regs.d, eLo = m.regs.e) {
  const { mem8 } = m;

  for (let k = 0; k < SLOTS; k++) {
    const hi = HIGH_SCORE_TABLE_TOP_HI + STRIDE * k;
    const lo = hi - 1;
    const slotHi = mem8[hi];

    // insert when the new key outranks this slot (higher high byte, or equal high and higher low)
    if (dHi > slotHi || (dHi === slotHi && mem8[lo] < eLo)) return insert(k, hi, lo);
    // an exact duplicate at the last slot is reported but not stored
    if (dHi === slotHi && mem8[lo] === eLo && k === SLOTS - 1) return (m.regs.a = 1);
  }
  return (m.regs.a = NO_SLOT); // walked every slot, new key ranks below them all

  function insert(k, hi, lo) {
    const above = SLOTS - 1 - k;
    for (let j = 0; j < above; j++) {
      const from = HIGH_SCORE_TABLE_TOP_HI + STRIDE * (SLOTS - 2 - j); // shift the tail down one slot
      mem8[(from + STRIDE)] = mem8[from];
      mem8[(from + STRIDE - 1)] = mem8[(from - 1)];
    }
    mem8[hi] = dHi;
    mem8[lo] = eLo;
    return (m.regs.a = 4 * above + 1);
  }
}
