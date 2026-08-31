// SPDX-License-Identifier: GPL-3.0-only
import { OBJ_HIT_FLAG_I0, OBJ_HIT_FLAG_I1 } from "./names.js";
import { fillByteRun } from "./fillByteRun.js";
import { queueSoundCommand01 } from "./queueSoundCommand01.js";
import { advanceTargetActorAlongVelocityElseDespawn } from "./advanceTargetActorAlongVelocityElseDespawn.js";
/**
 * advanceTargetActorState — per-object state step for the record based at IY.
 *
 * WHAT IT IS
 * The once-per-frame state step for one *target actor* — a launched game object that lives in a
 * fixed-size record. A target actor is the thing a shot can hit: in the bonus stage it is the
 * eagle, and elsewhere it is whatever object was launched into one of the target slots. Each such
 * object owns a 0x18-byte record; this routine is handed one record (its base address in IY) and
 * carries that one object forward by a single frame, deciding along the way whether the object
 * keeps living or is torn down.
 *
 * ROLE IN THE MACHINE
 * The object stepper walks the live target records once per frame and hands each in turn here. A
 * target actor is not driven by one uniform rule; the record itself carries the flags that pick
 * which of three behaviours applies this frame:
 *   - a record still in its LAUNCH sub-phase (bit0 of rec+7 set) plays its scripted entry motion —
 *     it slides down the screen four pixels per frame until it runs off the bottom, then deletes
 *     itself;
 *   - a record flagged as a two-axis mover (bit1 of rec+0 set) is a scripted flyer (the eagle),
 *     handed to the velocity integrator to fly its phase-scripted path;
 *   - every other record is a simple hit-or-timeout object: it lives until either its collision
 *     flag fires (it was shot) or its own frame countdown runs out, and then deletes itself.
 * Deleting an object means blanking all 0x18 bytes of its record so its slot reads free again.
 *
 * ROM 0x21cf-0x2225. Grounding: [seen].
 *
 * LIVE-OUT: memory only — the caller reads no register back. Depending on the branch taken this
 * frame it leaves behind one of: the advanced launch Y in rec+4 (plus the render seed 0x1b in
 * rec+0x0f on the first launch tick); the results of the two-axis mover; a consumed hit flag
 * (0x8d1b/0x8d1c cleared) and a blanked record; a decremented countdown in rec+6; or, on any
 * teardown, 0x18 zeroed bytes from the record base.
 */
export function advanceTargetActorState(m, rec = m.regs.iy) {
  const { mem8 } = m;

  // Teardown primitive shared by every delete path below: overwrite the whole 0x18-byte record with
  // zeroes (ROM 0x0010 memset) so the slot reads free and no stale field survives into a reuse.
  const clearRecord = () => fillByteRun(m, rec, 0x00, 0x18); // blank 0x18 bytes from the record base

  // BRANCH A — the LAUNCH sub-phase (rec+7 bit0 set): the scripted entry slide.
  // A record whose rec+7 bit0 is set is still playing its launch animation, so it ignores the
  // hit/timer logic below entirely and just marches down the screen.
  if (mem8[rec + 0x07] & 0x01) {
    // rec+1 is the launch arm/tick counter. 0 means the object exists but its launch has not been
    // armed yet, so it holds still for this frame.
    const step = mem8[rec + 0x01];
    if (step < 0x01) return; // not yet armed
    // On the very first armed tick (step == 1) latch the render seed once and advance the counter so
    // this one-time setup never repeats: rec+0x0f gets the starting animation/tile code 0x1b, and
    // the arm counter steps past 1.
    if (step === 0x01) {
      mem8[rec + 0x0f] = 0x1b; // seed on the first tick
      mem8[rec + 0x01] = step + 1;
    }
    // Advance the launch Y coordinate (rec+4) four pixels down the screen, wrapping in a byte the way
    // the hardware coordinate does.
    const y = (mem8[rec + 0x04] + 0x04) & 0xff;
    mem8[rec + 0x04] = y;
    // While Y is still above 0xe8 the object is on screen — keep it and stop for this frame. Once Y
    // reaches 0xe8 it has slid off the bottom of its travel, so delete the record.
    if (y < 0xe8) return; // still travelling
    return clearRecord();
  }

  // BRANCH B — the ordinary (non-launch) object path.
  // rec+0x12 is a one-shot "announced" flag. The first frame a record reaches this path it is zero,
  // so mark it and fire the object's sound once (sound command 0x01 via the shared audio ring); on
  // every later frame the flag is already set and the sound is not repeated.
  if (mem8[rec + 0x12] === 0) {
    mem8[rec + 0x12] = 1; // prime once
    queueSoundCommand01(m);
  }

  // Fork within branch B: a record flagged as a two-axis mover (rec+0 bit1 set) is a scripted flyer
  // (the eagle) whose motion is driven by a phase-scripted X/Y velocity integrator, not by the
  // hit/timeout logic below. Hand it off and return whatever that produces.
  if (mem8[rec] & 0x02) return advanceTargetActorAlongVelocityElseDespawn(m, rec); // two-axis mover

  // Simple hit-or-timeout object. Pick this object's collision flag by the parity of its record's
  // own address (bit 3 of the base): the two target slots share a pair of one-frame hit flags,
  // OBJ_HIT_FLAG_I0 (0x8d1b) for the even slot and OBJ_HIT_FLAG_I1 (0x8d1c) for the odd one.
  const timer = (rec & 0x08) ? OBJ_HIT_FLAG_I1 : OBJ_HIT_FLAG_I0;
  // If that flag is set the object was shot this frame: consume the flag (so the hit is registered
  // exactly once) and tear the struck object down.
  if (mem8[timer] !== 0) {
    mem8[timer] = 0x00; // consume the hit and clear
    return clearRecord();
  }

  // No hit this frame, so age the object's own life countdown (rec+6), which ticks down four per
  // frame. When fewer than four remain the next subtraction would underflow — that is the object's
  // lifetime expiring, so delete it. Otherwise take four off and let it live another frame.
  if (mem8[rec + 0x06] < 0x04) return clearRecord(); // countdown underflow
  mem8[rec + 0x06] = mem8[rec + 0x06] - 0x04;
}
