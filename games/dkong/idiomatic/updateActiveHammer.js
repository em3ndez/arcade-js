// SPDX-License-Identifier: GPL-3.0-only
/**
 * updateActiveHammer — advance the active hammer's duration counter one tick and lay down this
 * frame's hammer sprite; when the counter passes its lifetime, end the hammer.
 *
 * The per-frame updater for a hammer Mario is holding. It first stamps the caller's hammer
 * sprite tile code into Mario's on-screen sprite record and sets the record's attribute byte to
 * the shared value the record write expects, then ticks the 16-bit hammer duration counter and
 * routes on how far it has run:
 *
 *   - the low byte advanced without wrapping, so the counter is still inside its current
 *     256-count block: hand off to the arm that lays down this frame's record, writing it
 *     directly for the first block and flashing it thereafter.
 *   - the low byte wrapped and the high byte is now non-zero but not yet the expiry value, so
 *     the counter is in its later stretch: hand off to the arm that flashes the attribute
 *     before committing.
 *   - the low byte wrapped and the high byte just reached the expiry value, so the hammer's
 *     lifetime — roughly 512 counts — is up: END the hammer. Zero the counter's high byte,
 *     clear the hammer-active flag, deactivate the object and park its sprite at the screen
 *     origin by setting its X displacement to minus Mario's X, so that the record write's
 *     "Mario's X plus the displacement" resolves to zero. Then restore Mario's normal sprite
 *     code and the background tune that was saved when the hammer was grabbed, and commit the
 *     cleared record one last time.
 *
 * All three routes converge on the shared record write. The record's destination address, the
 * object base and the tile-code byte pass straight through from the caller in registers; the
 * attribute byte is the shared value set here.
 *
 * Reads: the hammer duration counter; Mario's X and sprite code; the saved background tune.
 * Writes: the duration counter; Mario's sprite record; and on expiry the hammer-active flag,
 * two object-record fields, Mario's restored sprite code and the restored tune.
 *
 * LIVE-OUT: memory-only. Every route ends in the record write and the caller discards the
 * result.
 */

import {
  HAMMER_TIMER_LO,
  HAMMER_TIMER_HI,
  MARIO_HAMMER_ACTIVE,
  MARIO_X,
  MARIO_SPRITE_CODE,
  MARIO_SPRITE_RECORD,
  SPRITE_CODE,
  OBJ_ACTIVE,
  SND_BGM,
  HAMMER_SAVED_BGM,
} from "./names.js";
import { u8 } from "../../../core/int.js";
import { selectHammerSpriteBlinkByTimer } from "./selectHammerSpriteBlinkByTimer.js";
import { blinkHammerSpriteOnFramePhase } from "./blinkHammerSpriteOnFramePhase.js";
import { commitSpriteRecordAtMarioOffset } from "./commitSpriteRecordAtMarioOffset.js";

// Object-record field offsets that carry no shared name, scoped here.
const OBJ_FIELD_01 = 0x01;       // cleared to 0 when the hammer ends
const OBJ_X_DISPLACEMENT = 0x0e; // horizontal offset added to Mario's X by the record write

// The attribute byte the shared record write stores; set here for every route.
const RECORD_ATTR = 0x07;

// High-byte value at which the ~512-count hammer lifetime is up.
const EXPIRY_HIGH = 0x02;

export function updateActiveHammer(m) {
  const { regs, mem } = m;
  const objBase = regs.ix; // the object record this hammer sprite belongs to (from the caller)

  // Stamp the caller's hammer sprite tile code into Mario's on-screen sprite record,
  // then set the shared attribute the record write stores on whichever route runs.
  mem.write8(MARIO_SPRITE_RECORD + SPRITE_CODE, regs.c);
  regs.c = RECORD_ATTR;

  // Tick the counter's low byte. While it advances without wrapping, this frame just
  // lays down the sprite record through the timer-split build arm.
  const lo = u8(mem.read8(HAMMER_TIMER_LO) + 1);
  mem.write8(HAMMER_TIMER_LO, lo);
  if (lo !== 0) {
    selectHammerSpriteBlinkByTimer(m);
    return;
  }

  // Low byte wrapped: carry into the high byte. Until it reaches the expiry value the
  // hammer is in its later stretch — flash the sprite while committing the record.
  const hi = u8(mem.read8(HAMMER_TIMER_HI) + 1);
  mem.write8(HAMMER_TIMER_HI, hi);
  if (hi !== EXPIRY_HIGH) {
    blinkHammerSpriteOnFramePhase(m);
    return;
  }

  // The counter passed 512: the hammer's time is up. Zero the high byte (the low byte
  // already wrapped to 0), clear the hammer-active flag, deactivate the object, and
  // park its sprite at the screen origin — the object's X-displacement becomes minus
  // Mario's X, so the record write's (Mario X + displacement) resolves to 0.
  mem.write8(HAMMER_TIMER_HI, 0);
  mem.write8(MARIO_HAMMER_ACTIVE, 0);
  mem.write8((objBase + OBJ_FIELD_01) & 0xffff, 0);
  mem.write8((objBase + OBJ_X_DISPLACEMENT) & 0xffff, -mem.read8(MARIO_X));

  // Restore Mario's normal sprite code and the background tune saved at hammer grab.
  mem.write8(MARIO_SPRITE_RECORD + SPRITE_CODE, mem.read8(MARIO_SPRITE_CODE));
  mem.write8((objBase + OBJ_ACTIVE) & 0xffff, 0);
  mem.write8(SND_BGM, mem.read8(HAMMER_SAVED_BGM));

  // Commit the now-cleared record one last time.
  commitSpriteRecordAtMarioOffset(m);
}
