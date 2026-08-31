// SPDX-License-Identifier: GPL-3.0-only
import {
  ATTRACT_SUBSTATE,
  FIELD_ATTRIB_SRC_C,
  ATTRACT_INTEGRITY_CKSUM_BASE,
  OBJECT_SPAWN_DISPLAY_CMD,
  ATTRACT_DISPLAY_CMD_060B,
} from "./names.js";
import { blankFillRowAndStepCounter } from "./blankFillRowAndStepCounter.js";
import { armTileFillFromPlayfieldBase } from "./armTileFillFromPlayfieldBase.js";
import { fillAttributeColumns } from "./fillAttributeColumns.js";
import { queueCreditDisplayCommands } from "./queueCreditDisplayCommands.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
/**
 * blankRowThenFloodColorsAndAdvanceAttract — attract sub-state 1.
 *
 * WHAT IT IS
 *   One handler in the small state machine that runs the attract-mode demo — the self-playing
 *   loop shown when nobody has paid to play. That demo is driven by a sub-state selector,
 *   ATTRACT_SUBSTATE (0x8e51): each frame the attract dispatcher reads it and jumps to the handler
 *   for the current sub-state, and a handler advances the selector to move the demo forward. This
 *   routine is the handler for sub-state 1. Its job is to erase the tilemap that the previous
 *   sub-state left on screen, repaint the colour layer, and hand the demo on to the next sub-state
 *   — but only after satisfying two anti-tamper checks that a genuine, unmodified ROM always passes.
 *
 * ROLE IN THE MACHINE
 *   Erasing the whole 32x32 tile grid is too much work for one frame, so the machine spreads it
 *   across many: this handler blanks one tick's worth of the fill each frame and RETURNS WITHOUT
 *   advancing the sub-state while the fill is still draining, so the dispatcher keeps re-entering
 *   sub-state 1 frame after frame until the grid is clear. Once the erase drains, it re-arms the
 *   fill, floods the colour/attribute map so the attract screen shows its colours, queues the
 *   credit line and two more display commands, and finally bumps the sub-state selector so the
 *   next frame runs a different handler. Straddling the colour flood are two ROM checksum guards:
 *   Pooyan's copy protection sprinkles such guards through the code so a tampered image derails
 *   into a dead trap instead of running. Both guards here can only fail on a modified ROM, so on
 *   an intact machine they are invisible and the routine always reaches its normal exit.
 *
 * ROM 0x08e9 (0x08e9-0x0923). Grounding: [seen].
 *
 * LIVE-OUT: none — the attract dispatcher reads no result register. Its effect is entirely in the
 * side effects it leaves behind: the tilemap fill cursor/counter stepped one tick, the colour map
 * flooded, three display commands enqueued, and ATTRACT_SUBSTATE (0x8e51) advanced to 7.
 */

const FILL_ROW_COUNT = 0x1d;  // tiles to blank this tick — the per-pass run length handed to the row eraser
const GUARD1_LEN = 0x20;      // bytes summed by the first integrity guard (32-byte colour-source table)
const GUARD1_SUM = 0x63;      // 8-bit sum the first guard's table must total on an intact ROM
const GUARD2_LEN = 0x09;      // bytes summed by the second integrity guard (9-byte ROM block 0x0831-0x0839)
const GUARD2_SUM = 0xaa;      // 8-bit sum the second guard's block must total on an intact ROM
const NEXT_SUBSTATE = 0x07;   // attract sub-state to advance to once this handler completes cleanly

