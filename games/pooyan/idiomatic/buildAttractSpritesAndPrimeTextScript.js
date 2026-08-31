// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { blankFillRowAndStepCounter } from "./blankFillRowAndStepCounter.js";
import { fillAttributeColumns } from "./fillAttributeColumns.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import { fillByteRun } from "./fillByteRun.js";
import { seedObjectRecord } from "./seedObjectRecord.js";
import { paintTwo2x2TileBlocks } from "./paintTwo2x2TileBlocks.js";
import { primeAttractAnimAndPaintTileBlocks } from "./primeAttractAnimAndPaintTileBlocks.js";
import { advanceFourObjectAnimsAndRebuildList } from "./advanceFourObjectAnimsAndRebuildList.js";
import {
  ATTRACT_S4_CHECK_SRC, ATTRACT_S4_CHECK_REF, ATTRACT_S4_ATTRIB_SRC, ATTRACT_S4_DISPLAY_CMD,
  ATTRACT_S4_OBJ_COORDS, ATTRACT_S4_OBJ_DESCRIPTORS, ATTRACT_S4_DRAW_SCRIPT, ATTRACT_S4_VRAM_CURSOR,
  SPRITE_OBJECT_TABLE, SCRIPT_READ_PTR, SCRIPT_WRITE_PTR, SCRIPT_FRAME_TIMER, ATTRACT_SUBSTATE,
  SCRIPT_STEP_COUNTDOWN, SCRIPT_COL_CHECK_TICK,
} from "./names.js";
/**
 * buildAttractSpritesAndPrimeTextScript — attract sub-state 4 handler.
 *
 * One row of the tilemap is blanked per frame; while rows remain it returns. Once the row-clear
 * drains it spin-verifies 0x0d program-image byte pairs (a mismatch never advances — a tamper
 * freeze), floods the attribute map, queues a display command, zero-fills the object arena, builds
 * object records from a descriptor/coordinate stream pair until the descriptor sentinel (0xff), runs
 * two tile-init routines, seats the read/write pointers and control bytes of the text-draw script
 * block, and falls through into the object-anim/sprite-list rebuild.
 *
 * LIVE-OUT: none — a void attract handler dispatched by jp (hl); it falls into the void tail.
 */

const ROW_CLEAR_CELLS = 0x19; // cells blanked per frame by the row-clear pass
const VERIFY_PAIRS = 0x0d; //    program-image byte pairs the tamper spin-verify checks
const RECORD_STRIDE = 0x18; //   object-record pitch
const OBJ_SENTINEL = 0xff; //    descriptor byte that ends the build loop

export function buildAttractSpritesAndPrimeTextScript(m) {
  const { mem8, mem16 } = m;

  if (!blankFillRowAndStepCounter(m, ROW_CLEAR_CELLS)) return; // rows remain -> return, resume next frame

  // spin-verify: a tampered image pair never matches, so this never advances (deliberate freeze)
  let src = ATTRACT_S4_CHECK_SRC;
  let ref = ATTRACT_S4_CHECK_REF;
  for (let n = VERIFY_PAIRS; n > 0; n--) {
    while (mem8[src] !== mem8[ref]) { /* tamper freeze: mismatch spins forever */ }
    src = u16(src + 1);
    ref = u16(ref + 1);
  }

  fillAttributeColumns(m, ATTRACT_S4_ATTRIB_SRC); // flood the colour map
  enqueueDisplayCommand(m, ATTRACT_S4_DISPLAY_CMD); // queue one display command
  fillByteRun(m, SPRITE_OBJECT_TABLE, 0x00, 0x00); // zero-fill the 256-byte object arena

  // build object records from the descriptor+coordinate streams until the descriptor sentinel
  let record = SPRITE_OBJECT_TABLE;
  let descPtr = ATTRACT_S4_OBJ_DESCRIPTORS;
  let coordPtr = ATTRACT_S4_OBJ_COORDS;
  do {
    [descPtr, coordPtr] = seedObjectRecord(m, record, descPtr, coordPtr);
    record = u16(record + RECORD_STRIDE);
  } while (mem8[descPtr] !== OBJ_SENTINEL);

  paintTwo2x2TileBlocks(m); // stamp the fixed tile blocks
  primeAttractAnimAndPaintTileBlocks(m); // seed the anim cursor + paint the two-slot tiles

  mem16[SCRIPT_READ_PTR] = ATTRACT_S4_DRAW_SCRIPT; // source of the text-draw script
  mem16[SCRIPT_WRITE_PTR] = ATTRACT_S4_VRAM_CURSOR; // its VRAM write cursor
  mem8[SCRIPT_FRAME_TIMER] = 0x32; // initial per-frame delay
  mem8[ATTRACT_SUBSTATE] = mem8[ATTRACT_SUBSTATE] + 1; // advance the attract sub-state (mem8 truncates)
  mem8[SCRIPT_STEP_COUNTDOWN] = 0x0d; // row-checksum interval
  mem8[SCRIPT_COL_CHECK_TICK] = 0x05; // column-checksum interval

  return advanceFourObjectAnimsAndRebuildList(m); // fall through: step object anims + rebuild the sprite display list
}
