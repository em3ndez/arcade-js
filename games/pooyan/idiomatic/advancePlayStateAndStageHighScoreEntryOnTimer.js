// SPDX-License-Identifier: GPL-3.0-only
import { drawStackedCharField } from "./drawStackedCharField.js";
import { fillAttributeColumns } from "./fillAttributeColumns.js";
import { paintAttractHudAndHighScores } from "./paintAttractHudAndHighScores.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import { u8, u16 } from "../../../core/int.js";
import { queueFixedSoundCommandRun } from "./queueFixedSoundCommandRun.js";
import {
  PHASE_TIMER,
  PLAY_STATE_INDEX,
  HIGH_SCORE_INSERT_RANK,
  FIELD_ATTRIB_SRC_07D9,
  WIPE_COLUMN_VRAM_BASE,
  WIPE_COLUMN_VRAM_PTR,
  WIPE_COLUMN_FILL_TILE,
  DISPLAY_MSG_BUF,
  OBJECT_SPAWN_DISPLAY_CMD,
  HIGH_SCORE_ENTRY_TABLE_SRC,
} from "./names.js";
/**
 * advancePlayStateAndStageHighScoreEntryOnTimer — in-play sub-state 12 handler: the timed
 * teardown that redresses the screen for high-score entry and, when the finished player earned
 * a place on the board, stages the name-entry text.
 *
 * ROM 0x1c03–0x1c52.  Grounding: [seen].
 *
 * WHAT IT IS
 * ----------
 * One handler in the in-play sub-state machine. The play frame keeps a sub-state index in
 * PLAY_STATE_INDEX (0x880a); its low five bits (&0x1f) select one of nineteen handlers through
 * the dispatch table at 0x15a8, and index 12 is this one. It runs while the round is settling
 * toward the high-score screen.
 *
 * The whole body is gated behind PHASE_TIMER (0x8808), a per-frame dwell counter that handlers
 * seed to hold a screen for a fixed number of frames. This handler is entered every frame but
 * does nothing except tick that timer down until it reaches zero; only on the expiry frame does
 * it perform the teardown, so the sequence below happens exactly once.
 *
 * WHAT IT DOES ON THE EXPIRY FRAME
 * --------------------------------
 *   1. Clear three canned character fields, recolour the whole attribute (colour) map, repaint
 *      the HUD / high-score panels, and enqueue a display command — i.e. dress the screen for
 *      the high-score board.
 *   2. Advance PLAY_STATE_INDEX to 0x0e (index 14, the round-end / player-swap master), so the
 *      next handler takes over on following frames.
 *   3. Only if the just-finished player placed on the board (HIGH_SCORE_INSERT_RANK, 0x89fc,
 *      nonzero): point a column-wipe pointer at the start cell for that rank, seed the wipe
 *      fill tile, queue the name-entry sound cue, and unpack the ROM name-entry template into
 *      the on-screen message buffer.
 *
 * LIVE-OUT: none — a void handler. Every effect is a memory write (PHASE_TIMER,
 * PLAY_STATE_INDEX, WIPE_COLUMN_VRAM_PTR, WIPE_COLUMN_FILL_TILE, the DISPLAY_MSG_BUF cells) or
 * a side effect of a sub-call (the painted tilemap, the queued sound and display commands).
 */

const SUBSTATE_ADVANCE = 0x0e;
const WIPE_SEED_TILE = 0x07;
const TABLE_TERMINATOR = 0x5a;

