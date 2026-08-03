// SPDX-License-Identifier: GPL-3.0-only
/**
 * runIntroRoarStep — the roar/finish step of the opening Kong-climb cutscene.  ROM 0x0BB3.
 *
 * Index 7 of the intro-cutscene dispatch table at ROM 0x0A7A, selected by INTRO_STEP
 * (0x6385) via `ld a,(0x6385) / rst 0x28` in loc_0a76 — the last step of the sequence,
 * reached only in-game while GAME_SUBSTATE (0x600A) == 7. It runs once per frame and
 * keys everything off SUBSTATE_TIMER (0x6009), the phase countdown, read at entry:
 *
 *   - at 0x90 remaining: fire the ROAR cue — SND_PRIORITY (0x608A) = 0x0F (the roar
 *     tune, per ram.js) for SND_PRIORITY_FRAMES (0x608B) = 3 frames — and bump the
 *     cutscene sprite byte at 0x6919 up by one.
 *   - at 0x18 remaining: bump that same sprite byte back down by one.
 *   - anywhere else: leave the cues alone.
 *
 * Then, every frame, it ticks the phase countdown through tickSubstateTimer (rst 0x18):
 * while the countdown has NOT expired the routine returns and does nothing more; on the
 * frame it expires it ends the cutscene — wrap INTRO_STEP back to 0, and advance the
 * game sub-state (inc SUBSTATE_TIMER, inc GAME_SUBSTATE 7 -> 8, the "how high" screen).
 *
 * The oracle's `rst 0x18` sets HL = 0x6009 as a side effect and the tail's two `inc (hl)`
 * ride that HL to touch 0x6009 then 0x600A; the direct-call model addresses both by name.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0bb3.test.js.
 * GATE:     crafted-entry — attract never enters the in-game intro cutscene, so every arm
 *           is exercised by crafted entries over a real attract base: an EXHAUSTIVE sweep of
 *           the SUBSTATE_TIMER branch selector (all 256 values covers the 0x90/0x18/expiry
 *           arms) plus inc/dec wrap edges. RAM (minus STACK_SCRATCH) identical to the oracle.
 * LIVE-OUT: memory-only — SND_PRIORITY/SND_PRIORITY_FRAMES, the 0x6919 sprite byte,
 *           SUBSTATE_TIMER, INTRO_STEP, GAME_SUBSTATE. Void routine; the oracle's SP/PC
 *           churn is the rst/ret caller-skip mechanism (now a boolean from tickSubstateTimer)
 *           and its residual A/F are dead ABI, so neither is in the contract.
 * NAMES:    SUBSTATE_TIMER, SND_PRIORITY, SND_PRIORITY_FRAMES, INTRO_STEP, GAME_SUBSTATE
 *           (ram.js). 0x6919 kept hex — a cutscene sprite-object byte inside SPRITE_OBJ_BLOCK
 *           (0x6908..0x692F) with no confirmed ram.js name.
 */

import {
  SUBSTATE_TIMER,
  SND_PRIORITY,
  SND_PRIORITY_FRAMES,
  INTRO_STEP,
  GAME_SUBSTATE,
} from "./ram.js";
import { tickSubstateTimer } from "./tickSubstateTimer.js";

// A cutscene sprite-object byte the roar cue nudges up (at 0x90) and back down (at 0x18).
// Inside SPRITE_OBJ_BLOCK (0x6908..0x692F); no confirmed name, so kept as its address.
const CUTSCENE_SPRITE_BYTE = 0x6919;

const ROAR_MARK = 0x90; // countdown value at which the roar fires
const LOWER_MARK = 0x18; // countdown value at which the sprite bump reverses
const ROAR_TUNE = 0x0f; // SND_PRIORITY value for the roar
const PRIORITY_PULSE = 0x03; // frames the priority tune plays

/** @param {object} m  the machine (uses m.mem only). Void — memory-equivalent to the oracle. */
export function runIntroRoarStep(m) {
  const { mem } = m;
  const countdown = mem.read8(SUBSTATE_TIMER);

  if (countdown === ROAR_MARK) {
    mem.write8(SND_PRIORITY, ROAR_TUNE);
    mem.write8(SND_PRIORITY_FRAMES, PRIORITY_PULSE);
    mem.write8(CUTSCENE_SPRITE_BYTE, (mem.read8(CUTSCENE_SPRITE_BYTE) + 1) & 0xff);
  } else if (countdown === LOWER_MARK) {
    mem.write8(CUTSCENE_SPRITE_BYTE, (mem.read8(CUTSCENE_SPRITE_BYTE) - 1) & 0xff);
  }

  // rst 0x18: tick the phase countdown; while it has not expired, do nothing more.
  if (!tickSubstateTimer(m)) return;

  // Countdown expired -> end the cutscene: wrap the sequence and advance the sub-state.
  mem.write8(INTRO_STEP, 0);
  mem.write8(SUBSTATE_TIMER, (mem.read8(SUBSTATE_TIMER) + 1) & 0xff);
  mem.write8(GAME_SUBSTATE, (mem.read8(GAME_SUBSTATE) + 1) & 0xff);
}
