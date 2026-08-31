// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { queueSoundCommand00 } from "./queueSoundCommand00.js";
import {
  PHASE_TIMER,
  ANIM_WORK_BLOCK_PTR,
  RESET_SCAN_LATCH,
  WRITE_ANIM_ROW_COUNT,
  WRITE_ANIM_HANDLER_SELECT,
  WRITE_ANIM_WRITE_PTR,
} from "./names.js";
/**
 * floodWriteAnimCellsAndLatchPhase — shared write-anim tail. Silences the sound channel (queueSoundCommand00), then
 * optionally floods a run of cells before latching the phase-transition state.
 *
 * A fill count gates the flood: while nonzero it walks that many cells, writing the fill tile both
 * down a tile pointer (stride -one row group) and up a record pointer (stride +1). Neither pointer
 * is written back — only the destination cells change. Then the tail (also the count==0 target)
 * reloads PHASE_TIMER, clears the phase flag, and sets RESET_SCAN_LATCH.
 *
 * LIVE-OUT: memory only — a void terminal handler; its dispatch callers read nothing back.
 */

const FILL_TILE = 0x10; //          value flooded into both runs
const TILE_PTR_STRIDE = 0x20; //    tile pointer steps back one row group per cell
const PHASE_TIMER_RELOAD = 0x80; // reload latched into PHASE_TIMER at the tail
const RESET_SCAN_LATCH_SET = 0x01;

export function floodWriteAnimCellsAndLatchPhase(m) {
  const { mem8, mem16 } = m;

  queueSoundCommand00(m); // enqueue silence into the sound-command ring

  const count = mem8[WRITE_ANIM_ROW_COUNT]; // the fill count
  if (count !== 0) {
    let tilePtr = mem16[WRITE_ANIM_WRITE_PTR]; // tile-fill pointer, stride -one row group
    let recPtr = mem16[ANIM_WORK_BLOCK_PTR]; // record pointer, stride +1 (not written back)
    for (let i = 0; i < count; i++) {
      mem8[tilePtr] = FILL_TILE;
      mem8[recPtr] = FILL_TILE;
      tilePtr = u16(tilePtr - TILE_PTR_STRIDE);
      recPtr = u16(recPtr + 1);
    }
  }

  // shared tail (also the count==0 target): latch the phase-transition state
  mem8[PHASE_TIMER] = PHASE_TIMER_RELOAD;
  mem8[WRITE_ANIM_HANDLER_SELECT] = 0x00; // cleared here
  mem8[RESET_SCAN_LATCH] = RESET_SCAN_LATCH_SET;
}
