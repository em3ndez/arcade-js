// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { SOUND_ID_LATCH_8D1D, ARM_ANIM_TABLE } from "./names.js";
/**
 * descendObjectToLanding — drive one falling object down to its landing spot, then settle it
 * and announce the landing.
 *
 * WHAT IT IS
 *   The per-frame state handler for an object that is in its "descend" phase — a struck target,
 *   a released prize, or any actor the game has set travelling toward a resting row. It owns one
 *   ACTOR RECORD (a fixed-layout block of work RAM) whose base address is `rec`, and it runs once
 *   per frame for as long as that object is descending.
 *
 * ROLE IN THE MACHINE
 *   An object moves on a fixed-point vertical axis kept inside its own record: a fine position
 *   byte at +0x03 that is nudged every frame by the object's signed per-frame step, and a coarse
 *   sub-position byte at +0x04 — the record's Y coordinate — that borrows one whenever the fine
 *   byte underflows. Each frame this routine first advances the object's on-screen picture, then
 *   moves it one step down the axis, and finally checks the coarse Y. While the Y is still 3 or
 *   more the object is mid-flight and the routine just returns, leaving it to keep falling on the
 *   next frame. The first frame the Y drops below 3 the object has reached its landing row: the
 *   routine stops the descent, resets the object into its settled phase, hands the audio side a
 *   sound to play, and switches the object to its landing animation.
 *
 *   One per-object byte at +0x17 is the landing TYPE. It does double duty: its value + 1 is the
 *   landing sound id latched for the audio side, and its value indexes ARM_ANIM_TABLE (a ROM
 *   word table of animation-sequence pointers) to pick this object's landing animation. So the
 *   settle sound and the settle look are chosen together from the same type byte.
 *
 * ROM 0x4137-0x416e. Grounding: [seen].
 *
 * LIVE-OUT: none returned — a void object step. Every effect lands in memory: the object record
 *   (advanced fine position +0x03 and coarse Y +0x04, state reset to phase 0x02, dwell 0x18 at
 *   +0x11, and a retargeted animation), plus the landing-sound latch SOUND_ID_LATCH_8D1D.
 */
export function descendObjectToLanding(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // 1) Advance this object's animation by one frame first, so whatever it is currently drawing
  // (the falling picture) steps forward before we move it. The animation sequencer either counts
  // down the current frame's hold or pulls the next {tile, colour, hold} entry from the record's
  // own script.
  advanceObjectAnimationFrame(m, rec);

  // 2) Move the object one step down its vertical axis. The signed per-frame step lives at +0x0a;
  // it is added to the fine position byte at +0x03. When the fine byte cannot take the step
  // without underflowing (its current value is below -step), the coarse sub-position at +0x04 —
  // the record's Y coordinate — borrows one, exactly as the low byte of a two-byte position would
  // borrow into the high byte.
  const step = mem8[rec + 0x0a]; // signed descent step
  const pos = mem8[rec + 0x03];
  if (pos < u8(-step)) mem8[rec + 0x04] = u8(mem8[rec + 0x04] - 1); // borrow
  mem8[rec + 0x03] = u8(pos + step);

  // 3) Landing gate. The coarse Y at +0x04 counts down as the object descends; while it is still
  // 3 or more the object has not reached its landing row, so leave it mid-flight and return —
  // next frame steps it further down.
  if (mem8[rec + 0x04] >= 0x03) return; // still travelling

  // 4) Landed. Announce the landing to the audio side: read the object's landing-type byte at
  // +0x17 and write that value + 1 into the sound-command latch SOUND_ID_LATCH_8D1D (0x8d1d),
  // which the audio side reads to play the matching settle/land sound.
  const soundId = mem8[rec + 0x17];
  mem8[SOUND_ID_LATCH_8D1D] = u8(soundId + 1); // notify: landing sound id + 1

  // 5) Settle the object in place. Reset its state-machine index at +0x02 to phase 2 (its
  // landed/settled state) and load a dwell of 0x18 frames into the frame-delay byte at +0x11 so
  // the settled state holds for that long before the object's handler moves on.
  mem8[rec + 0x02] = 0x02; // reset to phase 2
  mem8[rec + 0x11] = 0x18;

  // 6) Give the object its landing look. Index ARM_ANIM_TABLE (the ROM word table at 0x41b1) by
  // the same landing-type byte to fetch the pointer to this object's landing animation sequence,
  // then point the record at that sequence and restart it from its first frame.
  const word = fetchWordFromTableIndex(m, soundId, ARM_ANIM_TABLE); // landing animation pointer
  return setActorAnimation(m, rec, word);
}
