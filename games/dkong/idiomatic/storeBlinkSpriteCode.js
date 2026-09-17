// SPDX-License-Identifier: GPL-3.0-only
/**
 * storeBlinkSpriteCode — the shared store tail of the blink driver. Writes record
 * 1's finished tile-code byte (in A) into its code field; once per colour-cycle
 * sweep — when the sweep counter (in C) has bit 6 set and its low three bits clear
 * — it also flips the code's two low bits, advancing to the alternate cell.
 *
 * LIVE-OUT: memory-only — the single code byte.
 */
import { SPRITE_BUFFER } from "./names.js";

const SPRITE1_CODE = SPRITE_BUFFER + 5; // record 1 (+4), code field (+1)

export function storeBlinkSpriteCode(m) {
  const { regs, mem8 } = m;
  const code = regs.a;
  const counter = regs.c;

  const advanceTile = (counter & 0x47) === 0x40;

  mem8[SPRITE1_CODE] = advanceTile ? code ^ 0x03 : code;
}
