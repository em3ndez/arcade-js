// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { GAME_MODE, NIBBLE_EMIT_COUNT, NIBBLE_EMIT_INDEX } from "./names.js";
import { emitStrokeWordFromNibble } from "./emitStrokeWordFromNibble.js";

// Emit a run of y zeropage bytes, top index a+y-1 downward: each byte's high
// nibble then its low nibble, chaining carry so only the final low nibble sees
// it cleared (the terminator marker).
export function emitNibbleDigitRun(m, a = m.regs.a, y = m.regs.y) {
  const { mem8 } = m;
  let count = (y - 1) & 0xff;
  mem8[NIBBLE_EMIT_COUNT] = count;
  let x = (a + count) & 0xff;
  let carry = true;
  do {
    mem8[NIBBLE_EMIT_INDEX] = x;
    const byte = mem8[u16(GAME_MODE + x)];
    const high = byte >> 4;
    emitStrokeWordFromNibble(m, high, carry);
    const carryHigh = carry && high === 0;
    const last = count === 0;
    const carryLow = last ? false : carryHigh;
    emitStrokeWordFromNibble(m, byte, carryLow);
    carry = carryLow && (byte & 0x0f) === 0;
    x = (mem8[NIBBLE_EMIT_INDEX] - 1) & 0xff;
    count = (mem8[NIBBLE_EMIT_COUNT] - 1) & 0xff;
    mem8[NIBBLE_EMIT_COUNT] = count;
  } while (count < 0x80);
}
