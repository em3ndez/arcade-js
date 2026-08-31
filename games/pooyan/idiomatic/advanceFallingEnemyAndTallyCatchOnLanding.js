// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  STAGE_COUNTDOWN,
  ACTIVE_ENEMY_COUNT,
  SPLASH_ANIM_TABLE_40A4,
  CATCH_TAMPER_CKSUM_TOP,
  TAMPER_STRIKES_CATCH,
} from "./names.js";
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { advanceFallStep } from "./advanceFallStep.js";
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { queueSoundCommands82And03 } from "./queueSoundCommands82And03.js";
import { renderStageCountdownDigits } from "./renderStageCountdownDigits.js";
/**
 * advanceFallingEnemyAndTallyCatchOnLanding — object state-15 (catch) handler for the record based at IX.
 *
 * WHAT IT IS
 *   The per-object state-machine handler for state 15, the "catch" state. Once an enemy has been
 *   caught, its object record is switched into this state; from then on, each frame, this handler
 *   makes the caught object fall and — the moment it touches the landing row — tallies the catch:
 *   it installs a splash animation, chimes the catch sound, and books the object off the field.
 *
 * ROLE IN THE MACHINE
 *   Runs once per frame for the single object record based at IX while that record sits in state 15.
 *   Every frame it does two things: steps the record's animation sequence one frame, and takes one
 *   gravity step. It keeps returning early — leaving the record in state 15 — until the fall
 *   reaches the landing row, at which point it runs the one-shot landing/tally work and moves the
 *   record on to its splash state.
 *
 * ROM ADDRESS: 0x3f7c (occupies ROM 0x3f7c-0x3fd4).
 * GROUNDING: [seen].
 *
 * LIVE-OUT (memory only; no return value):
 *   - record fields: state byte rec+0x02 <- 0x02, splash-hold timer rec+0x11 <- 0x20, and the
 *     record's animation pointer (via setActorAnimation) aimed at the caught kind's splash sequence.
 *   - ACTIVE_ENEMY_COUNT (0x8d40): decremented by one.
 *   - STAGE_COUNTDOWN (0x8901): decremented (normal path) or cleared to 0 (special path), with its
 *     HUD digits repainted either way.
 *   - TAMPER_STRIKES_CATCH (0x89eb): set to 1 only on the special path, and only when the ROM
 *     integrity checksum fails.
 */
export function advanceFallingEnemyAndTallyCatchOnLanding(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Per-frame fall loop. Advance the caught object's on-screen animation by one frame, then take
  // one gravity step downward. advanceFallStep leaves the carry set ("still above the landing row")
  // while the object is airborne; on those frames we bail out and let the record stay in state 15
  // so the fall resumes next frame. Only when the object reaches the landing row does control fall
  // through into the one-shot landing/tally work below.
  advanceObjectAnimationFrame(m, rec); // step the record's animation sequence one frame
  if (advanceFallStep(m, rec)) return; // still airborne — resume the fall next frame

  // Landing / catch tally — runs once, the frame the caught object touches down.
  // The caught object's kind is held in the low two bits of its record byte rec+0x07; (kind & 3) - 1
  // indexes SPLASH_ANIM_TABLE_40A4 (ROM 0x40a4), a table of little-endian animation-sequence
  // pointers, so each caught kind gets its own splash graphic. setActorAnimation aims the record at
  // that sequence and restarts it, so the splash plays from its first frame.
  const animIndex = ((mem8[rec + 0x07] & 0x03) - 1) & 0xff;
  const anim = fetchWordFromTableIndex(m, animIndex, SPLASH_ANIM_TABLE_40A4);
  setActorAnimation(m, rec, anim);
  mem8[rec + 0x02] = 0x02; // hand the record to state 2 so the splash animation plays out
  mem8[rec + 0x11] = 0x20; // reload the splash-hold timer to 0x20 frames
  queueSoundCommands82And03(m); // queue the two fixed catch sound commands (0x82, 0x03)
  mem8[ACTIVE_ENEMY_COUNT] = mem8[ACTIVE_ENEMY_COUNT] - 1; // one fewer live enemy on the field (0x8d40)

  // Path select on bit0 of the record's path-flag byte rec+0x0b.
  // Normal path (bit0 clear): this catch counts against the stage's catch quota. Decrement the
  // per-stage countdown STAGE_COUNTDOWN (0x8901) and repaint its two HUD digits. If the countdown
  // is already 0 there is nothing left to tick, so return without touching it.
  if ((mem8[rec + 0x0b] & 0x01) === 0) {
    if (mem8[STAGE_COUNTDOWN] === 0) return; // quota already exhausted — nothing to decrement
    mem8[STAGE_COUNTDOWN] = mem8[STAGE_COUNTDOWN] - 1;
    return renderStageCountdownDigits(m); // repaint the stage-countdown HUD digits
  }

  // Special path (bit0 set): clear the stage countdown outright, repaint it, then run an anti-tamper
  // integrity check folded into the catch handler.
  mem8[STAGE_COUNTDOWN] = 0x00; // force the stage countdown to 0
  renderStageCountdownDigits(m); // repaint the (now-zero) stage-countdown HUD digits

  // ROM integrity checksum. Walk a block of program ROM downward from CATCH_TAMPER_CKSUM_TOP
  // (0x428b), accumulating an 8-bit running sum and counting how many of the additions overflowed
  // past 0xff (the carry count). The byte 0xc8 marks the bottom of the block and ends the walk.
  let sum = 0;
  let carries = 0;
  let ptr = CATCH_TAMPER_CKSUM_TOP;
  for (;;) {
    const b = mem8[ptr];
    if (b === 0xc8) break; // 0xc8 = end-of-block terminator
    const total = b + sum;
    if (total > 0xff) carries = (carries + 1) & 0xff; // count each 8-bit overflow (carry)
    sum = total & 0xff;
    ptr = u16(ptr - 1); // walk downward through ROM
  }
  // An untampered image produces exactly eight carries, so (0xc8 - carries) lands on 0xc0 and the
  // check returns silently. Any other carry count means the code image has been altered: raise the
  // catch integrity-strike flag TAMPER_STRIKES_CATCH (0x89eb), a tripwire other code reads to
  // disrupt play.
  if (((0xc8 - carries) & 0xff) === 0xc0) return; // eight carries — integrity OK
  mem8[TAMPER_STRIKES_CATCH] = 0x01; // mismatch — flag a catch tamper strike
}
