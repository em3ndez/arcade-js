// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { blankFillRowAndStepCounter } from "./blankFillRowAndStepCounter.js";
import { armTileFillFromPlayfieldBase } from "./armTileFillFromPlayfieldBase.js";
import { zeroSpriteListAndActorArena } from "./zeroSpriteListAndActorArena.js";
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import { fillAttributeColumns } from "./fillAttributeColumns.js";
import {
  ATTRACT_SUBSTATE,
  COPY_PROTECT_STALL_BYTE,
  SIGNATURE_WORD_TABLE,
  SIGNATURE_EXPECTED_TOP,
  FIELD_ATTRIB_SRC_07D9,
  DISPLAY_CMD_068B,
  DISPLAY_CMD_068E,
  DISPLAY_CMD_0200,
} from "./names.js";

/**
 * paintAttractColorsAndQueueDraws
 * ================================
 *
 * WHAT IT IS
 *   The handler for attract sub-state 2 -- the step of the attract-screen show that
 *   paints the field's colour/attribute map and hands the machine the draw commands
 *   for it, but only once the game's copy-protection and program-signature gates pass.
 *
 * ROLE IN THE MACHINE
 *   The top-level state selector MAIN_GAME_STATE (0x8805) routes to the attract
 *   sub-state machine, which in turn dispatches on ATTRACT_SUBSTATE (0x8e51) through
 *   the sub-state jump table at 0x08a1. Sub-state 2 lands here. The screen the player
 *   sees while no one is playing is assembled across a run of these sub-states; this
 *   one owns finishing the tilemap clear and then repainting the attribute (colour)
 *   layer over the freshly-cleared field.
 *
 * ROM ADDRESS
 *   0x092c-0x0975. (0x0929, three bytes earlier, is an alternate entry used only as a
 *   trap landing site; the normal path begins here at 0x092c.)
 *
 * GROUNDING TAG
 *   [seen].
 *
 * SHAPE / FRAME-GATING
 *   The tilemap clear is spread over many frames: each call blanks one row-batch and,
 *   while rows remain, returns immediately so the rest of the frame can run. Only on
 *   the frame that drains the last row does the routine fall through to its real work
 *   (re-arm, advance sub-state, the protection gates, and the repaint).
 *
 * LIVE-OUT (what it leaves in memory)
 *   No return value -- a void handler. Its effect is its writes: on the draining frame
 *   it re-arms the tile-fill cursor/counter, bumps ATTRACT_SUBSTATE (0x8e51) to the
 *   next sub-state, zeroes the board-init RAM (sprite display list + actor arena), then
 *   -- after the copy-protect and signature gates pass -- floods the attribute/colour
 *   map at ATTRIB_MAP_BASE (0x8040) and appends three commands to the display-command
 *   ring for the main loop to draw.
 */

const CLEAR_TILES_PER_FRAME = 0x19; // row-batch width (0x19 tiles) fed to the tilemap clear each frame
const STALL_MATCH = 0x11; // the copy-protect image byte (0x07f5) reads this on an intact ROM
const SIG_COUNT = 0x07; // signature bytes verified (b = 7..1; index 0 skipped)
const SIG_FIELD_OFFSET = 0x1c; // byte offset inside each word-table[b] record to sample

export function paintAttractColorsAndQueueDraws(m) {
  const { mem8 } = m;

  // --- Frame-gated tilemap clear -------------------------------------------------
  // Blank one row-batch of CLEAR_TILES_PER_FRAME (0x19) tiles at the fill cursor
  // (TILE_FILL_PTR 0x880b), step the cursor forward one row and decrement the row
  // counter (FILL_ROW_COUNTER 0x8809). While rows remain the helper reports "not
  // drained" and we bail for this frame -- the attract screen clears a strip at a
  // time rather than in one blocking pass. The rest of this routine only runs on the
  // single frame that empties the counter.
  if (!blankFillRowAndStepCounter(m, CLEAR_TILES_PER_FRAME)) return; // rows still draining -> wait a frame

  // --- Draining frame: re-arm, advance the sub-state, wipe board-init RAM ---------
  // Re-seat the fill cursor + counter at the fixed VRAM start (the reset-to-0x8402
  // variant) so a later pass can clear the field again from the top.
  armTileFillFromPlayfieldBase(m); // re-arm the fill from the fixed start
  // Bump ATTRACT_SUBSTATE (0x8e51): the attract machine moves on to the next
  // sub-state on the frame this one completes its clear.
  mem8[ATTRACT_SUBSTATE] = u8(mem8[ATTRACT_SUBSTATE] + 1); // advance the attract sub-state
  // Zero the board-init RAM regions -- the sprite display list and the actor/object
  // arena -- clearing any leftover entities before the attract field is repainted.
  zeroSpriteListAndActorArena(m); // zero the board-init RAM regions

  // --- Copy-protection stall -----------------------------------------------------
  // Spin until the ROM byte COPY_PROTECT_STALL_BYTE (0x07f5) reads STALL_MATCH
  // (0x11). On a genuine ROM that byte simply IS 0x11, so this falls straight
  // through; on a tampered image where the byte differs the machine hangs here
  // forever -- a deliberate copy-protection deadlock.
  while (mem8[COPY_PROTECT_STALL_BYTE] !== STALL_MATCH) { /* copy-protect stall */ }

  // --- Program-signature verification (tamper trap) ------------------------------
  // Verify seven signature bytes of the program image. `sample` walks DOWN the
  // signature block from its top SIGNATURE_EXPECTED_TOP (0x0838): 0x0838, 0x0837, ...
  // For each index b = 7..1 (index 0 is skipped) look up the 16-bit pointer
  // word-table[b] in SIGNATURE_WORD_TABLE (0x0976), then read the byte a fixed
  // SIG_FIELD_OFFSET (0x1c) past that pointer. Every expected byte must equal the
  // byte it points at. A single mismatch on the real machine branches into the
  // middle of the word table (0x0976) and executes table data as instructions -- a
  // corrupting tamper trap -- which is modeled here as a throw.
  let sample = SIGNATURE_EXPECTED_TOP;
  for (let b = SIG_COUNT; b !== 0; b--) {
    const entry = fetchWordFromTableIndex(m, b, SIGNATURE_WORD_TABLE); // word-table[b]
    if (mem8[sample] !== mem8[u16(entry + SIG_FIELD_OFFSET)])
      throw new Error("paintAttractColorsAndQueueDraws: program-signature mismatch -> tamper-trap jump into the data table");
    sample = u16(sample - 1); // step down to the next expected signature byte
  }

  // --- Real output: repaint the attribute map and queue the draws ----------------
  // With both gates passed, flood the tile-attribute/colour map (base ATTRIB_MAP_BASE
  // 0x8040, 31 columns x 30 rows, stride 0x20) from the ROM colour-column source
  // FIELD_ATTRIB_SRC_07D9 (0x07d9) -- this is the colour layer of the attract field.
  fillAttributeColumns(m, FIELD_ATTRIB_SRC_07D9); // paint the attribute map
  // Then append three two-byte display commands to the page-0x88 display-command
  // ring. The main loop drains the ring and each command's handler performs the
  // actual VRAM draw, so the on-screen result of this sub-state appears as these
  // commands are consumed.
  enqueueDisplayCommand(m, DISPLAY_CMD_068B); // queue three display commands
  enqueueDisplayCommand(m, DISPLAY_CMD_068E);
  enqueueDisplayCommand(m, DISPLAY_CMD_0200);
}
