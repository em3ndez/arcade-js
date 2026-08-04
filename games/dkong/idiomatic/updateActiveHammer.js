// SPDX-License-Identifier: GPL-3.0-only
/**
 * updateActiveHammer — advance the active hammer's duration counter one tick and lay down
 * this frame's hammer sprite; when the counter passes its ~512-frame limit, end the hammer.
 * ROM 0x2F43.
 *
 * The per-frame updater for an active hammer (reached from entry_2ed4's hammer-active
 * chain). It first stamps the caller's hammer sprite tile code into Mario's on-screen
 * sprite record, resets the record's attribute byte to the shared value the record
 * write expects, then ticks the 16-bit hammer duration counter (HAMMER_TIMER_LO/HI)
 * and routes on how far it has run:
 *
 *   - the low byte advanced without wrapping (still inside the current 256-count
 *     block): hand off to selectHammerSpriteBlinkByTimer, which lays down this frame's
 *     record — writing it directly in the counter's first 256 counts and flashing it
 *     thereafter.
 *   - the low byte wrapped and the high byte is now non-zero but not the expiry value
 *     (the counter is in its later stretch, 256..511): hand off to
 *     blinkHammerSpriteOnFramePhase, which flashes the attribute before committing.
 *   - the low byte wrapped and the high byte just reached the expiry value (the counter
 *     passed 512, the hammer's lifetime): END the hammer — zero the counter high byte,
 *     clear the hammer-active flag, deactivate the object and park its sprite at the
 *     screen origin (its X-displacement set to minus Mario's X, so the record write's
 *     "Mario X + displacement" resolves to 0), restore Mario's normal sprite code and
 *     the background tune saved when the hammer was grabbed, then commit the cleared
 *     record one last time.
 *
 * All three routes converge on the shared record write (commitSpriteRecordAtMarioOffset).
 * The record's destination address, object base, and tile-code byte pass straight
 * through from the caller in registers — the genuine oracle boundary the pipeline
 * permits, since this updater's own callers are still the translated oracle — and the
 * attribute byte is the shared value set here.
 *
 * NAME (promoted, DK understanding pass 7 — independent proposer≠confirmer): the active
 * hammer's per-frame updater. The mechanism (hammer duration tick + expiry teardown) is
 * grounded by the [seen] HAMMER_TIMER_LO/HI cells, whose registry comment names this
 * routine (ROM 0x2F4C `inc (hl)`) the counter's incrementer and states the hammer ends
 * when the high byte reaches 2 (~512 frames), clearing MARIO_HAMMER_ACTIVE and restoring
 * the saved background tune — precisely this routine's expiry arm.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2f43.test.js.
 * GATE:     captured + crafted. 0x2F43 runs every frame an attract hammer is active, so
 *           captured dispatches replay the common tick path; crafted entries then pin
 *           all three routes — the low-byte no-wrap tick (both selectHammerSpriteBlinkByTimer
 *           sub-branches, via the timer high byte), the 256-count wrap into the blink
 *           arm, and the 512-count EXPIRY with its counter reset / hammer-flag clear /
 *           sprite-park / code+tune restore — plus the low-byte wrap boundary and the
 *           8-bit position wraps. Full RAM dump compared with NO exclusion: neither this
 *           updater nor any tail writes the stack. Teeth: an inverted low-byte-wrap
 *           gate, a wrong expiry threshold, and a dropped hammer-flag clear.
 * LIVE-OUT: memory-only. Every route tail-calls the record write and the updater's own
 *           caller discards the result; the oracle's residual registers/flags and the
 *           tails' terminal return reach no consumer. pc/SP are not compared.
 * NAMES:    HAMMER_TIMER_LO/HI (0x6394/0x6395), MARIO_HAMMER_ACTIVE (0x6217), MARIO_X
 *           (0x6203), MARIO_SPRITE_CODE (0x6207), MARIO_SPRITE_RECORD (0x694C) with the
 *           SPRITE_CODE field offset, OBJ_ACTIVE, SND_BGM (0x6089) — all from names.js.
 *           The object-record field +0x01 (cleared on expiry) and the object X-displacement
 *           field +0x0E have no names.js name yet and stay local hex consts here; the saved-tune
 *           scratch cell is HAMMER_SAVED_BGM (0x6389, from names.js). The three tails are
 *           direct-called; the shared record attribute is marshalled into the tail's register.
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
import { selectHammerSpriteBlinkByTimer } from "./selectHammerSpriteBlinkByTimer.js"; // ROM 0x2FB7 — low-byte-no-wrap build arm
import { blinkHammerSpriteOnFramePhase } from "./blinkHammerSpriteOnFramePhase.js"; // ROM 0x2FBE — later-stretch blink arm
import { commitSpriteRecordAtMarioOffset } from "./commitSpriteRecordAtMarioOffset.js"; // ROM 0x2F7C — shared record write

// Object-record field offsets with no names.js name yet.
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
