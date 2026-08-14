// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0a84 — insert a 16-bit key (D high, E low) into the 5-entry descending table.
 * LIVE-OUT: memory + register A — the slot-index code, or 0 when nothing was inserted.
 */
import { loc_83f2 } from "./names.js";

const SLOTS = 5;
const STRIDE = 2; // 2 bytes/entry: key-high at the slot, key-low just below
const NO_SLOT = 0;

export function loc_0a84(m) {
  const { regs, mem8 } = m;
  const dHi = regs.d;
  const eLo = regs.e;

  for (let k = 0; k < SLOTS; k++) {
    const hi = (loc_83f2 + STRIDE * k) & 0xffff;
    const lo = (hi - 1) & 0xffff;
    const slotHi = mem8[hi];

    // insert when the new key outranks this slot (higher high byte, or equal high and higher low)
    if (dHi > slotHi || (dHi === slotHi && mem8[lo] < eLo)) return insert(k, hi, lo);
    // an exact duplicate at the last slot is reported but not stored
    if (dHi === slotHi && mem8[lo] === eLo && k === SLOTS - 1) { regs.a = 1; return; }
  }
  regs.a = NO_SLOT; // walked every slot, new key ranks below them all

  function insert(k, hi, lo) {
    const above = SLOTS - 1 - k;
    for (let j = 0; j < above; j++) {
      const from = (loc_83f2 + STRIDE * (SLOTS - 2 - j)) & 0xffff; // shift the tail down one slot
      mem8[(from + STRIDE) & 0xffff] = mem8[from];
      mem8[(from + STRIDE - 1) & 0xffff] = mem8[(from - 1) & 0xffff];
    }
    mem8[hi] = dHi;
    mem8[lo] = eLo;
    regs.a = 4 * above + 1;
  }
}
