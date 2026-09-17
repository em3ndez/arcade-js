// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0a1b — the middle step of the two-player board-setup cascade (sub-state 4 -> 5): select
 * palette bank 0, post two deferred-work messages to the task ring, stamp player 2's "2UP" score
 * marker, and advance the sub-state selector.
 *
 * LIVE-OUT: memory-only — the two palette latches (board outputs), the task ring and its tail,
 * the three P2 video cells, and GAME_SUBSTATE.
 */

import { GAME_SUBSTATE } from "./names.js";
import { enqueueTask } from "./enqueueTask.js";
import { draw2UpLabel } from "./draw2UpLabel.js";

// Palette-bank select: board control latches, not work RAM. Writing 0 to both selects bank 0.
const PALETTE_BANK_LO = 0x7d86; // palette-bank bit 0
const PALETTE_BANK_HI = 0x7d87; // palette-bank bit 1

export function loc_0a1b(m) {
  const { regs, mem, mem8 } = m;

  mem.write8(PALETTE_BANK_LO, 0);
  mem.write8(PALETTE_BANK_HI, 0);

  regs.d = 0x03;
  regs.e = 0x03;
  enqueueTask(m);
  regs.d = 0x02;
  regs.e = 0x01;
  enqueueTask(m);

  draw2UpLabel(m);

  mem8[GAME_SUBSTATE] = 0x05;
}
