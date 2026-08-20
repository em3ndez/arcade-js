// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawStackedBcdDigits — paint a packed-BCD byte as two stacked digit tiles: tens at the
 * cursor, units one tilemap row above it (toward lower addresses in memory order).
 *
 * Leading-zero suppression: a zero tens digit draws as the blank tile, not "0".
 * Pure leaf — two tile writes, reads only its inputs, calls nothing.
 *
 * LIVE-OUT: memory (the two digit tiles); returns { next, byte } = the cursor after the
 * row-up step and the source byte.
 */
import { u16 } from "../../../core/int.js";

const BLANK_TILE = 0x10;
const ROW_STRIDE_UP = -0x20;

export function drawStackedBcdDigits(m, dst = m.regs.hl, value = m.regs.a) {
  const { mem8 } = m;

  const tens = (value >> 4) & 0x0f;
  mem8[dst] = tens === 0 ? BLANK_TILE : tens; //             leading-zero suppression
  const next = u16(dst + ROW_STRIDE_UP);
  mem8[next] = value & 0x0f;
  return { next, byte: value & 0xff };
}
