// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawStackedBcdDigits — paint a packed-BCD byte as two stacked digit tiles: tens at the
 * cursor, units one tilemap row above it (toward lower addresses in memory order).
 *
 * Leading-zero suppression: a zero tens digit draws as the blank tile, not "0".
 * Pure leaf — two tile writes, reads only its inputs, calls nothing.
 *
 * LIVE-OUT (return-assignment bridge): SETS HL (the advanced cursor), E (the source byte), and
 * BC (the up-a-row stride) on m.regs, then returns { next, byte } for idiomatic callers — a
 * register-dispatched caller reads all three straight out of the registers. A and the flags are
 * not live-outs. next = the cursor after the row-up step.
 */
import { u16 } from "../../../core/int.js";

const BLANK_TILE = 0x10;
const ROW_STRIDE_UP = -0x20;

export function drawStackedBcdDigits(m, dst = m.regs.hl, value = m.regs.a) {
  const { mem8 } = m;

  const tens = (value >> 4) & 0x0f;
  mem8[dst] = tens === 0 ? BLANK_TILE : tens; // leading-zero suppression
  const next = u16(dst + ROW_STRIDE_UP);
  mem8[next] = value & 0x0f;
  return (m.regs.bc = u16(ROW_STRIDE_UP), { next: (m.regs.hl = next), byte: (m.regs.e = value & 0xff) });
}
