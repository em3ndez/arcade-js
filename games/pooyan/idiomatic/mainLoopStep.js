// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { DISPLAY_CMD_RING_READ_PTR } from "./names.js";
import { repaintScrollColumnsElseVerifySignature } from "./repaintScrollColumnsElseVerifySignature.js";
import { paintActorCountColumn } from "./paintActorCountColumn.js";
import { renderPhaseGauge } from "./renderPhaseGauge.js";
import { paintAttractHudAndHighScores } from "./paintAttractHudAndHighScores.js";
import { accrueScoreAndUpdateHighScore } from "./accrueScoreAndUpdateHighScore.js";
import { resetBcdCounterAndRepaintColumn } from "./resetBcdCounterAndRepaintColumn.js";
import { drawBcdCounterColumn } from "./drawBcdCounterColumn.js";
import { drawStackedCharField } from "./drawStackedCharField.js";
import { drawCreditCountAndTamperCheck } from "./drawCreditCountAndTamperCheck.js";
import { flagHighScoreTableCorruptOnChecksumMiss } from "./flagHighScoreTableCorruptOnChecksumMiss.js";

const RING_PAGE = DISPLAY_CMD_RING_READ_PTR & ~0xff; // the ring lives on the cursor's page
const RING_WRAP = 0xc0; //                              cursor low wraps back to the ring base here

/**
 * mainLoopStep — one iteration of the main-loop state driver. Reads the
 * display-command ring at its read cursor: a worker slot (bit 7 set) runs the per-frame worker and
 * marks the vblank boundary; any other slot consumes one two-byte command, advances and wraps the
 * cursor, and runs the command's handler from the dispatch table.
 *
 * Returns true on the worker/ring-idle iteration (the vblank boundary), false on a command dispatch
 * (the generator keeps draining the ring within the frame).
 */
export function mainLoopStep(m) {
  const { mem8 } = m;
  const cursorLo = mem8[DISPLAY_CMD_RING_READ_PTR];
  const slotAddr = RING_PAGE | cursorLo;
  const slot = mem8[slotAddr];

  if (slot & 0x80) {
    repaintScrollColumnsElseVerifySignature(m); // worker slot -> the real vblank boundary
    return true;
  }

  const index = u8(slot << 1) & 0x1f; // (command * 2) & 0x1f -> the even dispatch-table offset
  const param = mem8[u16(slotAddr + 1)];
  mem8[slotAddr] = 0xff; //             free both consumed ring bytes
  mem8[u16(slotAddr + 1)] = 0xff;
  const advanced = u8(cursorLo + 2); // two bytes consumed
  mem8[DISPLAY_CMD_RING_READ_PTR] = advanced >= RING_WRAP ? advanced : RING_WRAP;

  switch (index) {
    case 0x00: paintActorCountColumn(m); break;
    case 0x02: renderPhaseGauge(m); break;
    case 0x04: paintAttractHudAndHighScores(m); break;
    case 0x06: accrueScoreAndUpdateHighScore(m, param); break;
    case 0x08: resetBcdCounterAndRepaintColumn(m, param); break;
    case 0x0a: drawBcdCounterColumn(m, param); break;
    case 0x0c: drawStackedCharField(m, param); break;
    case 0x0e: drawCreditCountAndTamperCheck(m); break;
    case 0x10: flagHighScoreTableCorruptOnChecksumMiss(m); break;
  }
  return false;
}
