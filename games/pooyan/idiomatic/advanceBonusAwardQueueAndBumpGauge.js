// SPDX-License-Identifier: GPL-3.0-only
import { bcdAddByte } from "../../../core/bcd.js";
import { renderPhaseGauge } from "./renderPhaseGauge.js";
import { queueSoundCommand0B } from "./queueSoundCommand0B.js";
import { AWARD_QUEUE, BONUS_AWARD_DSW, ACTIVE_PLAYER, GAUGE_PHASE_COUNTER, P1_SCORE_BCD, P2_SCORE_BCD } from "./names.js";
/**
 * advanceBonusAwardQueueAndBumpGauge -- the bonus / extra-life award tally step.
 *
 * WHAT IT IS
 *   One call in the bonus-award subsystem, occupying ROM 0x18da-0x191b. The machine hands out a
 *   periodic reward as the active player's score climbs past a moving milestone. That milestone
 *   lives as a single BCD byte in the award queue cell AWARD_QUEUE (0x8909). This routine is the
 *   per-step engine for that mechanism: it keeps the queue seeded, checks whether the player's
 *   score has caught up to the current milestone, and -- only when it has -- pays out the reward
 *   and moves the milestone forward.
 *
 * ROLE IN THE MACHINE
 *   The entire award schedule is a boot-time difficulty choice. DSW1 bit 3 is decoded once at boot
 *   into the config cell BONUS_AWARD_DSW (0x8800); this routine reads that cell to pick between two
 *   schedules. When the cell is 0 it uses the more generous schedule (empty-queue reload = 5, BCD
 *   milestone step = 8); otherwise it uses the tighter one (reload = 3, step = 7). A smaller step
 *   means milestones sit closer together, so the operator's DIP setting directly controls how often
 *   the bonus is earned.
 *
 * ROM ADDRESS: 0x18da-0x191b.
 * GROUNDING: [seen].
 *
 * LIVE-OUT: register A. Every return path leaves A holding the value that path computed -- the
 *   reload value on the empty-queue path, the score MSB on the not-yet-reached path, and the
 *   tally-sound result on the full award path. Downstream consumption of A is unconfirmed, so A is
 *   set on every exit; a value that always matches can never disagree.
 */

const QUEUE_RELOAD_HI = 0x05; // reload when BONUS_AWARD_DSW == 0
const QUEUE_RELOAD_LO = 0x03; // reload otherwise
const STEP_HI = 0x08; //        BCD step when BONUS_AWARD_DSW == 0
const STEP_LO = 0x07; //        BCD step otherwise
const GAUGE_MAX = 0xff; //      gauge saturates here
const SCORE_MSB = 0x02; //      MSB offset within a 3-byte BCD score buffer

export function advanceBonusAwardQueueAndBumpGauge(m) {
  const { mem8 } = m;

  // STEP 1 -- read the pending milestone. AWARD_QUEUE (0x8909) holds the next score milestone as a
  // single BCD byte. A value of 0 means the slot is empty: nothing to gate against, so it must be
  // reseeded before the mechanism can do any work.
  const queued = mem8[AWARD_QUEUE];
  if (queued === 0) {
    // Empty queue -> reseed from the boot-selected schedule. BONUS_AWARD_DSW (0x8800) chooses the
    // generous reload (5) when 0, else the tighter reload (3). Store it back into the queue slot
    // and hand the same reload value out in A. No milestone check happens on this path -- reseeding
    // is all this frame does.
    const reload = mem8[BONUS_AWARD_DSW] === 0 ? QUEUE_RELOAD_HI : QUEUE_RELOAD_LO;
    mem8[AWARD_QUEUE] = reload;
    return (m.regs.a = reload);
  }

  // STEP 2 -- fetch the gate value: the active player's score high byte. ACTIVE_PLAYER (0x880d)
  // bit 0 selects whose 3-byte BCD score buffer to read -- player 2's (base 0x88a5) when nonzero,
  // otherwise player 1's (base 0x88a2). The milestone is compared against that buffer's most
  // significant byte at offset +2 (0x88a4 / 0x88a7). If the score MSB has not yet reached the
  // queued milestone, there is no award this frame: leave A holding the MSB and stop.
  const scoreMsb = mem8[ACTIVE_PLAYER] !== 0 ? mem8[P2_SCORE_BCD + SCORE_MSB] : mem8[P1_SCORE_BCD + SCORE_MSB];
  if (scoreMsb !== queued) return (m.regs.a = scoreMsb); // threshold not yet reached

  // STEP 3 -- milestone reached: pay the reward into the gauge. GAUGE_PHASE_COUNTER (0x8908) is the
  // counter drawn as the vertical HUD phase gauge; bump it by one but clamp at 0xff so the byte
  // never wraps back around to 0.
  const gauge = mem8[GAUGE_PHASE_COUNTER];
  if (gauge !== GAUGE_MAX) mem8[GAUGE_PHASE_COUNTER] = gauge + 1; // saturating bump

  // STEP 4 -- advance the milestone for next time. Add the schedule step (8 on the generous
  // schedule, 7 on the tight one, again keyed off BONUS_AWARD_DSW at 0x8800) to the current queued
  // value using BCD arithmetic, and store the sum back into AWARD_QUEUE (0x8909) as the next
  // milestone the score must reach.
  const step = mem8[BONUS_AWARD_DSW] === 0 ? STEP_HI : STEP_LO;
  mem8[AWARD_QUEUE] = bcdAddByte(step, queued).value; // next BCD threshold

  // STEP 5 -- reflect the award on screen and in sound. renderPhaseGauge (0x03c2) repaints the
  // vertical HUD gauge from the counter just bumped. queueSoundCommand0B (0x0f0d) then appends the
  // tally sound command byte 0x0b into the page-0x8a sound command ring; its return value is the
  // last thing left in A on this path.
  renderPhaseGauge(m);
  return queueSoundCommand0B(m); // tail: append the tally sound command; A is its result
}
