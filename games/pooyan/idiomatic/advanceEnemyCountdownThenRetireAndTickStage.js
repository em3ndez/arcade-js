// SPDX-License-Identifier: GPL-3.0-only
import {
  ACTIVE_ENEMY_COUNT,
  STAGE_COUNTDOWN,
  SPAWN_PHASE_COUNTER,
  PLAY_STATE_INDEX,
  HUD_STAGE_DIGIT_LO,
} from "./names.js";
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { blankActorSpriteBand } from "./blankActorSpriteBand.js";

/**
 * advanceEnemyCountdownThenRetireAndTickStage — per-frame update for one enemy object that
 * travels toward a limit on a two-byte position countdown, and RETIRES itself when the
 * countdown expires.
 *
 * WHAT IT IS
 *   One object handler in the enemy-actor system. Each enemy record carries a position held
 *   as two bytes — a fine sub-position (record+0x05) and a coarse whole-unit counter
 *   (record+0x06) — plus a signed per-frame step (record+0x0a). Every frame this routine
 *   nudges that position by the step. The coarse byte is the object's remaining lifetime on
 *   this leg of travel: when it reaches zero the object has finished its journey and is torn
 *   down, and the tear-down doubles as the stage's progress tick.
 *
 * ROLE IN THE MACHINE
 *   Called once per frame with the object record's base address (the enemy record pointer,
 *   here `rec`). While the object is still travelling it only advances the animation and the
 *   position and returns. The single frame on which the coarse counter rolls to zero is the
 *   retire frame: the object stops drawing, the on-screen enemy tally drops by one, and the
 *   per-stage countdown that paces a wave ticks down by one — which is what visibly walks the
 *   stage number in the HUD toward zero as enemies are cleared.
 *
 * ROM 0x1270-0x12ae.  Grounding: [seen].
 *
 * LIVE-OUT (memory only; no register value is consumed by the caller):
 *   - the object record: fine sub-position (rec+0x05), coarse counter (rec+0x06), and — on
 *     the retire frame — its sprite band cleared to blank.
 *   - ACTIVE_ENEMY_COUNT (0x8d40): decremented on retire.
 *   - STAGE_COUNTDOWN (0x8901): decremented on retire when still nonzero.
 *   - SPAWN_PHASE_COUNTER (0x8902): bumped on retire while in play-state 4.
 *   - HUD_STAGE_DIGIT_LO (0x8743): the new single-digit countdown value, when it fits one
 *     decimal digit.
 */

const REC_FINE = 0x05; //   record+0x05: fine sub-position (low byte of the travel countdown)
const REC_COARSE = 0x06; // record+0x06: coarse counter (whole units of travel remaining)
const REC_STEP = 0x0a; //   record+0x0a: signed per-frame step added to the position
const HUD_DIGIT_CAP = 0x0a; // countdown-1 is mirrored to the HUD units tile only when below this (a single 0-9 digit)

export function advanceEnemyCountdownThenRetireAndTickStage(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Advance this object's animation first, exactly as the shared per-object pre-step does for
  // every actor: run the frame-hold countdown and walk the animation script for the record at
  // `rec`. The position countdown below is independent of the picture the object shows.
  advanceObjectAnimationFrame(m, rec);

  // Advance the two-byte position by the signed step (rec+0x0a). The fine byte (rec+0x05) is
  // the low part and the coarse byte (rec+0x06) the high part, so this is a plain multi-byte
  // add: `negStep` is the step's two's-complement magnitude, and when the fine value sits
  // below it the sum crosses the byte boundary downward and one unit must be borrowed from the
  // coarse counter (rec+0x06). The coarse write is masked to a byte, matching the hardware
  // counter wrapping at 0xff.
  const step = mem8[rec + REC_STEP];
  const negStep = (0x100 - step) & 0xff;
  const fine = mem8[rec + REC_FINE];
  if (fine < negStep) mem8[rec + REC_COARSE] = mem8[rec + REC_COARSE] - 1; // borrow one unit into the coarse counter
  mem8[rec + REC_FINE] = fine + step;

  // While the coarse counter (rec+0x06) is still nonzero the object has travel left this leg,
  // so we are done for the frame — no retire, no stage tick.
  if (mem8[rec + REC_COARSE] !== 0) return; // coarse counter still running

  // --- Retire frame: the coarse counter has rolled to zero, so this object has reached its
  // limit and is torn down. Everything below runs exactly once, on this frame. ---

  // Stop the object drawing: clear its sprite band (the fixed 0x17-byte block from `rec`).
  blankActorSpriteBand(m, rec);

  // One fewer enemy is live on screen. ACTIVE_ENEMY_COUNT (0x8d40) is the on-screen enemy
  // tally — incremented at spawn, decremented here at retire.
  mem8[ACTIVE_ENEMY_COUNT] = mem8[ACTIVE_ENEMY_COUNT] - 1;

  // Tick the per-stage countdown. STAGE_COUNTDOWN (0x8901) counts down from 0x20 across a
  // stage and gates actor AI as it nears zero; each retired enemy walks it down by one. It is
  // read before the decrement so the HUD update further down can use the pre-tick value, and
  // it is only decremented while still nonzero so it floors at zero rather than wrapping.
  const countdown = mem8[STAGE_COUNTDOWN];
  if (countdown !== 0) mem8[STAGE_COUNTDOWN] = countdown - 1;

  // In play-state 4 only, advance the per-round phase counter. PLAY_STATE_INDEX (0x880a) is
  // the in-play sub-state; state 4 is the wave-active phase, and SPAWN_PHASE_COUNTER (0x8902)
  // is the round/wave phase counter that selects the spawn/fire mode branches — so each retire
  // during a live wave steps that phase forward.
  if (mem8[PLAY_STATE_INDEX] === 0x04) {
    mem8[SPAWN_PHASE_COUNTER] = mem8[SPAWN_PHASE_COUNTER] + 1;
  }

  // Mirror the new countdown value into the HUD units tile. `digit` is the post-tick value
  // (pre-tick countdown minus one). HUD_STAGE_DIGIT_LO (0x8743) is the units tile of the
  // on-screen stage-countdown number; it is refreshed here only when the value is a single
  // decimal digit (below 0x0a) — while the countdown is still 0x0a or higher its two-digit
  // form is painted elsewhere and this fast path stays out of the way.
  const digit = (countdown - 1) & 0xff;
  if (digit >= HUD_DIGIT_CAP) return;
  mem8[HUD_STAGE_DIGIT_LO] = digit;
}
