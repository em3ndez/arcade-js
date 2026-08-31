// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import { queueDisplayCommandAndRebuildSpriteList } from "./queueDisplayCommandAndRebuildSpriteList.js";
import {
  PENDING_OBJECT_COUNTDOWN,
  PROMOTED_OBJECT_LIST,
  PLAY_STATE_INDEX,
  ATTRACT_HELP_CLEAR_DISPLAY_CMD_A,
} from "./names.js";

/**
 * commitPromotedObjectsAndClearHelpScreenOnCountdown
 * ==================================================
 *
 * WHAT IT IS
 * ----------
 * A countdown-gated commit handler. It is the moment, at the end of the how-to-play /
 * "second phase" help screen, when the game (a) writes a batch of pre-staged object values
 * into the board and (b) wipes the help text off the screen, then hands the machine forward
 * to the next play phase. Almost every call is a no-op tick of a timer; the real work fires
 * on exactly one frame -- the frame the timer underflows to zero.
 *
 * ROLE IN THE MACHINE
 * -------------------
 * This is the play-state handler for the "promoted-object commit countdown" phase. While the
 * help screen is showing, other code stages a list of deferred object writes (the
 * "promoted-object list") but does not apply them yet, and arms a short countdown so the help
 * screen dwells on screen for a fixed number of frames. This handler runs once per frame: it
 * ticks that countdown, and on the tick it reaches zero it flushes the staged writes into the
 * board RAM, blanks the help screen, and moves the play-state forward. After that the machine
 * is in play-state 4 and the how-to-play screen is gone.
 *
 * ROM ADDRESS
 * -----------
 * 0x6bb2 (occupies 0x6bb2-0x6bed in ROM). Its five queued display commands tail into the
 * shared block at 0x6bae, which rebuilds the sprite display list.
 *
 * Grounding: [seen]
 *
 * LIVE-OUT (what it leaves behind in memory; there is no register/return value)
 * ----------------------------------------------------------------------------
 *   - PENDING_OBJECT_COUNTDOWN (0x8d5e): decremented by one every call.
 *   - On the underflow frame only:
 *       * one board-RAM byte per active promoted-object record (the staged value, stored six
 *         bytes past the record's pointer);
 *       * PLAY_STATE_INDEX (0x880a) := 4, advancing the play phase;
 *       * five help-clear display commands (0x06ab..0x06af) pushed onto the display-command
 *         ring, and the sprite display list rebuilt from the last of them.
 */

// --- Layout of the promoted-object list (base = PROMOTED_OBJECT_LIST, 0x8d80) ---------------
// The list is a flat table of RECORD_COUNT records laid end to end, RECORD_STRIDE bytes apart.
// Each record is [ptr_lo, ptr_hi, value]: a little-endian 16-bit RAM pointer followed by the
// value byte to deposit. The pointer's high byte doubles as the record's "active" flag -- a
// zero high byte means the slot is empty and is skipped.
const RECORD_COUNT = 0x0b; //     11 records in the table
const RECORD_STRIDE = 0x03; //    bytes per record: [ptr_lo, ptr_hi, value]
const REC_PTR_HI = 0x01; //       record offset: pointer high byte (also the active flag)
const REC_VALUE = 0x02; //        record offset: value byte to store
const TARGET_BIAS = 0x06; //      added to the record pointer to reach the destination cell
const PLAY_STATE_COMMIT = 0x04; // play-state index written once the batch is committed

export function commitPromotedObjectsAndClearHelpScreenOnCountdown(m) {
  // The whole routine only ever touches RAM bytes, so grab the byte-addressable memory view.
  const { mem8 } = m;

  // --- Step 1: tick the dwell countdown; bail until it underflows -----------------------------
  // PENDING_OBJECT_COUNTDOWN (0x8d5e) is the frame timer that keeps the help screen on screen.
  // Decrement it (masked to a byte so 0x00 -> 0xff wraps like the 8-bit machine), write it
  // back, and return immediately while it is still nonzero -- so on all but the final frame
  // this handler does nothing but count down.
  const left = (mem8[PENDING_OBJECT_COUNTDOWN] - 1) & 0xff;
  mem8[PENDING_OBJECT_COUNTDOWN] = left;
  if (left !== 0) return;

  // --- Step 2: commit every active promoted-object record ------------------------------------
  // Reached only on the one frame the countdown hits zero. Walk the 11 records of the
  // promoted-object list at PROMOTED_OBJECT_LIST (0x8d80), stepping RECORD_STRIDE (3) bytes per
  // record. For each record: read the pointer high byte (REC_PTR_HI), which is also the active
  // flag -- skip the slot if it is zero. Otherwise rebuild the little-endian 16-bit pointer
  // (hi<<8 | lo), add TARGET_BIAS (6) to reach the actual destination cell, and store the
  // record's staged value byte (REC_VALUE) there. This is the batch of object values getting
  // written into the board in one pass.
  let rec = PROMOTED_OBJECT_LIST;
  for (let i = 0; i < RECORD_COUNT; i++, rec += RECORD_STRIDE) {
    const hi = mem8[rec + REC_PTR_HI];
    if (hi === 0) continue;
    const target = u16(((hi << 8) | mem8[rec]) + TARGET_BIAS);
    mem8[target] = mem8[rec + REC_VALUE];
  }

  // --- Step 3: advance the play phase --------------------------------------------------------
  // With the promoted objects committed, hand the machine to play-state 4 by writing
  // PLAY_STATE_COMMIT (4) into PLAY_STATE_INDEX (0x880a), the in-play sub-state selector the
  // main loop dispatches on. The help screen phase is over.
  mem8[PLAY_STATE_INDEX] = PLAY_STATE_COMMIT;

  // --- Step 4: wipe the help screen off the display ------------------------------------------
  // Enqueue the five consecutive help-clear display commands 0x06ab..0x06af
  // (ATTRACT_HELP_CLEAR_DISPLAY_CMD_A + 0..4) onto the display-command ring on page 0x88. Each
  // is the erase path of a text-field draw: together they blank the how-to-play / second-phase
  // help lines (the first, 0x06ab, blanks the "2ND PHASE GETS" line at VRAM 0x86d0). The fifth
  // command is queued through the combined tail that also rebuilds the sprite display list, so
  // the freshly committed objects and the cleared screen are reflected on the next repaint.
  enqueueDisplayCommand(m, ATTRACT_HELP_CLEAR_DISPLAY_CMD_A);
  enqueueDisplayCommand(m, ATTRACT_HELP_CLEAR_DISPLAY_CMD_A + 1);
  enqueueDisplayCommand(m, ATTRACT_HELP_CLEAR_DISPLAY_CMD_A + 2);
  enqueueDisplayCommand(m, ATTRACT_HELP_CLEAR_DISPLAY_CMD_A + 3);
  queueDisplayCommandAndRebuildSpriteList(m, ATTRACT_HELP_CLEAR_DISPLAY_CMD_A + 4);
}
