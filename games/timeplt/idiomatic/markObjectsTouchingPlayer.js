// SPDX-License-Identifier: GPL-3.0-only
/** markObjectsTouchingPlayer — mark every object in a run that has come within reach of one fixed reference
 * position, and only while a guard byte reads all-ones.
 *
 * Reach is a box, and the caller owns its shape: each axis is measured as the reference minus the
 * object, shifted by an offset and compared against a width, both taken from registers, and the
 * arithmetic wraps at a byte so the test is a wrapped distance rather than a range. An object
 * whose own state byte is not all-ones is skipped without being measured, and one inside the box
 * on BOTH axes has that state byte replaced by a different value — the only thing written. The
 * two cursors advance independently: the state byte's low half only, so the run stays inside one
 * page, and the coordinate cursor by an entry stride. A count of zero walks the whole 256, which
 * is what the count register means rather than a special case.
 *
 * The guard steps the reference's own state byte and leaves that stepped value in the accumulator
 * with the step's flags; a value that is not all-ones bails there, touching nothing else. On the
 * full walk the state cursor is left standing in both the accumulator and E, the sprite cursor in
 * IY, the count run down to zero, and the flags are the ones the final cursor step's ADD set.
 * LIVE-OUT: the state bytes, the two cursors, the count, the accumulator and the flags. */

import { u8, u16 } from "../../../core/int.js";
import { F_C, F_H, F_PV, F_S, F_Z, F_F3, F_F5 } from "../../../core/cpu/z80.js";
import { PLAYER_ENTRY, PLAYER_SPRITE_Y, PLAYER_STATE } from "./names.js";

const SECOND_AXIS_OFFSET = 49;
const ENTRY_STRIDE = 2;
const STATE_STRIDE = 16;
const IN_PLAY = 0xff;
const MARKED = 0xf0;

const sz8 = (v) => (v & 0x80 ? F_S : 0) | (v === 0 ? F_Z : 0) | (v & (F_F3 | F_F5));
/** INC r flags: carry carried in unchanged, N clear, half on a low-nibble roll, PV only at 0x80. */
const incFlags = (carry, res) =>
  carry | sz8(res) | ((res & 0x0f) === 0 ? F_H : 0) | (res === 0x80 ? F_PV : 0);
/** ADD A,v flags for the 8-bit cursor step. */
const addFlags = (a, v) => {
  const sum = a + v;
  const res = sum & 0xff;
  return (
    sz8(res) |
    (sum > 0xff ? F_C : 0) |
    (((a ^ v ^ res) & 0x10) ? F_H : 0) |
    ((~(a ^ v) & (a ^ res) & 0x80) ? F_PV : 0)
  );
};

export function markObjectsTouchingPlayer(m, enterFlags = m.regs.f, offset = m.regs.l, width = m.regs.h, page = m.regs.d << 8, index = m.regs.e, entry = m.regs.iy, left = m.regs.b) {
  const { mem8 } = m;

  const guardStepped = u8(mem8[PLAYER_STATE] + 1);
  if (guardStepped !== 0) {
    return (m.regs.a = guardStepped, m.regs.f = incFlags(enterFlags & F_C, guardStepped), undefined);
  }

  const withinReach = (reference, coordinate) =>
    u8(mem8[reference] - mem8[coordinate] + offset) < width;

  do {
    if (
      mem8[page + index] === IN_PLAY &&
      withinReach(PLAYER_ENTRY, entry) &&
      withinReach(PLAYER_SPRITE_Y, entry + SECOND_AXIS_OFFSET)
    ) {
      mem8[page + index] = MARKED;
    }
    index = u8(index + STATE_STRIDE);
    entry = u16(entry + ENTRY_STRIDE);
    left = u8(left - 1);
  } while (left !== 0);

  // The final iteration's ADD is A = E + stride; A and E exit equal, the flags are that ADD's.
  const flags = addFlags(u8(index - STATE_STRIDE), STATE_STRIDE);
  return (m.regs.a = index, m.regs.f = flags, m.regs.e = index, m.regs.iy = entry, m.regs.b = 0, undefined);
}
