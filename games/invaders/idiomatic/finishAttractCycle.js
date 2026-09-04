// SPDX-License-Identifier: GPL-3.0-only
import { waitShortDelay } from "./waitShortDelay.js";
import { waitLongDelay } from "./waitLongDelay.js";
import { runAttractAnimTask } from "./runAttractAnimTask.js";
import { loc_1988 } from "./loc_1988.js";
import { clearPlayfield } from "./clearPlayfield.js";
import { drawSpriteList } from "./drawSpriteList.js";
import { drawSprite8x8 } from "./drawSprite8x8.js";
import { fetchNextDrawRecord } from "./fetchNextDrawRecord.js";
import { loadDrawSequenceBlock } from "./loadDrawSequenceBlock.js";
import { typeDrawScriptRecord } from "./typeDrawScriptRecord.js";
import { typeDrawScript } from "./typeDrawScript.js";
import { runHandshakedAttractAnim } from "./runHandshakedAttractAnim.js";
import { enterAttractCycle } from "./enterAttractCycle.js";
import { u8 } from "../../../core/int.js";
import {
  SCREEN_MODE_TOGGLE, TASK_FLAGS, loc_3311, loc_2c11, loc_1f90, loc_1f9c, loc_1fa0, loc_1fd5,
} from "./names.js";

// Attract round teardown (run after the demo loop): clear the field, paint the credit / high-score panel
// and a typed script, run a handshaked reveal, flip SCREEN_MODE_TOGGLE so the next pass shows the other
// screen, and delegate back to the attract-cycle join. Generator; memory + IO.
export function* finishAttractCycle(m) {
  m.mem8[TASK_FLAGS] = 0x00;
  yield* waitShortDelay(m);
  loc_1988(m);
  drawSpriteList(m, loc_1f90, 0x0c, loc_2c11);
  if (m.mem8[SCREEN_MODE_TOGGLE] === 0) {
    drawSprite8x8(m, 0x02, loc_3311);
  }

  const rec = fetchNextDrawRecord(m, loc_1f9c); // rec[0] = dest, rec[1] = source
  yield* typeDrawScriptRecord(m, rec[1], rec[0]);
  if ((m.io.portIn(0x02) & 0x80) === 0) { // second-input select bit
    yield* typeDrawScript(m, loc_1fa0);
  }
  yield* waitLongDelay(m);

  if (m.mem8[SCREEN_MODE_TOGGLE] === 0) {
    loadDrawSequenceBlock(m, loc_1fd5);
    yield* runAttractAnimTask(m);
    yield* runHandshakedAttractAnim(m);
  }

  m.mem8[SCREEN_MODE_TOGGLE] = u8(m.mem8[SCREEN_MODE_TOGGLE] + 1) & 0x01;
  clearPlayfield(m);
  yield* enterAttractCycle(m);
}