export function blankRowThenFloodColorsAndAdvanceAttract(m) {
  const { mem8 } = m;

  // Step 1 — blank one tick of the tilemap erase, and stay in this sub-state while it drains.
  // blankFillRowAndStepCounter (ROM 0x02ce) blanks FILL_ROW_COUNT (0x1d) tiles at the fill cursor
  // TILE_FILL_PTR (0x880b), snaps the cursor to the next row, and ticks the row counter
  // FILL_ROW_COUNTER (0x8809) down by one. It reports true only on the pass that drains the last
  // row; while it is still false the erase is unfinished, so bail here without advancing the
  // sub-state — the attract dispatcher will re-enter sub-state 1 next frame and blank another tick.
  if (!blankFillRowAndStepCounter(m, FILL_ROW_COUNT)) return;

  // Step 2 — the erase has drained, so re-arm the fill for the screen about to be painted.
  // armTileFillFromPlayfieldBase (ROM 0x02e3) resets the fill cursor TILE_FILL_PTR (0x880b) back to
  // the fixed VRAM start and reseeds the row counter, priming the row-by-row fill machinery again.
  armTileFillFromPlayfieldBase(m);

  // Step 3 — first anti-tamper guard, sitting in front of the colour flood. Fold GUARD1_LEN (0x20)
  // bytes of the ROM colour/attribute column source table FIELD_ATTRIB_SRC_C (0x0859) into an 8-bit
  // running sum. On the shipped ROM this total is always GUARD1_SUM (0x63); any other value means
  // the table has been altered, and the machine takes that as a hard integrity trap it never
  // returns from. The check is unreachable-by-design on an intact image.
  let guard1 = 0;
  for (let i = 0; i < GUARD1_LEN; i++) guard1 = (guard1 + mem8[FIELD_ATTRIB_SRC_C + i]) & 0xff;
  if (guard1 !== GUARD1_SUM) throw new Error("blankRowThenFloodColorsAndAdvanceAttract: attribute-table integrity trap (unreachable with intact data)");

  // Step 4 — flood the colour/attribute map for the attract screen. fillAttributeColumns (ROM
  // 0x075d) walks the ROM column source table FIELD_ATTRIB_SRC_C (0x0859) — the very table just
  // verified — and paints it column by column into the attribute/colour plane at ATTRIB_MAP_BASE
  // (0x8040), which sets the on-screen colours of the tilemap the erase cleared.
  fillAttributeColumns(m, FIELD_ATTRIB_SRC_C);

  // Step 5 — second anti-tamper guard, sitting behind the colour flood. Fold GUARD2_LEN (0x09)
  // bytes of the ROM block descending from ATTRACT_INTEGRITY_CKSUM_BASE (0x0831-0x0839) into an
  // 8-bit sum; on the shipped ROM it totals GUARD2_SUM (0xaa). As with the first guard, a mismatch
  // can only arise from a modified image and is treated as a hard integrity trap.
  let guard2 = 0;
  for (let i = 0; i < GUARD2_LEN; i++) guard2 = (guard2 + mem8[ATTRACT_INTEGRITY_CKSUM_BASE + i]) & 0xff;
  if (guard2 !== GUARD2_SUM) throw new Error("blankRowThenFloodColorsAndAdvanceAttract: code-block integrity trap (unreachable with intact data)");

  // Step 6 — queue the credit line. queueCreditDisplayCommands (ROM 0x0e54) enqueues the primary
  // credit/coin display command, plus an extra command when the coinage config COINAGE_CONFIG
  // (0x882c) holds the free-play sentinel, so the attract screen shows the correct credit prompt.
  queueCreditDisplayCommands(m);

  // Step 7 — enqueue the two remaining attract-layout commands into the display-command ring.
  // enqueueDisplayCommand (ROM rst 0x38) posts a two-byte command each call: first
  // OBJECT_SPAWN_DISPLAY_CMD (0x0611), then ATTRACT_DISPLAY_CMD_060B (0x060b), in that order.
  enqueueDisplayCommand(m, OBJECT_SPAWN_DISPLAY_CMD);
  enqueueDisplayCommand(m, ATTRACT_DISPLAY_CMD_060B);

  // Step 8 — advance the demo. Writing NEXT_SUBSTATE (7) into ATTRACT_SUBSTATE (0x8e51) means the
  // next frame the attract dispatcher jumps to sub-state 7 instead of re-entering this handler.
  mem8[ATTRACT_SUBSTATE] = NEXT_SUBSTATE;
}
