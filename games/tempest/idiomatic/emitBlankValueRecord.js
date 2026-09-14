// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { DRAW_CURSOR_LO, DRAW_CURSOR_HI } from "./names.js";

/**
 * emitBlankValueRecord — write a zeroed four-byte draw record capped by A. ROM 0xb56a.
 *
 * Role in the machine: the draw stream is assembled as fixed-width records at a moving 16-bit write
 * pointer held in DRAW_CURSOR_LO / DRAW_CURSOR_HI. This lays down a "blank value" record — three zero
 * bytes followed by the caller's byte A — which callers use to reserve/space a record slot while
 * stamping a single meaningful value (A) into its last field.
 *
 * Behavior: forms the 16-bit cursor from its low/high halves; stores 0, 0, 0, A into the four bytes at
 * that address; then advances the cursor by four, adding to the low byte and carrying one into the high
 * byte when the low byte overflows past 0xff.
 *
 * Live-out: four bytes written at the old cursor; DRAW_CURSOR_LO / DRAW_CURSOR_HI advanced by four.
 * Grounding: [seen].
 */
export function emitBlankValueRecord(m, a = m.regs.a) {
  const { mem8 } = m;
  const ptr = mem8[DRAW_CURSOR_LO] | (mem8[DRAW_CURSOR_HI] << 8);   // 16-bit draw write pointer
  mem8[u16(ptr)] = 0;                                   // three padding/zero fields...
  mem8[u16(ptr + 1)] = 0;
  mem8[u16(ptr + 2)] = 0;
  mem8[u16(ptr + 3)] = a;                               // ...then the caller's value byte
  const sum = mem8[DRAW_CURSOR_LO] + 4;                 // advance the low byte, carrying into the high byte
  mem8[DRAW_CURSOR_LO] = sum;
  if (sum > 0xff) mem8[DRAW_CURSOR_HI] = (mem8[DRAW_CURSOR_HI] + 1);
}
