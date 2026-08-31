// SPDX-License-Identifier: GPL-3.0-only
import { restartActorAnimUnlessPhaseAdvanced } from "./restartActorAnimUnlessPhaseAdvanced.js";
/**
 * restartActorAnimIfFlagBit0Set — spawn-step guard on one actor's flag byte.  [seen]  (ROM 0x1389)
 *
 * WHAT IT IS
 * ----------
 * Every moving thing on screen — a hunter riding a rope, a spawned prize, a struck object — is
 * tracked by an ACTOR RECORD, a fixed-layout block of bytes in work RAM whose base address is
 * passed in as `rec`. This tiny routine is the outer door of the actor spawn/queue step: before
 * anything is allowed to touch the record it checks a single control bit, and only if that bit
 * is set does it let the real spawn/queue work run.
 *
 * The bit it checks is bit 0 of the record's FLAG BYTE, at record offset +8. That flag is the
 * record's "this actor has spawn/queue work pending" marker. When the bit is clear there is
 * nothing to do for this actor this pass, so the routine returns immediately and leaves the
 * record exactly as it found it. When the bit is set it hands the same record on to the
 * spawn/queue step, restartActorAnimUnlessPhaseAdvanced (ROM 0x141c), which then decides —
 * based on the record's own phase byte — whether to clear the flag and (re)start the actor's
 * animation, or to leave an already-established actor alone.
 *
 * ROLE IN THE MACHINE
 * -------------------
 * This is the per-record gate the spawn/queue sweep calls as it walks the actor records. It
 * keeps the heavier spawn/queue step (which clears fields and rewinds an animation sequence)
 * from firing on records that have not flagged themselves as needing it, so only actors that
 * asked for the step actually get it.
 *
 * GROUNDING: [seen].
 *
 * LIVE-OUT: memory only. On the guard-clear path (flag bit 0 == 0) nothing is written and the
 * record is untouched. Otherwise the writes are whatever restartActorAnimUnlessPhaseAdvanced
 * performs on the same record (either nothing, when its phase gate is closed, or the cleared
 * flag byte plus the animation fields it stamps in).
 */

export function restartActorAnimIfFlagBit0Set(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // GUARD: test bit 0 of the actor record's flag byte at offset +8 (ROM 0x1389 reads this same
  // byte via the record pointer). Bit 0 is the "spawn/queue step pending" marker for this actor.
  // When it is clear there is no pending work, so return at once and leave the whole record
  // exactly as it was — no field is read further, none is written.
  if ((mem8[rec + 0x08] & 0x01) === 0) return;

  // Bit 0 was set, so this actor has spawn/queue work pending. Hand the same record on to the
  // spawn/queue step (restartActorAnimUnlessPhaseAdvanced, ROM 0x141c). That routine applies its
  // own phase gate and, when the actor is still early, clears the flag byte (+8) and rewinds the
  // actor's animation sequence to its first frame.
  restartActorAnimUnlessPhaseAdvanced(m, rec);
}
