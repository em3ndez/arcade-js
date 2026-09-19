// SPDX-License-Identifier: GPL-3.0-only
/**
 * buildHowHighScreen — draw the "HOW HIGH CAN YOU GET?" screen shown before a board
 * starts, then advance the game to the next sub-state. A diagonal stack of girders, one
 * taller per board reached, each carrying a small climbing figure; built in a single
 * frame, only on the frame the sub-state countdown expires.
 *
 * LIVE-OUT: memory-only — the cleared playfield and sprite buffer, the two posted tasks,
 * the seeded sound/palette/climb-figure bytes, the height index and its saved pointer, the
 * girder and sprite video memory, the re-armed countdown and the advanced sub-state.
 */

import {
  BOARD_SEQ_PTR,
  CLIMB_FIGURE_INDEX,
  CLIMB_FIGURE_WALK_PTR,
  GAME_SUBSTATE,
  HOW_HIGH_CLIMB_FIGURE_TABLE,
  HOW_HIGH_CLIMB_FIGURE_VRAM_START,
  HOW_HIGH_GIRDER_VRAM_BASE,
  HOW_HIGH_INDEX,
  HOW_HIGH_LAST_SEQ,
  MARIO_ACTIVE,
  PALETTE_BANK_BIT0,
  PALETTE_BANK_BIT1,
  SND_PRIORITY,
  SND_PRIORITY_FRAMES,
  SUBSTATE_TIMER,
} from "./names.js";
import { silenceSound } from "./silenceSound.js";
import { tickSubstateTimer } from "./tickSubstateTimer.js";
import { clearPlayfieldAndSprites } from "./clearPlayfieldAndSprites.js";
import { enqueueTask } from "./enqueueTask.js";


const CLIMB_FIGURE_FOOT_TILE = 0x8b;

const GIRDER_TILE_FIRST = 0x50;
const GIRDER_TILE_LAST = 0x67;
const GIRDER_GROUP_STRIDE = 0x23;
const GIRDER_ROW_STEP = -0xa1 & 0xffff;

const HEIGHT_MAX = 5;
const SUBSTATE_TIMER_RELOAD = 0xa0;

export function buildHowHighScreen(m) {
  const { mem, mem8, mem16 } = m;

  silenceSound(m);

  if (!tickSubstateTimer(m)) return;

  clearPlayfieldAndSprites(m);

  enqueueTask(m, 0x06, mem8[MARIO_ACTIVE]);

  mem.write8(PALETTE_BANK_BIT0, 0x01); // palette latch (device)
  mem.write8(PALETTE_BANK_BIT1, 0x00); // palette latch (device)
  mem8[SND_PRIORITY] = 0x02;
  mem8[SND_PRIORITY_FRAMES] = 0x03;
  mem8[CLIMB_FIGURE_INDEX] = 0x00;
  mem16[CLIMB_FIGURE_WALK_PTR] = HOW_HIGH_CLIMB_FIGURE_VRAM_START;

  // Height rises when the board-order pointer moved since last build (player advanced a board).
  if (mem8[HOW_HIGH_INDEX] >= HEIGHT_MAX + 1) mem8[HOW_HIGH_INDEX] = HEIGHT_MAX;
  const seqLo = mem8[BOARD_SEQ_PTR];
  if (seqLo !== mem8[HOW_HIGH_LAST_SEQ]) {
    mem8[HOW_HIGH_INDEX] = mem8[HOW_HIGH_INDEX] + 1;
  }
  mem8[HOW_HIGH_LAST_SEQ] = seqLo;

  // Count tested at loop bottom, so a height of 0 wraps to 256 rows rather than painting none.
  let rows = mem8[HOW_HIGH_INDEX];
  let fillPtr = HOW_HIGH_GIRDER_VRAM_BASE;
  do {
    let tile = GIRDER_TILE_FIRST;
    for (;;) {
      mem8[fillPtr] = tile; tile = (tile + 1) & 0xff; fillPtr = (fillPtr - 1) & 0xffff;
      mem8[fillPtr] = tile; tile = (tile + 1) & 0xff; fillPtr = (fillPtr - 1) & 0xffff;
      mem8[fillPtr] = tile; tile = (tile + 1) & 0xff; fillPtr = (fillPtr - 1) & 0xffff;
      mem8[fillPtr] = tile; // 4th tile — `tile` is not advanced past it
      if (tile === GIRDER_TILE_LAST) break;
      tile = (tile + 1) & 0xff;
      fillPtr = (fillPtr + GIRDER_GROUP_STRIDE) & 0xffff;
    }

    const idx = mem8[CLIMB_FIGURE_INDEX];
    mem8[CLIMB_FIGURE_INDEX] = idx + 1;
    let recPtr = (HOW_HIGH_CLIMB_FIGURE_TABLE + ((idx << 2) & 0xff)) & 0xffff;
    const ix = mem16[CLIMB_FIGURE_WALK_PTR];

    mem8[(ix + 0x60) & 0xffff] = mem8[recPtr]; recPtr = (recPtr + 1) & 0xffff;
    mem8[(ix + 0x40) & 0xffff] = mem8[recPtr]; recPtr = (recPtr + 1) & 0xffff;
    mem8[(ix + 0x20) & 0xffff] = mem8[recPtr];
    mem8[(ix - 0x20) & 0xffff] = CLIMB_FIGURE_FOOT_TILE; // negative displacement

    mem16[CLIMB_FIGURE_WALK_PTR] = ix - 4;
    fillPtr = (fillPtr + GIRDER_ROW_STEP) & 0xffff;

    rows = (rows - 1) & 0xff;
  } while (rows !== 0);

  enqueueTask(m, 0x03, 0x07);

  mem8[SUBSTATE_TIMER] = SUBSTATE_TIMER_RELOAD;
  mem8[GAME_SUBSTATE] = mem8[GAME_SUBSTATE] + 2;
}
