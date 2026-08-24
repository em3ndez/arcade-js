// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { queueSoundCommand00 } from "./queueSoundCommand00.js";
import {
  PHASE_TIMER,
  PLAYER2_START_CLEAR_BLOCK,
  RESET_SCAN_LATCH,
  loc_8e25,
  loc_8e26,
  loc_8e27,
} from "./names.js";
/**
 * loc_7fa8 — shared write-anim tail. Silences the sound channel (queueSoundCommand00), then
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

export function loc_7fa8(m) {
  const { mem8 } = m;

  queueSoundCommand00(m); // enqueue silence into the sound-command ring

  const count = mem8[loc_8e25]; // the fill count
  if (count !== 0) {
    let tilePtr = m.mem.read16(loc_8e27); // tile-fill pointer, stride -one row group
    let recPtr = m.mem.read16(PLAYER2_START_CLEAR_BLOCK); // record pointer, stride +1 (not written back)
    for (let i = 0; i < count; i++) {
      mem8[tilePtr] = FILL_TILE;
      mem8[recPtr] = FILL_TILE;
      tilePtr = u16(tilePtr - TILE_PTR_STRIDE);
      recPtr = u16(recPtr + 1);
    }
  }

  // shared tail (also the count==0 target): latch the phase-transition state
  mem8[PHASE_TIMER] = PHASE_TIMER_RELOAD;
  mem8[loc_8e26] = 0x00; // cleared here
  mem8[RESET_SCAN_LATCH] = RESET_SCAN_LATCH_SET;
}
