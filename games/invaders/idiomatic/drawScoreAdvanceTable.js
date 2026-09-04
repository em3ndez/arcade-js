// SPDX-License-Identifier: GPL-3.0-only
import { drawSpriteList } from "./drawSpriteList.js";
import { fetchNextDrawRecord } from "./fetchNextDrawRecord.js";
import { drawSpriteColumn16 } from "./drawSpriteColumn16.js";
import { typeSecondDrawScript } from "./typeSecondDrawScript.js";
import { TYPE_PACE_COUNT, loc_2810, loc_1ca3, loc_1dbe } from "./names.js";
import { u16 } from "../../../core/int.js";

// Draw the attract score-advance table: print the header string, set the per-record type pace, then blit
// each record of the first draw script (no delay) until its 0xff terminator, and finally tail into the
// second script, which types with delays. Generator; memory-only.
export function* drawScoreAdvanceTable(m) {
  drawSpriteList(m, loc_1ca3, 0x15, loc_2810);
  m.mem8[TYPE_PACE_COUNT] = 0x0a;
  let ptr = loc_1dbe;
  for (;;) {
    if (m.mem8[ptr] === 0xff) break;
    fetchNextDrawRecord(m, ptr); // seats the dest/source regs the blit reads
    ptr = u16(ptr + 4);
    drawSpriteColumn16(m);
  }
  yield* typeSecondDrawScript(m);
}
