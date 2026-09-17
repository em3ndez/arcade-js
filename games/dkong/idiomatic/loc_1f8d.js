// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1f8d — the between-slots step of the 25m object walk: advance the staging cursor's LOW byte
 * onto the first byte of the next ACTOR_SPRITES record (low byte only, so it never leaves its page),
 * step the object cursor one stride on, drop the remaining-slot count, and loop back into the
 * per-slot check while any remain. Writes no memory. LIVE-OUT: memory-only plus the propagated
 * return; no register/flag is live (every consumer reloads and re-tests before branching).
 */

export function loc_1f8d(m, l = m.regs.l, ix = m.regs.ix, de = m.regs.de) {
  const { regs } = m;

  regs.l = l + 1;
  regs.ix = ix + de;

  regs.b = regs.b - 1;
  if (regs.b !== 0) return m.call(0x1f83);
}
