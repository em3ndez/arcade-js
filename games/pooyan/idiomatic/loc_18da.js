// SPDX-License-Identifier: GPL-3.0-only
import { bcdAddByte } from "../../../core/bcd.js";
import { renderPhaseGauge } from "./renderPhaseGauge.js";
import { loc_0f0d } from "./loc_0f0d.js";
import { AWARD_QUEUE, BONUS_AWARD_DSW, ACTIVE_PLAYER, GAUGE_PHASE_COUNTER, P1_SCORE_BCD, P2_SCORE_BCD } from "./names.js";
/**
 * loc_18da — pending bonus-award tally step. An empty award queue reloads the slot from the
 * schedule (5 or 3 per BONUS_AWARD_DSW) and returns. Otherwise it gates on the active player's
 * score MSB reaching the queued threshold; when it does it bumps the saturating gauge counter,
 * BCD-adds the schedule step (8 or 7) to set the queue's next threshold, redraws the HUD gauge,
 * and appends the tally sound command.
 * LIVE-OUT: A — set on every return path to match the frozen reference (reload value on the empty path,
 * the score MSB on the not-yet-reached path, the sound appender's cursor on the full path);
 * consumption is unconfirmed, so it is set everywhere (a matching set can never false-fail).
 */

const QUEUE_RELOAD_HI = 0x05; // reload when BONUS_AWARD_DSW == 0
const QUEUE_RELOAD_LO = 0x03; // reload otherwise
const STEP_HI = 0x08; //        BCD step when BONUS_AWARD_DSW == 0
const STEP_LO = 0x07; //        BCD step otherwise
const GAUGE_MAX = 0xff; //      gauge saturates here
const SCORE_MSB = 0x02; //      MSB offset within a 3-byte BCD score buffer

export function loc_18da(m) {
  const { mem8 } = m;

  const queued = mem8[AWARD_QUEUE];
  if (queued === 0) {
    const reload = mem8[BONUS_AWARD_DSW] === 0 ? QUEUE_RELOAD_HI : QUEUE_RELOAD_LO;
    mem8[AWARD_QUEUE] = reload;
    return (m.regs.a = reload);
  }

  const scoreMsb = mem8[ACTIVE_PLAYER] !== 0 ? mem8[P2_SCORE_BCD + SCORE_MSB] : mem8[P1_SCORE_BCD + SCORE_MSB];
  if (scoreMsb !== queued) return (m.regs.a = scoreMsb); // threshold not yet reached

  const gauge = mem8[GAUGE_PHASE_COUNTER];
  if (gauge !== GAUGE_MAX) mem8[GAUGE_PHASE_COUNTER] = gauge + 1; // saturating bump

  const step = mem8[BONUS_AWARD_DSW] === 0 ? STEP_HI : STEP_LO;
  mem8[AWARD_QUEUE] = bcdAddByte(step, queued).value; // next BCD threshold

  renderPhaseGauge(m);
  return loc_0f0d(m); // tail: append the tally sound command; A is its result
}