export function advancePlayStateAndStageHighScoreEntryOnTimer(m) {
  const { mem8, mem16 } = m;

  // Phase-timer gate. PHASE_TIMER (0x8808) is the shared per-frame dwell counter; this handler
  // is polled every frame and simply decrements it. While it is still nonzero the screen is
  // being held, so return and do nothing else. The teardown below runs only on the single frame
  // the count reaches zero.
  mem8[PHASE_TIMER] = u8(mem8[PHASE_TIMER] - 1);
  if (mem8[PHASE_TIMER] !== 0) return; // dwell not finished yet

  // Redress the screen for the high-score board. drawStackedCharField is the canned-text
  // painter: it stamps (or, when the selector's bit 7 is set, blanks) a whole pre-authored
  // field of stacked characters keyed by the selector byte. All three selectors below have bit 7
  // set, so these three calls run the blank/erase path, clearing three canned character fields.
  drawStackedCharField(m, 0x82); // clear canned field (bit 7 set = blank/erase mode)
  drawStackedCharField(m, 0x80); // clear canned field
  drawStackedCharField(m, 0x89); // clear canned field
  // Recolour the backdrop: fillAttributeColumns floods the tile-attribute (colour) map in
  // vertical bands, one source byte per column, drawn from the field-attribute source table
  // (FIELD_ATTRIB_SRC_07D9, ROM 0x07d9).
  fillAttributeColumns(m, FIELD_ATTRIB_SRC_07D9); // recolour the attribute map
  // Repaint the numeric side of the screen: the canned HUD banners, the ten-entry high-score
  // board (from the packed-BCD high-score table), and the dressed side panels.
  paintAttractHudAndHighScores(m); // repaint HUD / high-score panels
  // Post a display command (OBJECT_SPAWN_DISPLAY_CMD, word 0x0611) into the page-0x88
  // display-command ring for the foreground loop to act on.
  enqueueDisplayCommand(m, OBJECT_SPAWN_DISPLAY_CMD); // enqueue display command 0x0611

  // Hand the round off to the next sub-state: PLAY_STATE_INDEX (0x880a) = 0x0e selects index 14
  // (the round-end / player-swap master) on subsequent frames.
  mem8[PLAY_STATE_INDEX] = SUBSTATE_ADVANCE;
  // HIGH_SCORE_INSERT_RANK (0x89fc) is the winning rank + 1, set when the finished score was
  // insert-sorted onto the board; zero means the player did not place. When they did not, the
  // teardown is complete and there is no name-entry to stage.
  const rank = mem8[HIGH_SCORE_INSERT_RANK];
  if (rank === 0) return; // player did not place — nothing more to stage

  // Point the column-wipe pointer at the start cell for this rank. The target is a stride-2
  // offset of WIPE_COLUMN_VRAM_BASE (0x8045): step the low byte forward by 2 for each rank,
  // keeping the page fixed at 0x80, so a different placement targets a different cell of the
  // vertical column.
  let lo = u8(WIPE_COLUMN_VRAM_BASE); // low byte of 0x8045; step +2 per rank (page stays 0x80)
  for (let i = 0; i < rank; i++) lo = u8(lo + 2);
  mem16[WIPE_COLUMN_VRAM_PTR] = (WIPE_COLUMN_VRAM_BASE & ~0xff) | lo; // 0x89fd = page 0x80 : stepped low byte

  // Queue the name-entry sound cue: the fixed four-byte burst (0x29,0x15,0x16,0x17) pressed into
  // the sound-command ring.
  queueFixedSoundCommandRun(m); // enqueue the four-byte name-entry sound cue

  // Seed the wipe fill tile (WIPE_COLUMN_FILL_TILE, 0x89ff); the round-end handler steps this
  // value as it walks the column on later frames.
  mem8[WIPE_COLUMN_FILL_TILE] = WIPE_SEED_TILE;
  // Unpack the ROM name-entry template (HIGH_SCORE_ENTRY_TABLE_SRC, 0x1754) into the on-screen
  // message buffer (DISPLAY_MSG_BUF, 0x89f0). Each source byte is transformed and copied in turn
  // until the terminator byte is reached.
  let src = HIGH_SCORE_ENTRY_TABLE_SRC;
  let dst = DISPLAY_MSG_BUF;
  for (;;) {
    // Read the next template byte; the value 0x5a marks the end of the template.
    const b = mem8[src];
    if (b === TABLE_TERMINATOR) return; // template fully copied
    // Transform: rotate the byte left through carry, where the carry rotated into bit 0 is the
    // borrow from comparing the byte against the terminator — bytes below 0x5a rotate in a 1,
    // bytes above rotate in a 0 — then stamp the result into the message buffer.
    const carryIn = b < TABLE_TERMINATOR ? 1 : 0; // carry-in = borrow of (b - 0x5a)
    mem8[dst] = u8((b << 1) | carryIn);
    src = u16(src + 1);
    dst = u16(dst + 1);
  }
}
