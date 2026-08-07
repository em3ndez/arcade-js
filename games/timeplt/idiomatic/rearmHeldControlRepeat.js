// SPDX-License-Identifier: GPL-3.0-only
/** rearmHeldControlRepeat — empty the press-history byte a caller points at, handing back the zero
 * it now holds. Emptying a full history is what lets a held control act again. LIVE-OUT: both. */

export function rearmHeldControlRepeat(m, cell = m.regs.hl) {
  m.mem8[cell] = 0;
  m.regs.a = 0;
  return 0;
}
