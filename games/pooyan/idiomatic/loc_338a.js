// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_338a — low-state per-record dispatcher.
 *
 * Runs only when the record is active (bit0 of (ix+0)|(ix+1) set) and its state (ix+2)&0x1f is
 * below 0x11; then dispatches that state through the shared rst-0x28 trampoline into the inline
 * handler table. The selected handler returns straight to this routine's caller. LIVE-OUT: none —
 * a void dispatch; the dispatch index is marshalled into the still-frozen spine dispatcher.
 */

const ACTIVE_BIT = 0x01;
const STATE_MASK = 0x1f;
const STATE_LIMIT = 0x11;

export function loc_338a(m, rec = m.regs.ix) {
  const { mem8 } = m;
  if (((mem8[rec + 0] | mem8[rec + 1]) & ACTIVE_BIT) === 0) return m.ret(); // inactive slot
  const state = mem8[rec + 2] & STATE_MASK;
  if (state >= STATE_LIMIT) return m.ret(); // index out of range
  m.regs.a = state; // dispatch index (register bridge)
  m.push16(0x339b); // inline jump-table base
  return m.call(0x0028); // rst-0x28 spine dispatcher (unlifted) -> handler -> caller
}
