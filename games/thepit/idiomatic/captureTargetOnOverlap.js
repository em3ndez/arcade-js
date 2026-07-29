// SPDX-License-Identifier: GPL-3.0-only
/**
 * captureTargetOnOverlap — tick the dig target's countdown and, on expiry, snap the
 * tracked object onto the target when it overlaps, marking the target captured.  ROM 0x2cb7.
 *
 * Per-frame handler for the timed dig target that the tracked object is closing on.
 * Every tick it clears the shared overlap gate, then advances the target's countdown:
 *   - at the reload sentinel it hands off to the stamp-and-reset path (which re-arms
 *     the target for its next cycle);
 *   - while the countdown is still running it hands off to the shared overlap-record
 *     tail, leaving the target in place;
 *   - the frame the countdown expires it re-arms the countdown to fire again next
 *     frame and, unless the target is already captured, tests whether the tracked
 *     object has reached it.
 *
 * The reach test is a small capture box a fixed distance from the target: the object's
 * row must sit 11..13 below the target row, and its column inside an 8-wide band around
 * the target column (from 3 left to 4 right). Inside the box it CAPTURES — snaps the object squarely onto the target's
 * near edge, raises the captured flag, plays the capture sound, and continues into
 * building the target's sprite record. A miss on either axis means the object has not
 * reached the target yet, and it falls through to the target's advance/re-stage path.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2cb7.test.js.
 * GATE:     crafted-entry — 0x2cb7 is dispatched in attract (~119× / 3000 frames), so
 *           the entry is captured live, then the countdown / captured / overlap-window
 *           input bytes are driven identically on both sides to hit every path (the
 *           natural dispatch never aligns for a capture, so that arm is crafted). RAM
 *           diff minus the dead stack scratch; pc/SP/value-registers are the dead Z80
 *           trace and excluded — every hand-off is an idiomatic call (plain JS return),
 *           so a pc/SP contract would false-fail against the oracle's stack dance.
 * LIVE-OUT: memory-only — MOVE_BLOCK_FLAG, DIG_OBJ_TIMER, DIG_COLLISION_STATE, PLAYER_Y, plus
 *           whatever the delegated tail leaves, passed straight through. No register
 *           live-ins or live-outs: every input is read from RAM and every callee reads
 *           its inputs from RAM (no register hand-off).
 * NAMES:    MOVE_BLOCK_FLAG (per-tick overlap gate), DIG_OBJ_TIMER (target countdown),
 *           DIG_COLLISION_STATE (captured flag), PLAYER_Y/PLAYER_X (tracked object),
 *           HAZARD_X/HAZARD_Y (dig target cell).
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
} from "./ram.js";
import { requestSound20 } from "./requestSound20.js";
import { flagObjectTargetOverlap } from "./flagObjectTargetOverlap.js";
import { advanceDigTarget } from "./advanceDigTarget.js";
import { stampGlyphColumn } from "./stampGlyphColumn.js";
import { stageDigObjectSpriteRecord } from "./stageDigObjectSpriteRecord.js";

// The countdown value at which the target has finished its cycle and is re-stamped/reset.
const RELOAD_SENTINEL = 64;

export function captureTargetOnOverlap(m) {
  const { mem8 } = m;

  // Every tick starts with the shared overlap gate cleared (no overlap so far this frame).
  mem8[MOVE_BLOCK_FLAG] = 0;

  // At the reload sentinel the target's cycle is done — stamp its glyph and reset it.
  const timer = mem8[DIG_OBJ_TIMER];
  if (timer === RELOAD_SENTINEL) return stampGlyphColumn(m);

  // Otherwise tick the countdown down. While it is still running the target stays put
  // and just refreshes its overlap record.
  const ticked = timer - 1;
  mem8[DIG_OBJ_TIMER] = ticked;
  if (ticked !== 0) return flagObjectTargetOverlap(m);

  // The countdown expired: re-arm it to fire again next frame, then try to capture.
  mem8[DIG_OBJ_TIMER] = 1;

  // Once the target has already been captured there is nothing left to do here.
  if (mem8[DIG_COLLISION_STATE] !== 0) return advanceDigTarget(m);

  // Capture box: the object's row must sit just below the target (11..13 below) and its
  // column inside an 8-wide band around the target (from 3 left to 4 right). Miss on
  // either axis and the object hasn't reached the target yet.
  const objectRow = mem8[PLAYER_X];
  const targetRow = mem8[HAZARD_Y];
  if (u8(targetRow + 10) >= objectRow) return advanceDigTarget(m); // short of the box (row)
  if (u8(targetRow + 13) < objectRow) return advanceDigTarget(m); // past the box (row)

  const objectCol = mem8[PLAYER_Y];
  const targetCol = mem8[HAZARD_X];
  if (u8(targetCol - 4) >= objectCol) return advanceDigTarget(m); // left of the band (column)
  const snapCol = u8(targetCol + 4); // the target's near edge — where the object lands
  if (snapCol < objectCol) return advanceDigTarget(m); // right of the band (column)

  // Inside the box: capture. Snap the object onto the target's near edge, raise the
  // captured flag, play the capture sound, then build the target's sprite record.
  mem8[PLAYER_Y] = snapCol;
  mem8[DIG_COLLISION_STATE] = 1;
  requestSound20(m);
  return stageDigObjectSpriteRecord(m);
}
