// SPDX-License-Identifier: GPL-3.0-only
import {
  STAGE_COUNTDOWN,
  LEAD_ACTOR_STATE,
  ENEMY_ACTOR_TABLE,
  PLAY_STATE_INDEX,
  ROUND_COUNTER,
  DIFFICULTY_DSW,
  WAVE_ARRIVAL_COUNTER,
  SPEED_INDEX,
  PLAYER_AIM_FLAGS,
  loc_8905,
  loc_8906,
} from "./names.js";
/**
 * pickEnemyGroupSpeedAndClearAim — pick the enemy speed index for the next wave of attackers, when the field is clear.
 * ROM 0x191c-0x196d.  Grounding: [seen].
 *
 * This is the gate-and-choose that decides how fast the next group of enemies will move. It only
 * fires at a genuine lull between waves: the stage countdown (STAGE_COUNTDOWN, 0x8901) must be
 * idle AND the lead actor's state (LEAD_ACTOR_STATE, 0x8a82) must be idle, and — even then — it
 * bails if ANY of the six enemy records is still in the "busy" phase (state byte == 0x03). That
 * three-part guard is what makes this a per-wave decision rather than a per-frame one: it can
 * only commit once the previous wave has fully cleared the screen.
 *
 * When the field is clear it advances the play sub-state (PLAY_STATE_INDEX, 0x880a) to move the
 * wave sequencer forward, then computes the speed value. The value is built from the difficulty
 * base (DIFFICULTY_DSW, 0x8820 — the operator dip-switch reading) plus a round-derived term, and
 * the mix depends on bit 0 of the round counter (ROUND_COUNTER, 0x8907):
 *   - round bit0 SET  (odd rounds):  base + round
 *   - round bit0 CLEAR (even rounds): base + (round >> 1) + WAVE_ARRIVAL_COUNTER (0x8903)
 * so difficulty ramps with the round, and on even rounds it also folds in how many waves have
 * already arrived, making later waves within a round progressively faster.
 *
 * The result is clamped: any value reaching the ceiling (SPEED_CEILING, 0x20) is pinned to
 * SPEED_MAX (0x1f), which keeps it inside the range SPEED_INDEX (0x8900) is allowed to hold —
 * downstream the speed magnitude table is read from the low bits of that index. Finally it
 * commits the value and resets the aim state for the fresh wave: PLAYER_AIM_FLAGS (0x8a87) and
 * the two adjacent scratch cells 0x8905/0x8906 are cleared to 0.
 *
 * A pure leaf: it calls nothing.
 *
 * LIVE-OUT: memory only — PLAY_STATE_INDEX incremented, SPEED_INDEX set to the clamped value,
 * and PLAYER_AIM_FLAGS plus 0x8905/0x8906 cleared. No caller reads a register back.
 */

const SLOT_STATE_BUSY = 0x03;
const RECORD_STRIDE = 0x18;
const SCAN_SLOTS = 6;
const SPEED_CEILING = 0x20; // a value at or above this clamps down
const SPEED_MAX = 0x1f;

export function pickEnemyGroupSpeedAndClearAim(m) {
  const { mem8 } = m;

  // Gate 1 & 2: only choose a new wave speed during a real lull. STAGE_COUNTDOWN (0x8901) still
  // running, or the lead actor (LEAD_ACTOR_STATE, 0x8a82) still mid-action, means the previous
  // wave is not settled — leave without touching anything.
  if (mem8[STAGE_COUNTDOWN] !== 0) return;
  if (mem8[LEAD_ACTOR_STATE] !== 0) return;

  // Gate 3: scan the six enemy records (ENEMY_ACTOR_TABLE, 0x8ae0, stride 0x18) at their state
  // byte (+0x02). If any is still in the busy phase (0x03) the previous wave hasn't cleared the
  // screen, so abort — the field must be empty before a new speed is chosen.
  for (let i = 0; i < SCAN_SLOTS; i++) {
    if (mem8[ENEMY_ACTOR_TABLE + 0x02 + i * RECORD_STRIDE] === SLOT_STATE_BUSY) return;
  }

  // Field is clear: advance the wave sequencer's sub-state (PLAY_STATE_INDEX, 0x880a).
  mem8[PLAY_STATE_INDEX] = mem8[PLAY_STATE_INDEX] + 1;

  // Build the raw speed value from the difficulty base plus a round-derived term. The base is
  // the operator difficulty dip-switch (DIFFICULTY_DSW, 0x8820); the round term depends on
  // ROUND_COUNTER (0x8907) bit0. Odd rounds add the whole round; even rounds add half the round
  // plus how many waves have already arrived (WAVE_ARRIVAL_COUNTER, 0x8903), so speed escalates
  // both across rounds and across waves within an even round. Each add is kept 8-bit.
  const round = mem8[ROUND_COUNTER];
  const base = mem8[DIFFICULTY_DSW];
  let value;
  if (round & 0x01) {
    value = (base + round) & 0xff;
  } else {
    value = (base + (round >> 1) + mem8[WAVE_ARRIVAL_COUNTER]) & 0xff;
  }

  // Clamp into range: anything at or above the ceiling (0x20) pins to the maximum index 0x1f,
  // keeping the value valid for the downstream speed-magnitude table lookup off SPEED_INDEX.
  if (value >= SPEED_CEILING) value = SPEED_MAX;

  // Commit the chosen speed and reset the aim state for the incoming wave. SPEED_INDEX (0x8900)
  // takes the value; PLAYER_AIM_FLAGS (0x8a87) and its two neighbouring scratch cells
  // 0x8905/0x8906 are cleared so aim/target state starts fresh.
  mem8[SPEED_INDEX] = value;
  mem8[PLAYER_AIM_FLAGS] = 0;
  mem8[loc_8905] = 0;
  mem8[loc_8906] = 0;
}
