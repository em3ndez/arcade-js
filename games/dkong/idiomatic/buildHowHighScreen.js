// SPDX-License-Identifier: GPL-3.0-only
/**
 * buildHowHighScreen — draw the "HOW HIGH CAN YOU GET?" screen that plays before a board starts,
 * then move the game on to the next sub-state.
 *
 * The screen is a diagonal stack of girders with a small climbing figure on each one, and the
 * stack gets one girder taller each time the player advances a board — that is what makes it read
 * as a height. It is built in a single frame, and the whole build happens in this order:
 *
 *   1. The sound channels are silenced. This happens unconditionally, ahead of the frame gate.
 *   2. The sub-state countdown is ticked, and everything below runs only on the frame it
 *      expires. While it is still counting, the build is skipped for that frame.
 *   3. The playfield and the sprite shadow buffer are cleared for a fresh screen.
 *   4. A task is posted to redraw the lives marker.
 *   5. The screen's fixed state is seeded: palette bank 1, the level-start tune held for 3
 *      frames, and the climb-figure bookkeeping — the record index reset to 0 and the sprite-slot
 *      walk pointer put at its first slot.
 *   6. HEIGHT: HOW_HIGH_INDEX is clamped to at most 5, then raised by one if the board-order
 *      pointer has moved since the last time this screen was built, which is exactly the case
 *      where the player advanced a board. The new pointer value is saved for the next comparison.
 *      The height index IS the number of girders drawn.
 *   7. That many rows are painted. Each row lays six 4-tile groups of girder, walking backwards
 *      through video memory with a fixed step between groups, and then copies a 3-byte
 *      climb-figure record into the next sprite slot with a fixed tile written just below it. The
 *      row loop tests at the bottom, so a height of 0 paints 256 rows rather than none.
 *   8. The composition task is posted, the sub-state countdown is re-armed, and the sub-state is
 *      advanced by two so the next frame dispatches onward.
 *
 * It reads no input of its own beyond the height bookkeeping; everything else it writes is fixed.
 *
 * LIVE-OUT: memory-only — the cleared playfield and sprite buffer, the two posted tasks, the
 * seeded sound, palette and climb-figure bytes, the height index and its saved pointer, the
 * girder and sprite video memory, the re-armed countdown and the advanced sub-state.
 */

import {
  MARIO_ACTIVE,
  SND_PRIORITY,
  SND_PRIORITY_FRAMES,
  HOW_HIGH_INDEX,
  BOARD_SEQ_PTR,
  HOW_HIGH_LAST_SEQ,
  SUBSTATE_TIMER,
  GAME_SUBSTATE,
} from "./names.js";
import { silenceSound } from "./silenceSound.js";
import { tickSubstateTimer } from "./tickSubstateTimer.js";
import { clearPlayfieldAndSprites } from "./clearPlayfieldAndSprites.js";
import { enqueueTask } from "./enqueueTask.js";

// The two palette-bank latch outputs. They are board control lines rather than work memory,
// and this screen selects bank 1 by setting the first and clearing the second.
const PALETTE_BANK_BIT0 = 0x7d86;
const PALETTE_BANK_BIT1 = 0x7d87;

// Climb-figure bookkeeping, engine scratch with no shared names: an index into the figure
// record table, stepped once per row, and a 16-bit walk pointer for the sprite slots, which
// steps 4 back per row. Both are seeded below.
const CLIMB_FIGURE_INDEX = 0x63a7;
const CLIMB_FIGURE_WALK_PTR = 0x63a8;
const CLIMB_FIGURE_WALK_START = 0x76dc;
const CLIMB_FIGURE_ROM_TABLE = 0x3cf0; // 4-byte figure records; 3 bytes read, 1 skipped
const CLIMB_FIGURE_FOOT_TILE = 0x8b; // fixed tile written just below each figure

// Girder tile fill: six groups of 4 tiles, whose codes run in one ascending sequence, written
// backwards through video memory with a fixed step between groups and a bigger step per row.
const GIRDER_VRAM_BASE = 0x75bc;
const GIRDER_TILE_FIRST = 0x50;
const GIRDER_TILE_LAST = 0x67;
const GIRDER_GROUP_STRIDE = 0x23;
const GIRDER_ROW_STEP = -0xa1 & 0xffff; // back one girder row

const HEIGHT_MAX = 5; // the height index is clamped to at most this
const SUBSTATE_TIMER_RELOAD = 0xa0; // re-armed before handing off

