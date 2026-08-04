// SPDX-License-Identifier: GPL-3.0-only
/**
 * storeBlinkSpriteCode — commit sprite record 1's tile-code byte; the shared store tail of the
 * blink driver behind the attract and how-high screens.
 *
 * That driver runs once a frame and blinks a pair of decorative sprites — records 0 and 1 of the
 * sprite shadow buffer — by toggling bit 7, the flip/visibility bit, of their code bytes. Its
 * three arms (leave as-is, blink ON, blink OFF) each work out record 1's finished code byte, hand
 * it over in a register, and fall into this routine, which is the one place that stores it:
 *
 *   - It always writes that byte into record 1's code field.
 *   - Once per colour-cycle sweep it does more: when the sweep counter it is also handed has bit 6
 *     set AND its low three bits clear, the code's two low bits are flipped as well, advancing
 *     that sprite's tile to its alternate animation cell. At any other counter value the byte is
 *     stored unchanged.
 *
 * On the toggle arm the byte is stored twice in succession and only the final value is observable
 * on exit, so this writes it once.
 *
 * A near-pure leaf: it reads only its two register inputs, writes only that one byte, and calls
 * nothing.
 *
 * LIVE-OUT: memory-only — the single code byte.
 */
import { SPRITE_BUFFER } from "./names.js";

// Record #1's code byte inside the sprite shadow buffer: base + 4 (record 1) + 1 (code).
const SPRITE1_CODE = SPRITE_BUFFER + 5;

export function storeBlinkSpriteCode(m) {
  const { regs, mem } = m;
  const code = regs.a; // the finished tile-code byte (bit 7 already set by the caller arm)
  const counter = regs.c; // the colour-cycle sweep counter, staged by the caller

  // The counter's once-per-sweep "advance the tile" phase: bit 6 set and the low three
  // bits clear. Only then does the code step to its alternate animation cell.
  const advanceTile = (counter & 0x47) === 0x40;

  mem.write8(SPRITE1_CODE, advanceTile ? code ^ 0x03 : code);
}
