// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { clearBoardRamAndBlankFillRow } from "./clearBoardRamAndBlankFillRow.js";
import { armTileFillFromPlayfieldBase } from "./armTileFillFromPlayfieldBase.js";
import { fillAttributeColumns } from "./fillAttributeColumns.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import { renderPlayTimerNibblesAndGuardChecksum } from "./renderPlayTimerNibblesAndGuardChecksum.js";
import { copyBiasedTileString } from "./copyBiasedTileString.js";
import {
  FIELD_ATTRIB_SRC_0819,
  DISPLAY_CMD_0600,
  DISPLAY_CMD_0602,
  PLAY_STATE_INDEX,
  PHASE_TIMER,
  TAMPER_CKSUM_BASE_5593,
  TAMPER_FREEZE_FLAG,
  BIASED_TILE_STRING_1FF2,
  DISPLAY_MSG_BUF,
} from "./names.js";
/**
 * rebuildFieldAndLatchPlayStateWithTamperCheck -- the round-teardown "screen clear" handler.
 *
 * WHAT IT IS
 *   One entry in the in-play sub-state machine. A play round is driven by a table of handlers at
 *   ROM 0x15a8, dispatched once per frame off PLAY_STATE_INDEX (0x880a); this routine is index 8,
 *   the first of two sibling "screen clear" handlers (its twin, index 9, is
 *   floodFieldAndLatchPlayStatePhaseTimer). It runs on the teardown chain after a round's phase
 *   gauge has drained: it wipes and rebuilds the playfield, then hands the sub-state machine on
 *   toward the high-score-entry staging step.
 *
 * ROLE IN THE MACHINE
 *   Rebuilds the two 1KB display planes for the next screen. The clear is deliberately spread over
 *   many frames -- one tilemap row is blanked per frame -- so the wipe never stalls the frame. Once
 *   the wipe finishes, this handler re-arms the fill cursor, repaints the colour/attribute plane,
 *   queues the display commands that redraw the field, runs the shared integrity/timer pass, and
 *   advances PLAY_STATE_INDEX to the next teardown step. Folded into that work is one of the ROM's
 *   many passive anti-tamper tripwires: a rolling checksum over a fixed 34-byte program block that,
 *   on a mismatch, bumps the tamper-freeze tally -- a value that on a genuine unmodified board is
 *   never touched, but which (once nonzero) freezes actor spawns and aborts object updates elsewhere.
 *
 * ROM ADDRESS: 0x1b43-0x1b7f (then falls into copyBiasedTileString at ROM 0x1b80).
 * Grounding: [seen]
 *
 * LIVE-OUT
 *   PLAY_STATE_INDEX (0x880a) := 0x0c   -- next sub-state is index 12 (stage the high-score entry).
 *   PHASE_TIMER (0x8808)       := 0      -- phase countdown cleared for the incoming step.
 *   the playfield tile fill re-armed, the colour/attribute plane reflooded, two display commands
 *   queued, DISPLAY_MSG_BUF (0x89f0) loaded with the biased ROM message string, and -- only on a
 *   failed integrity check -- TAMPER_FREEZE_FLAG (0x881e) incremented.
 *   As a dispatch-table handler its register/flag results are discarded by the caller.
 */

const NEXT_SUBSTATE = 0x0c; // play sub-state index latched on completion (index 12, high-score staging)
const CKSUM_LEN = 0x22; //     bytes folded into the rolling checksum (the Z80 loop's B=0x22 count)
const CKSUM_MASK = 0x37; //    per-byte mask before the rotate/accumulate (Z80 `and 0x37`)
const CKSUM_MATCH = 0x7c; //   intact-image checksum; anything else is a tampered ROM

