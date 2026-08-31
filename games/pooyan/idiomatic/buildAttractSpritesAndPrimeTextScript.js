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
 * buildAttractSpritesAndPrimeTextScript — attract sub-state 4 handler.  ROM 0x099c-0x09f7.
 * Grounding: [seen].
 *
 * WHAT IT IS
 * The attract/demo sequence is one beat of the top-level game machine (game state 1,
 * dispatchAttractSubstate). That driver walks ATTRACT_SUBSTATE (0x8e51) through a table of
 * per-phase handlers indexed off ATTRACT_SUBSTATE_DISPATCH (0x08a1); one handler runs per frame.
 * This is the handler for sub-state 4 — the one-time build of the attract scene. It first spends
 * several frames wiping the tilemap a row at a time, and then, on the single frame the wipe
 * finishes, lays out the whole demo scene (object cast, tile blocks, colour map) and arms the
 * scrolling text-draw script that types the on-screen copy.
 *
 * ROLE IN THE MACHINE
 * Because the row-clear is staggered across frames, this routine is entered once per frame for
 * several frames; every early frame does nothing but blank another row and return, so no single
 * attract frame is expensive. Only the frame that drains the clear performs the heavy scene build,
 * and that same frame advances ATTRACT_SUBSTATE so the build runs exactly once — the following
 * frames belong to the lighter text-typing phase.
 *
 * LIVE-OUT (what it leaves in memory once the build frame runs)
 *   - the object arena at SPRITE_OBJECT_TABLE (0x8b70) zero-filled then rebuilt into a chain of
 *     0x18-stride object records (the attract-scene cast),
 *   - the colour/attribute map flooded and a display command queued into the page-0x88 ring,
 *   - two fixed tile blocks stamped and the looping-animation cursor seeded,
 *   - the text-draw script control block seated at 0x8e50-0x8e56 (read pointer, VRAM write cursor,
 *     frame delay, checksum-interval reloads) with ATTRACT_SUBSTATE bumped to the next phase.
 * Returns nothing; it tails into the object-anim / sprite-list rebuild so the fresh cast shows the
 * same frame.
 */

const ROW_CLEAR_CELLS = 0x19; // cells blanked per frame by the row-clear pass
const VERIFY_PAIRS = 0x0d; //    program-image byte pairs the tamper spin-verify checks
const RECORD_STRIDE = 0x18; //   object-record pitch
const OBJ_SENTINEL = 0xff; //    descriptor byte that ends the build loop

export function buildAttractSpritesAndPrimeTextScript(m) {
  const { mem8, mem16 } = m;

  // Row-clear gate. blankFillRowAndStepCounter blanks ROW_CLEAR_CELLS (0x19 = 25) tiles at the
  // running fill cursor, steps to the next row, and decrements a row counter; it reports false
  // while rows remain. So the tilemap is wiped one row per frame across successive attract frames,
  // and this handler bails out early on every frame until the last row drains — keeping each frame
  // cheap and only then falling through to the full scene build below.
  if (!blankFillRowAndStepCounter(m, ROW_CLEAR_CELLS)) return; // rows remain -> return, resume next frame

  // Anti-tamper spin-verify (copy protection). Compare VERIFY_PAIRS (0x0d = 13) byte pairs: a run
  // at ATTRACT_S4_CHECK_SRC (0x07c9) against a reference run at ATTRACT_S4_CHECK_REF (0x0a65). The
  // inner loop re-reads the SAME byte pair until the two agree — on an authentic ROM they match
  // immediately and it falls straight through, but on a patched image whose bytes differ the
  // comparison never succeeds and the machine hangs here forever. A deliberate lock, not a wait.
  let src = ATTRACT_S4_CHECK_SRC;
  let ref = ATTRACT_S4_CHECK_REF;
  for (let n = VERIFY_PAIRS; n > 0; n--) {
    while (mem8[src] !== mem8[ref]) { /* tamper freeze: mismatch spins forever */ }
    src = u16(src + 1);
    ref = u16(ref + 1);
  }

  fillAttributeColumns(m, ATTRACT_S4_ATTRIB_SRC); // flood the colour/attribute map from the ROM pattern at 0x07b9 (background colours)
  enqueueDisplayCommand(m, ATTRACT_S4_DISPLAY_CMD); // queue the two-byte display command 0x060d into the page-0x88 ring the main loop drains
  fillByteRun(m, SPRITE_OBJECT_TABLE, 0x00, 0x00); // zero-fill the object arena at 0x8b70 (count 0x00 = a full 256-byte wipe) before it is rebuilt

  // Build the attract-scene object cast. Two parallel ROM streams feed the arena: a descriptor
  // stream at ATTRACT_S4_OBJ_DESCRIPTORS (0x0a7e) and a coordinate stream at ATTRACT_S4_OBJ_COORDS
  // (0x0a76). Each pass seeds one object record at the arena cursor from both streams (seedObjectRecord
  // consumes from each and hands back the advanced pointers), and the cursor steps by RECORD_STRIDE
  // (0x18) to the next record slot. The loop stops when the next descriptor byte is the OBJ_SENTINEL
  // (0xff) end marker.
  let record = SPRITE_OBJECT_TABLE;
  let descPtr = ATTRACT_S4_OBJ_DESCRIPTORS;
  let coordPtr = ATTRACT_S4_OBJ_COORDS;
  do {
    [descPtr, coordPtr] = seedObjectRecord(m, record, descPtr, coordPtr);
    record = u16(record + RECORD_STRIDE);
  } while (mem8[descPtr] !== OBJ_SENTINEL);

  paintTwo2x2TileBlocks(m); // stamp two fixed 2x2 tile blocks into video RAM from one shared source pattern (static scenery)
  primeAttractAnimAndPaintTileBlocks(m); // seed the frame-animation cursor and paint its two-slot tile pair (arms the demo's looping animation)

  // Seat the text-draw script control block at 0x8e50-0x8e56. A small byte-stream interpreter
  // types the attract copy onto the screen; these fields tell it where to read from, where to
  // write, and how fast to step.
  mem16[SCRIPT_READ_PTR] = ATTRACT_S4_DRAW_SCRIPT; // 0x8e54 <- 0x0a87: the ROM source the script reads its draw bytes from
  mem16[SCRIPT_WRITE_PTR] = ATTRACT_S4_VRAM_CURSOR; // 0x8e56 <- 0x8648: the VRAM address the emitted characters land at
  mem8[SCRIPT_FRAME_TIMER] = 0x32; // 0x8e50 <- 50: per-frame countdown before the first script step runs
  mem8[ATTRACT_SUBSTATE] = mem8[ATTRACT_SUBSTATE] + 1; // 0x8e51 +1: advance off sub-state 4 so this build runs once (mem8 store truncates to a byte)
  mem8[SCRIPT_STEP_COUNTDOWN] = 0x0d; // 0x8e52 <- 0x0d: reload for the script's row-checksum interval
  mem8[SCRIPT_COL_CHECK_TICK] = 0x05; // 0x8e53 <- 0x05: reload for the column-checksum tick

  // Tail into advanceFourObjectAnimsAndRebuildList (0x09f8): step four object records' animations
  // and rebuild the sprite display list, so the freshly-seeded cast is drawn this same frame. This
  // handler returns that (void) result.
  return advanceFourObjectAnimsAndRebuildList(m); // fall through: step object anims + rebuild the sprite display list
}
