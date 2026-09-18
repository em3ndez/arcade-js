// SPDX-License-Identifier: GPL-3.0-only
/**
 * redrawPlayerUpIndicator — blink the on-screen "player up" indicator, acting only on
 * multiple-of-16 frames (and only with a credited game). Frame bit 4 selects the phase: clear
 * paints the current player's three-cell column (number tile index+1, then two fixed tiles a row
 * back each); set blanks it, and in a two-player game paints the other player's column (index XOR 1).
 *
 * LIVE-OUT: memory-only.
 */
import { FRAME, CURRENT_PLAYER, TWO_PLAYER_GAME } from "./names.js";
import { gameActiveGuard } from "./gameActiveGuard.js";
import { selectPlayerIndicatorColumnBase } from "./selectPlayerIndicatorColumnBase.js";

// −32 columns: one screen row back in the 32-wide tilemap.
const ROW_BACK = 0xffe0;

export function redrawPlayerUpIndicator(m) {
  const { mem8 } = m;

  const frame = mem8[FRAME];
  if ((frame & 0x0f) !== 0) return;

  if (!gameActiveGuard(m)) return;

  let selector = mem8[CURRENT_PLAYER];
  let colBase = selectPlayerIndicatorColumnBase(selector);

  if ((frame & 0x10) !== 0) {
    // Blink OFF phase: blank the current player's three cells.
    let addr = colBase;
    mem8[addr] = 0x10;
    addr = (addr + ROW_BACK) & 0xffff;
    mem8[addr] = 0x10;
    addr = (addr + ROW_BACK) & 0xffff;
    mem8[addr] = 0x10;

    if (mem8[TWO_PLAYER_GAME] === 0) return;

    selector = mem8[CURRENT_PLAYER] ^ 0x01;
    colBase = selectPlayerIndicatorColumnBase(selector);
  }

  let addr = colBase;
  mem8[addr] = (selector + 1);
  addr = (addr + ROW_BACK) & 0xffff;
  mem8[addr] = 0x25;
  addr = (addr + ROW_BACK) & 0xffff;
  mem8[addr] = 0x20;
}