export function rebuildFieldAndLatchPlayStateWithTamperCheck(m) {
  const { mem8 } = m;

  // Step 1 -- drain the row-by-row tilemap wipe (ROM 0x02c9, the `ret nz` gate).
  // clearBoardRamAndBlankFillRow blanks one row of the tilemap at the fill cursor and decrements
  // the row counter, reporting drained=true only once the whole screen has been cleared. Because
  // the wipe is paced one row per frame, this handler re-enters every frame and bails here until
  // the last row has gone -- so the expensive rebuild below runs exactly once, on the frame the
  // wipe completes.
  const drained = clearBoardRamAndBlankFillRow(m);
  if (!drained) return; // still draining -> bail (the `ret nz` path)

  // Step 2 -- re-arm the tile fill from the fixed playfield start (ROM 0x02e3).
  // With the old screen blank, reset the fill cursor back to the fixed VRAM start (0x8402)
  // and reload the row counter so the next screen's tiles paint from the top.
  armTileFillFromPlayfieldBase(m);

  // Step 3 -- reflood the colour/attribute plane (ROM 0x075d, source table at ROM 0x0819).
  // fillAttributeColumns walks the colour RAM (from ATTRIB_MAP_BASE 0x8040) column by column,
  // laying down the attribute bytes -- colour set + flip bits -- for every cell from the ROM
  // column-source table FIELD_ATTRIB_SRC_0819. This is the drawing recipe the tile fill paints into.
  fillAttributeColumns(m, FIELD_ATTRIB_SRC_0819);

  // Step 4 -- queue the two field-rebuild display commands (ROM 0x0038 / rst 0x38).
  // enqueueDisplayCommand posts a two-byte command into the page-0x88 display-command ring, which
  // the display driver consumes to redraw the field. This handler queues 0x0600 then 0x0602.
  enqueueDisplayCommand(m, DISPLAY_CMD_0600);
  enqueueDisplayCommand(m, DISPLAY_CMD_0602);

  // Step 5 -- run the shared integrity + play-timer pass (ROM 0x7960).
  // renderPlayTimerNibblesAndGuardChecksum is the common tail several state handlers call: it
  // enqueues a display command, verifies a code-block checksum, renders the active player's timer
  // BCD as nibble tiles (then clears them), and scans a flag block that can divert to a checksum tail.
  renderPlayTimerNibblesAndGuardChecksum(m);

  // Step 6 -- latch the next sub-state and clear the phase timer.
  // Writing PLAY_STATE_INDEX (0x880a) advances the 0x15a8 sub-state machine: index 0x0c (12) is the
  // high-score-entry staging step, the next link in the teardown chain. Zeroing PHASE_TIMER (0x8808)
  // resets the per-frame phase countdown so that incoming step starts its timing fresh.
  mem8[PLAY_STATE_INDEX] = NEXT_SUBSTATE;
  mem8[PHASE_TIMER] = 0;

  // Step 7 -- anti-tamper self-checksum over a fixed 34-byte program block (ROM 0x5593).
  // A passive tripwire on the code image. The Z80 folds each source byte with `and 0x37; rrca;
  // adc a,c; ld c,a`: mask the byte to bits 0/1/2/4/5, rotate it right so its old bit 0 falls into
  // the carry, then add-with-carry into the running accumulator. Over an intact ROM the 34-byte
  // block lands on exactly 0x7c; any change to those bytes shifts the sum, exposing the tamper.
  let acc = 0;
  let ptr = TAMPER_CKSUM_BASE_5593;
  for (let i = 0; i < CKSUM_LEN; i++) {
    const masked = mem8[ptr] & CKSUM_MASK; //         and 0x37
    const carry = masked & 0x01; //                   the bit rrca rotates out into carry (old bit 0)
    const rotated = ((masked >> 1) | (carry << 7)) & 0xff; // rrca: rotate right, carry-in comes from old bit 0
    acc = (rotated + acc + carry) & 0xff; //          adc a,c: add the accumulator plus that carry
    ptr = u16(ptr + 1); //                            walk to the next source byte (16-bit wrap)
  }
  // A sum other than the intact-image sentinel means the checked block differs from a genuine
  // image: bump the tamper-freeze tally (0x881e). Left nonzero, that tally later freezes spawns and aborts actor
  // updates -- so a tampered ROM quietly degrades into an unplayable machine rather than crashing.
  if (acc !== CKSUM_MATCH) mem8[TAMPER_FREEZE_FLAG] = mem8[TAMPER_FREEZE_FLAG] + 1;

  // Step 8 -- load the on-screen message (ROM string 0x1ff2 -> DISPLAY_MSG_BUF 0x89f0).
  // copyBiasedTileString copies the ROM source string into the 7-cell tile message buffer, adding a
  // +8 tile-code bias to each byte so the ASCII-ish source maps onto the correct character tiles.
  copyBiasedTileString(m, BIASED_TILE_STRING_1FF2, DISPLAY_MSG_BUF);
}
