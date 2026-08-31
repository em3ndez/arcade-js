// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { fillByteRun } from "./fillByteRun.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import { stampTwoPlaneColumnStrip } from "./stampTwoPlaneColumnStrip.js";
import { fillAttributeColumns } from "./fillAttributeColumns.js";
import { queueCreditDisplayCommands } from "./queueCreditDisplayCommands.js";
import { queueSoundCommands82And95 } from "./queueSoundCommands82And95.js";
import {
  TILE_FILL_PTR,
  FILL_ROW_COUNTER,
  PLAY_STATE_INDEX,
  ACTIVE_PLAYER,
  BONUS_AWARD_DSW,
  ATTRACT_FIELD_ATTRIB_SRC,
  DISPLAY_CMD_0601,
  OBJECT_SPAWN_DISPLAY_CMD,
  DISPLAY_CMD_0616,
  DISPLAY_CMD_0617,
  DISPLAY_CMD_0628,
  DISPLAY_CMD_062A,
  DISPLAY_CMD_0629,
} from "./names.js";
/**
 * fillIntroRowsThenBuildBoardIntro — board-intro state 1: paint two tile-fill runs, count down, then build the intro.
 *
 * Each call fills two 0x1d-byte runs of tile 0x10 from the fill cursor (advancing it past each run
 * plus a 3-cell gap) and ticks the row countdown. While the countdown holds it returns. Once it
 * drains it advances the play sub-state and runs the one-shot intro build: an integrity checksum,
 * the attribute-column flood, the credit display commands, the two-plane column stamp, a run of
 * rst-0x38 display commands (whose 1P/2P variants come from the bonus-award DSW bit), and two sound
 * commands.
 *
 * LIVE-OUT: none — a frame-interrupt state handler; only its memory writes survive.
 */
const TILE_FILL_VALUE = 0x10; // byte stamped across each run
const FILL_RUN_LEN = 0x1d; //   bytes per run
const FILL_RUN_GAP = 3; //      cursor gap between runs

export function fillIntroRowsThenBuildBoardIntro(m) {
  const { mem8, mem16 } = m;

  let cursor = mem16[TILE_FILL_PTR];
  cursor = u16(fillByteRun(m, cursor, TILE_FILL_VALUE, FILL_RUN_LEN) + FILL_RUN_GAP);
  cursor = u16(fillByteRun(m, cursor, TILE_FILL_VALUE, FILL_RUN_LEN) + FILL_RUN_GAP);
  mem16[TILE_FILL_PTR] = cursor;

  mem8[FILL_ROW_COUNTER] = u8(mem8[FILL_ROW_COUNTER] - 1);
  if (mem8[FILL_ROW_COUNTER] !== 0) return; // countdown still running
  mem8[PLAY_STATE_INDEX] = u8(mem8[PLAY_STATE_INDEX] + 1);

  // Integrity guard: sum 256-byte passes from ATTRACT_FIELD_ATTRIB_SRC until the total hits the
  // expected marker (0xc1 with carry count 0x0c); spins on a tampered image. Result is dead.
  let ptr = ATTRACT_FIELD_ATTRIB_SRC;
  let acc = mem8[ptr];
  let carry = 0;
  for (;;) {
    let count = 256;
    do {
      ptr = u16(ptr + 1);
      const t = acc + mem8[ptr];
      if (t > 0xff) carry = u8(carry + 1);
      acc = t & 0xff;
    } while (--count);
    if (acc !== 0xc1) continue;
    acc = carry;
    if (acc !== 0x0c) continue;
    break;
  }

  mem8[ACTIVE_PLAYER] = fillAttributeColumns(m, ATTRACT_FIELD_ATTRIB_SRC); // store the leftover A (0x1f)
  queueCreditDisplayCommands(m);
  stampTwoPlaneColumnStrip(m); // stamp the two-plane column table
  enqueueDisplayCommand(m, DISPLAY_CMD_0601);
  enqueueDisplayCommand(m, OBJECT_SPAWN_DISPLAY_CMD); // the object-spawn command code
  enqueueDisplayCommand(m, DISPLAY_CMD_0616);
  const dsw = mem8[BONUS_AWARD_DSW] & 0x01;
  enqueueDisplayCommand(m, dsw ? DISPLAY_CMD_0628 : DISPLAY_CMD_0617);
  enqueueDisplayCommand(m, dsw ? DISPLAY_CMD_0629 : DISPLAY_CMD_062A);
  queueSoundCommands82And95(m);
  // (A second integrity checksum over ATTRACT_SCRIPT_TABLE_BASE followed here, but both of its
  // acting branches are disabled — zero durable effect — so it is omitted.)
}
