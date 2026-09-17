// SPDX-License-Identifier: GPL-3.0-only
/**
 * updateActiveHammer — advance the active hammer's duration counter one tick and lay down this
 * frame's hammer sprite; when the counter passes its lifetime, end the hammer.
 *
 * Stamps the caller's hammer tile code into Mario's sprite record, sets the shared record
 * attribute, then ticks the 16-bit duration counter: still in the current 256-block hands off
 * to the build/blink arm, later stretch to the blink arm, and on reaching the expiry high byte
 * (~512 counts) ends the hammer — clears the active flag, deactivates and parks the object,
 * restores Mario's sprite code and the saved BGM, and commits the cleared record.
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

const OBJ_FIELD_01 = 0x01;
const OBJ_X_DISPLACEMENT = 0x0e; // added to Mario's X by the record write
const RECORD_ATTR = 0x07;
const EXPIRY_HIGH = 0x02; // high byte at which the ~512-count lifetime is up

export function updateActiveHammer(m) {
  const { regs, mem8 } = m;
  const objBase = regs.ix;

  mem8[MARIO_SPRITE_RECORD + SPRITE_CODE] = regs.c;
  regs.c = RECORD_ATTR;

  // Tick the low byte; while it advances without wrapping, just lay down the record.
  const lo = u8(mem8[HAMMER_TIMER_LO] + 1);
  mem8[HAMMER_TIMER_LO] = lo;
  if (lo !== 0) {
    selectHammerSpriteBlinkByTimer(m);
    return;
  }

  // Low byte wrapped: carry into the high byte. Below expiry, flash while committing.
  const hi = u8(mem8[HAMMER_TIMER_HI] + 1);
  mem8[HAMMER_TIMER_HI] = hi;
  if (hi !== EXPIRY_HIGH) {
    blinkHammerSpriteOnFramePhase(m);
    return;
  }

  // Lifetime up. Park the sprite at the origin: X-displacement = −Mario's X, so the record
  // write's (Mario X + displacement) resolves to 0.
  mem8[HAMMER_TIMER_HI] = 0;
  mem8[MARIO_HAMMER_ACTIVE] = 0;
  mem8[(objBase + OBJ_FIELD_01) & 0xffff] = 0;
  mem8[(objBase + OBJ_X_DISPLACEMENT) & 0xffff] = -mem8[MARIO_X];

  // Restore Mario's normal sprite code and the BGM saved at hammer grab.
  mem8[MARIO_SPRITE_RECORD + SPRITE_CODE] = mem8[MARIO_SPRITE_CODE];
  mem8[(objBase + OBJ_ACTIVE) & 0xffff] = 0;
  mem8[SND_BGM] = mem8[HAMMER_SAVED_BGM];

  commitSpriteRecordAtMarioOffset(m);
}
