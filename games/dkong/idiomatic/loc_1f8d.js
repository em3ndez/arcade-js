// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1f8d — the between-slots step of the 25m object walk: advance the staging cursor's low byte
 * to the next ACTOR_SPRITES record (in-page), step the object cursor one stride, drop the
 * remaining-slot count, and loop back while any remain. LIVE-OUT: memory-only + the return.
 */

export function loc_1f8d(m, l = m.regs.l, ix = m.regs.ix, de = m.regs.de, b = m.regs.b) {
  b = (b - 1) & 0xff; // djnz counter; no register is live at ret (header), so this stays local
  if (b === 0) return; // loop exhausted -> fall through to ret

  // Loop back into the per-slot check: the frozen register-dispatched callee reads L/IX/B from the
  // register file, so they ride the sanctioned return bridge across the m.call.
  return (m.regs.l = l + 1, m.regs.ix = ix + de, m.regs.b = b, m.call(0x1f83));
}
