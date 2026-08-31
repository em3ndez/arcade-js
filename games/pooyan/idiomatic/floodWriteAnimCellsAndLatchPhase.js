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
 * floodWriteAnimCellsAndLatchPhase
 * ================================
 *
 * WHAT IT IS
 *   The shared terminal step of the "write-anim" -- the little on-screen animation that
 *   grows a block of tiles one row at a time (the sequence that draws out the high-score
 *   name-entry / round-end lettering). A per-frame pre-pass (dispatchWriteAnimStateAndPollStart)
 *   selects one of three write-anim handlers through WRITE_ANIM_HANDLER_SELECT
 *   (seedWriteAnimWorkBlock / advanceWriteAnimTileIndexOnCountdown / appendWriteAnimBlockRowOnPhase).
 *   Two of those handlers finish here: advanceWriteAnimTileIndexOnCountdown when its 16-bit
 *   countdown drains, and appendWriteAnimBlockRowOnPhase when its row countdown empties. Both
 *   arrive at this routine, which tears the animation down and hands control to the next phase.
 *
 * ROLE IN THE MACHINE
 *   This is the "the write-anim is done" step. It does three things in order: silences the
 *   sound channel, optionally blanks the run of cells the animation had been drawing, and then
 *   latches the state that ends the write-anim and re-arms the round-end reset scan. After this
 *   runs, the pre-pass no longer dispatches a write-anim handler (the selector is cleared) and
 *   the round-end master (dispatchRoundEndElseWipeColumn) sees the reset-scan latch armed.
 *
 * ROM ADDRESS
 *   0x7fa8-0x7fd5.
 *
 * GROUNDING
 *   [seen] -- role confirmed against the observed work-RAM behaviour.
 *
 * LIVE-OUT (what it leaves behind, memory only -- nothing is returned to its caller):
 *   - up to WRITE_ANIM_ROW_COUNT (0x8e25) cells blanked to FILL_TILE (0x10) down a video-RAM
 *     tile run (WRITE_ANIM_WRITE_PTR) and up a work-block record run (ANIM_WORK_BLOCK_PTR);
 *   - PHASE_TIMER (0x8808) reloaded to 0x80 to time the next phase;
 *   - WRITE_ANIM_HANDLER_SELECT (0x8e26) cleared to 0 so the pre-pass stops running write-anim;
 *   - RESET_SCAN_LATCH (0x8e2a) set to 1 to arm the round-end reset scan.
 */

const FILL_TILE = 0x10; //          the blank tile flooded into both runs (clears the animated cells)
const TILE_PTR_STRIDE = 0x20; //    one tilemap row = 0x20 bytes; the video pointer steps back one row per cell
const PHASE_TIMER_RELOAD = 0x80; // value latched into PHASE_TIMER at the tail to time the following phase
const RESET_SCAN_LATCH_SET = 0x01;

export function floodWriteAnimCellsAndLatchPhase(m) {
  const { mem8, mem16 } = m;

  // Step 1 -- silence the sound channel.
  // The write-anim had a running sound tied to it; ending the animation enqueues sound
  // command 0x00 (the "no sound / silence" selector) into the audio-CPU command ring so the
  // effect stops cleanly as the block is torn down.
  queueSoundCommand00(m); // enqueue silence into the sound-command ring

  // Step 2 -- optionally blank the animated run of cells.
  // WRITE_ANIM_ROW_COUNT (0x8e25) is the count of rows the animation had drawn. If it is
  // zero there is nothing on screen to erase and we fall straight through to the tail;
  // otherwise we walk exactly that many cells, stamping the blank tile into two parallel runs.
  const count = mem8[WRITE_ANIM_ROW_COUNT]; // the fill count
  if (count !== 0) {
    // The two destinations move in opposite directions and at different strides:
    //   - WRITE_ANIM_WRITE_PTR (0x8e27): the 16-bit video-RAM cursor for the block; each cell
    //     steps it BACK one full tilemap row (-0x20), so the erase marches up the screen;
    //   - ANIM_WORK_BLOCK_PTR (0x8e1f): the pointer into the anim work-block record the append
    //     handler had been growing; each cell steps it FORWARD one byte (+1).
    // Both are read once into locals and never stored back, so the RAM cells themselves keep
    // their prior values -- only the cells the pointers address are overwritten.
    let tilePtr = mem16[WRITE_ANIM_WRITE_PTR]; // tile-fill pointer, stride -one row group
    let recPtr = mem16[ANIM_WORK_BLOCK_PTR]; // record pointer, stride +1 (not written back)
    for (let i = 0; i < count; i++) {
      mem8[tilePtr] = FILL_TILE; // blank this on-screen tile
      mem8[recPtr] = FILL_TILE; // blank the matching work-block record byte
      tilePtr = u16(tilePtr - TILE_PTR_STRIDE); // up one tilemap row for the next cell
      recPtr = u16(recPtr + 1); // forward one byte through the work block
    }
  }

  // Step 3 -- shared tail (also the count==0 target): latch the phase-transition state.
  // With the animation erased, reload the per-frame phase countdown and hand off. PHASE_TIMER
  // (0x8808) is reloaded to 0x80 so the following phase gets a fresh countdown; the write-anim
  // handler selector (0x8e26) is cleared so the per-frame pre-pass stops dispatching write-anim
  // handlers; and the reset-scan latch (0x8e2a) is set so the round-end master picks up the
  // reset scan on a later frame.
  mem8[PHASE_TIMER] = PHASE_TIMER_RELOAD; // fresh countdown for the next phase
  mem8[WRITE_ANIM_HANDLER_SELECT] = 0x00; // cleared here -- pre-pass no longer runs write-anim
  mem8[RESET_SCAN_LATCH] = RESET_SCAN_LATCH_SET; // arm the round-end reset scan
}
