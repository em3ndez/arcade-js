// SPDX-License-Identifier: GPL-3.0-only
import { setActorAnimation } from "./setActorAnimation.js";
import { verifyTableChecksum } from "./verifyTableChecksum.js";
import { advanceEagleStageTimersAndLatchMoveElseRearm } from "./advanceEagleStageTimersAndLatchMoveElseRearm.js";
import { SPECIAL_ACTOR_ACTIVE_FLAG, ANIM_TABLE_3847, CHECKSUM_ROM_BASE } from "./names.js";
/**
 * spawnSpecialActorElseStep — spawn the singleton actor, or step it if it already exists.
 *
 * WHAT IT IS
 * The single entry point for the bonus-stage eagle. Only one eagle is ever on screen at a time, so
 * this routine is a birth-or-service gate: the first time it runs for a wave it brings the eagle
 * into existence and lays down its starting state; every servicing after that it simply advances
 * the eagle that already lives. A one-byte flag, SPECIAL_ACTOR_ACTIVE_FLAG (0x8d4a), is what tells
 * the two cases apart — clear means "no eagle yet, spawn one", nonzero means "already flying, step
 * it".
 *
 * ROLE IN THE MACHINE
 * The eagle is the enemy of the bonus stage; the rest of the eagle pipeline (its per-frame motion
 * stepper, its approach/aim state machine, its wave teardown) all assume a live, initialised actor
 * record. This routine is the one place that record is stood up: it stamps the eagle's birth values
 * into the actor record handed to it, arms the eagle's animation, and only then lets the per-frame
 * machinery take over. Because the whole thing is a singleton gated on one flag, this same routine
 * is called unconditionally each servicing — it self-selects spawn vs. step.
 *
 * Folded onto the tail of the spawn path is an anti-tamper tripwire: the newborn eagle's setup ends
 * by summing a fixed 82-byte ROM region and flagging a modified image. It rides here so the check
 * runs once per eagle birth rather than every frame.
 *
 * ROM 0x5835.  Grounding: [seen].
 *
 * LIVE-OUT: none of its own — the last statement in each branch is a hand-off. All effect lands in
 * the eagle's actor record (its state, timer and flag fields plus the animation pointer), in the
 * active flag SPECIAL_ACTOR_ACTIVE_FLAG, and — on a checksum mismatch — in the tamper cell raised by
 * the checksum tail.
 */
export function spawnSpecialActorElseStep(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // BIRTH-OR-SERVICE GATE. Read the eagle-active flag SPECIAL_ACTOR_ACTIVE_FLAG (0x8d4a). If it is
  // already set the eagle exists, so there is nothing to spawn — hand straight off to the eagle's
  // per-servicing motion stepper (advanceEagleStageTimersAndLatchMoveElseRearm), which drains the
  // stage timers and stamps the next move onto the record. Everything below is the spawn path,
  // reached only on the first servicing of a wave.
  if (mem8[SPECIAL_ACTOR_ACTIVE_FLAG]) return advanceEagleStageTimersAndLatchMoveElseRearm(m, rec); // already active -> step it

  // CLAIM THE SINGLETON. Set SPECIAL_ACTOR_ACTIVE_FLAG (0x8d4a) so every later servicing takes the
  // step branch above and no second eagle is ever spawned for this wave.
  mem8[SPECIAL_ACTOR_ACTIVE_FLAG] = 0x01;
  // SEED THE NEWBORN RECORD. Stamp the eagle's birth values into fixed offsets of the actor record
  // (rec) passed to it, so the downstream steppers find a fully-initialised actor:
  //   +0x0b <- 0x01   an initial state/counter field of the record.
  mem8[rec + 0x0b] = 0x01;
  //   +0x13 <- 0x03   another initial field, seeded to 3.
  mem8[rec + 0x13] = 0x03;
  //   +0x16 <- 0x01   another initial field, seeded to 1.
  mem8[rec + 0x16] = 0x01;
  //   +0x07 <- 0x02   the record's flag byte. Value 0x02 sets bit1, which is exactly the condition
  //                   ANIM_TABLE_3847 is armed under (its turn-around animation variant) — so this
  //                   write and the setActorAnimation call just below go together.
  mem8[rec + 0x07] = 0x02;
  // ARM THE EAGLE'S ANIMATION. Point the record at animation sequence ANIM_TABLE_3847 (ROM 0x3847,
  // the turn-around variant selected by the bit1 flag set above) and restart it from its first frame,
  // so the eagle begins playing its opening look this servicing.
  setActorAnimation(m, rec, ANIM_TABLE_3847);
  // ANTI-TAMPER TAIL. With the eagle stood up, fold a fixed 82-byte (0x52) ROM region starting at
  // CHECKSUM_ROM_BASE (0x0bb5) into a plain 16-bit additive checksum, accumulator seeded 0/0. A
  // genuine image sums to one specific constant; any other total means a byte was altered and the
  // checksum raises the tamper cell, which the freeze/tally logic elsewhere reads to wedge a
  // modified board. This is the routine's final act.
  return verifyTableChecksum(m, CHECKSUM_ROM_BASE, 0x52, 0x00, 0x00);
}
