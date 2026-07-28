// SPDX-License-Identifier: GPL-3.0-only
/**
 * flagObjectTargetOverlap — flag whether the freshly-placed target cell coincides with the tracked
 * object, then hand off to build the cell's record.  ROM 0x2c91.
 *
 * The dig/projectile-spawn path (spawnPendingDigObject) has just painted a target cell at
 * (TARGET_X, TARGET_Y); the cell's per-tick countdown handler (captureTargetOnOverlap) also drops
 * in here on every tick the cell is still alive. This shared tail decides whether the
 * tracked object is sitting on that cell and publishes a single 0/1 flag to
 * DIG_OVERLAP_HOLD, then continues into building the cell's 4-byte record.
 *
 * Overlap needs BOTH axes to line up, otherwise the flag is 0:
 *   - Row: the cell's row plus 12 must land exactly on the object's row.
 *   - Column: the object's X must fall inside the 8-pixel-wide band that opens just
 *     to the right of the cell's X — i.e. cell X is strictly left of the object, and
 *     the object is no more than 8 past it.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2c91.test.js.
 * GATE:     crafted-entry sweep — captured from a real attract dispatch (this tail is
 *           reached ~62× per 3000 attract frames), then the four input bytes are swept
 *           across and around the overlap window identically on both sides; RAM diff
 *           (minus the dead stack scratch) vs the oracle. pc/SP/value-registers are the
 *           dead Z80 trace and excluded — the record-build tail is idiomatic (a plain JS
 *           return, no stack dance), so a pc/SP contract would false-fail against the
 *           oracle even though the memory matches.
 * LIVE-OUT: memory (DIG_OVERLAP_HOLD) + whatever the record-build tail returns, passed
 *           straight through. No register live-ins — every input is read from RAM, and
 *           the record builder reads its inputs from RAM too (no register hand-off).
 * NAMES:    OBJ_X/OBJ_Y (tracked object), TARGET_X/TARGET_Y (placed cell),
 *           DIG_OVERLAP_HOLD (the published flag). Stays loc_ — the flag's downstream effect
 *           is only weakly grounded (DIG_OVERLAP_HOLD is a weak name and the oracle tags the
 *           role best-effort), so there is no earned action verb to name it by.
 *
 * PURPOSE [guess]: what consumes DIG_OVERLAP_HOLD.
 */

import { u8 } from "../../../core/int.js";
import { OBJ_X, OBJ_Y, TARGET_X, TARGET_Y, DIG_OVERLAP_HOLD } from "./ram.js";
import { stageDigObjectSpriteRecord } from "./stageDigObjectSpriteRecord.js";

export function flagObjectTargetOverlap(m) {
  const { mem8 } = m;

  const objectRow = mem8[OBJ_Y];
  const objectX = mem8[OBJ_X];
  const cellX = mem8[TARGET_X];

  // Both axes must coincide for the cell and the object to count as overlapping.
  const rowsAlign = u8(mem8[TARGET_Y] + 12) === objectRow;
  const objectRightOfCell = cellX < objectX;
  const objectWithinBand = u8(cellX + 8) >= objectX;
  const overlaps = rowsAlign && objectRightOfCell && objectWithinBand;

  mem8[DIG_OVERLAP_HOLD] = overlaps ? 1 : 0;

  // Build the placed cell's sprite record and continue; its return unwinds to our caller.
  return stageDigObjectSpriteRecord(m);
}
