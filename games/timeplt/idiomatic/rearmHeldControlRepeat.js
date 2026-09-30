// SPDX-License-Identifier: GPL-3.0-only
/** rearmHeldControlRepeat — empty the press-history byte a caller points at, handing back the zero
 * it now holds. Emptying a full history is what lets a held control act again. LIVE-OUT: both.
 *
 * ROM: 0x1980. Tag [seen] (names.js). Role in the machine: auto-repeat for a held control. A press
 * history is a byte a control's bit is rolled into every other frame; its owner acts on a fresh press,
 * the low three bits reading 001. While the control stays held the byte fills up and that pattern can
 * never recur — so clearing it starts the history over, and the same held press acts again once the
 * byte refills. High-score initials entry uses it on INITIALS_BACK_PRESS_HISTORY 0xA995 [seen] (at
 * 0x7F) and INITIALS_FORWARD_PRESS_HISTORY 0xA996 [seen] (at 0xFF), so a held LEFT or RIGHT keeps
 * stepping the letter.
 *
 * Parameter: `cell` is the address of the history byte to clear (the ROM's HL).
 */

export function rearmHeldControlRepeat(m, cell = m.regs.hl) {
  // Empty the history (ROM: ld (hl),0x00).
  m.mem8[cell] = 0;
  // And hand back zero, as the ROM's `xor a` leaves it in the accumulator for the caller.
  return (m.regs.a = 0);
}
