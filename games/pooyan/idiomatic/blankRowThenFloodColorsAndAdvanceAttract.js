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
 * Blanks one tick's worth of the tilemap and stays in this sub-state until that fill drains. Once it
 * drains, two data-table integrity guards straddle a re-arm of the fill and a flood of the colour
 * map; a tampered table can never satisfy a guard, so a mismatch is a hard integrity trap. On a
 * clean pass it queues two display commands and advances the attract sub-state.
 *
 * LIVE-OUT: none — the attract dispatcher reads no result register.
 */

const FILL_ROW_COUNT = 0x1d;
const GUARD1_LEN = 0x20;
const GUARD1_SUM = 0x63;
const GUARD2_LEN = 0x09;
const GUARD2_SUM = 0xaa;
const NEXT_SUBSTATE = 0x07;

export function blankRowThenFloodColorsAndAdvanceAttract(m) {
  const { mem8 } = m;

  // Stay in this sub-state while the row-by-row blank is still draining.
  if (!blankFillRowAndStepCounter(m, FILL_ROW_COUNT)) return;
  armTileFillFromPlayfieldBase(m);

  let guard1 = 0;
  for (let i = 0; i < GUARD1_LEN; i++) guard1 = (guard1 + mem8[FIELD_ATTRIB_SRC_C + i]) & 0xff;
  if (guard1 !== GUARD1_SUM) throw new Error("blankRowThenFloodColorsAndAdvanceAttract: attribute-table integrity trap (unreachable with intact data)");

  fillAttributeColumns(m, FIELD_ATTRIB_SRC_C);

  let guard2 = 0;
  for (let i = 0; i < GUARD2_LEN; i++) guard2 = (guard2 + mem8[ATTRACT_INTEGRITY_CKSUM_BASE + i]) & 0xff;
  if (guard2 !== GUARD2_SUM) throw new Error("blankRowThenFloodColorsAndAdvanceAttract: code-block integrity trap (unreachable with intact data)");

  queueCreditDisplayCommands(m);
  enqueueDisplayCommand(m, OBJECT_SPAWN_DISPLAY_CMD);
  enqueueDisplayCommand(m, ATTRACT_DISPLAY_CMD_060B);
  mem8[ATTRACT_SUBSTATE] = NEXT_SUBSTATE;
}
