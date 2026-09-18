// SPDX-License-Identifier: GPL-3.0-only
/**
 * captureTargetOnOverlap — tick the dig target's countdown and, on expiry, snap the tracked object
 * onto the target when it overlaps, marking the target captured.
 *
 * Per-frame handler for the timed dig target that the tracked object is closing on. Every tick it
 * clears the shared overlap gate MOVE_BLOCK_FLAG, then advances the countdown DIG_OBJ_TIMER: at the
 * reload sentinel it hands off to the stamp-and-reset path (re-arming the target for its next
 * cycle); while the countdown still runs it hands off to the shared overlap-record tail, leaving
 * the target in place; the frame it expires it re-arms the countdown and, unless
 * DIG_COLLISION_STATE already marks it captured, tests whether the object has reached it.
 *
 * The reach test is a small capture box: the object's row must sit 11..13 below the target row, and
 * its column inside an 8-wide band around the target column (3 left to 4 right). Inside the box it
 * CAPTURES — snaps the object onto the target's near edge, raises the captured flag, plays the
 * capture sound, and continues into building the target's sprite record. A miss on either axis
 * means it falls through to the target's advance/re-stage path.
 */

import { u8 } from "../../../core/int.js";
import {
  MOVE_BLOCK_FLAG,
  DIG_OBJ_TIMER,
  DIG_COLLISION_STATE,
  PLAYER_Y,
  PLAYER_X,
  HAZARD_X,
  HAZARD_Y,
} from "./names.js";
import { requestSound20 } from "./requestSound20.js";
import { flagObjectTargetOverlap } from "./flagObjectTargetOverlap.js";
import { advanceDigTarget } from "./advanceDigTarget.js";
import { stampGlyphColumn } from "./stampGlyphColumn.js";
import { stageDigObjectSpriteRecord } from "./stageDigObjectSpriteRecord.js";

// The countdown value at which the target has finished its cycle and is re-stamped/reset.
const RELOAD_SENTINEL = 64;

export function captureTargetOnOverlap(m) {
  const { mem8 } = m;

  // Every tick starts with the shared overlap gate cleared.
  mem8[MOVE_BLOCK_FLAG] = 0;

  // At the reload sentinel the target's cycle is done — stamp its glyph and reset it.
  const timer = mem8[DIG_OBJ_TIMER];
  if (timer === RELOAD_SENTINEL) return stampGlyphColumn(m);

  // Otherwise tick down; while still running the target stays put and refreshes its overlap record.
  const ticked = timer - 1;
  mem8[DIG_OBJ_TIMER] = ticked;
  if (ticked !== 0) return flagObjectTargetOverlap(m);

  // The countdown expired: re-arm it to fire again next frame, then try to capture.
  mem8[DIG_OBJ_TIMER] = 1;

  // Nothing to do once the target is already captured.
  if (mem8[DIG_COLLISION_STATE] !== 0) return advanceDigTarget(m);

  // Capture box: row 11..13 below the target, column in an 8-wide band (3 left to 4 right).
  const objectRow = mem8[PLAYER_X];
  const targetRow = mem8[HAZARD_Y];
  if (u8(targetRow + 10) >= objectRow) return advanceDigTarget(m); // short of the box (row)
  if (u8(targetRow + 13) < objectRow) return advanceDigTarget(m);

  const objectCol = mem8[PLAYER_Y];
  const targetCol = mem8[HAZARD_X];
  if (u8(targetCol - 4) >= objectCol) return advanceDigTarget(m);
  const snapCol = u8(targetCol + 4); // the target's near edge
  if (snapCol < objectCol) return advanceDigTarget(m); // right of the band

  // Inside the box: snap the object onto the near edge, flag captured, sound, build the record.
  mem8[PLAYER_Y] = snapCol;
  mem8[DIG_COLLISION_STATE] = 1;
  requestSound20(m);
  return stageDigObjectSpriteRecord(m);
}