export function buildHowHighScreen(m) {
  const { regs, mem } = m;

  // 1. Silence sound — unconditional, ahead of the frame gate.
  silenceSound(m);

  // 2. Run the build only on the frame the sub-state countdown expires.
  if (!tickSubstateTimer(m)) return;

  // 3. Blank the playfield + sprite shadow buffer for the fresh screen.
  clearPlayfieldAndSprites(m);

  // 4. Post the lives-marker redraw task: opcode 6, with Mario's active flag as its argument.
  regs.d = 0x06;
  regs.e = mem.read8(MARIO_ACTIVE);
  enqueueTask(m);

  // 5. Seed the screen's fixed state.
  mem.write8(PALETTE_BANK_BIT0, 0x01); //          palette bank 1: bit 0 set
  mem.write8(PALETTE_BANK_BIT1, 0x00); //                          bit 1 clear
  mem.write8(SND_PRIORITY, 0x02); //               level-start tune
  mem.write8(SND_PRIORITY_FRAMES, 0x03); //        held 3 frames
  mem.write8(CLIMB_FIGURE_INDEX, 0x00); //         record index reset
  mem.write16(CLIMB_FIGURE_WALK_PTR, CLIMB_FIGURE_WALK_START); // sprite-slot walk pointer

  // 6. Height: clamp it, raise it if the board-order pointer has moved since last time (the
  //    player advanced a board), and save the pointer for the next comparison.
  if (mem.read8(HOW_HIGH_INDEX) >= HEIGHT_MAX + 1) mem.write8(HOW_HIGH_INDEX, HEIGHT_MAX);
  const seqLo = mem.read8(BOARD_SEQ_PTR);
  if (seqLo !== mem.read8(HOW_HIGH_LAST_SEQ)) {
    mem.write8(HOW_HIGH_INDEX, (mem.read8(HOW_HIGH_INDEX) + 1) & 0xff);
  }
  mem.write8(HOW_HIGH_LAST_SEQ, seqLo);

  // 7. Paint one girder row and one climb figure per unit of height. The count is tested at
  //    the bottom, so a height of 0 wraps to 256 rows rather than painting none.
  let rows = mem.read8(HOW_HIGH_INDEX);
  let fillPtr = GIRDER_VRAM_BASE;
  do {
    // Girder fill: six groups of 4 tiles whose codes run in one ascending sequence. Within a
    // group each of the first three writes steps back one cell, then a fixed stride reaches the
    // next group. The loop stops the instant a group's 4th tile is the last code.
    let tile = GIRDER_TILE_FIRST;
    for (;;) {
      mem.write8(fillPtr, tile); tile = (tile + 1) & 0xff; fillPtr = (fillPtr - 1) & 0xffff;
      mem.write8(fillPtr, tile); tile = (tile + 1) & 0xff; fillPtr = (fillPtr - 1) & 0xffff;
      mem.write8(fillPtr, tile); tile = (tile + 1) & 0xff; fillPtr = (fillPtr - 1) & 0xffff;
      mem.write8(fillPtr, tile); // 4th tile — `tile` is not advanced past it
      if (tile === GIRDER_TILE_LAST) break;
      tile = (tile + 1) & 0xff;
      fillPtr = (fillPtr + GIRDER_GROUP_STRIDE) & 0xffff;
    }

    // Climb figure: copy 3 bytes of the indexed record into the next sprite slot.
    const idx = mem.read8(CLIMB_FIGURE_INDEX);
    mem.write8(CLIMB_FIGURE_INDEX, (idx + 1) & 0xff); // step the index for the next row
    let recPtr = (CLIMB_FIGURE_ROM_TABLE + ((idx << 2) & 0xff)) & 0xffff;
    const ix = mem.read16(CLIMB_FIGURE_WALK_PTR); // current sprite-slot walk pointer

    mem.write8((ix + 0x60) & 0xffff, mem.read8(recPtr)); recPtr = (recPtr + 1) & 0xffff;
    mem.write8((ix + 0x40) & 0xffff, mem.read8(recPtr)); recPtr = (recPtr + 1) & 0xffff;
    mem.write8((ix + 0x20) & 0xffff, mem.read8(recPtr));
    mem.write8((ix - 0x20) & 0xffff, CLIMB_FIGURE_FOOT_TILE); // negative displacement

    mem.write16(CLIMB_FIGURE_WALK_PTR, (ix - 4) & 0xffff); // next sprite slot, 4 back
    fillPtr = (fillPtr + GIRDER_ROW_STEP) & 0xffff; //        next girder row

    rows = (rows - 1) & 0xff;
  } while (rows !== 0);

  // 8. Post the composition task, re-arm the countdown, advance the sub-state by two.
  regs.d = 0x03;
  regs.e = 0x07;
  enqueueTask(m);

  mem.write8(SUBSTATE_TIMER, SUBSTATE_TIMER_RELOAD);
  mem.write8(GAME_SUBSTATE, (mem.read8(GAME_SUBSTATE) + 2) & 0xff);
}
