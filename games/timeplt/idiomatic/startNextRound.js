// SPDX-License-Identifier: GPL-3.0-only
/** startNextRound — step the round counter, roll the era forward (wrapping after the fifth), and reload
 * the starting rung from one of three cells bracketed by how far into the run the round counter has got.
 * The kill quota is refilled from a non-era-keyed cell, so it is the same every round. Two flags are
 * cleared and a third set to all-ones, which leaves the round armed rather than merely counted.
 * LIVE-OUT: memory only. */

import { ERA_INDEX, KILLS_REMAINING, KILL_QUOTA, MOTHER_SHIP_ARMED, ROUND_NUMBER, ROUND_TRANSITION_HOLD, START_RUNG_ROUNDS_11_UP, START_RUNG_ROUNDS_1_5, START_RUNG_ROUNDS_6_10 } from "./names.js";
import { u8 } from "../../../core/int.js";

const ERAS = 5;

const SECOND_BRACKET_FROM = 6;
const THIRD_BRACKET_FROM = 11;
const START_RUNG = 0xad0a;

const ARMED_FLAG = 0xad0e;
const ARMED = 0xff;

export function startNextRound(m) {
  const { mem8 } = m;

  mem8[ROUND_NUMBER] = mem8[ROUND_NUMBER] + 1;

  const nextEra = u8(mem8[ERA_INDEX] + 1);
  mem8[ERA_INDEX] = nextEra < ERAS ? nextEra : 0;

  const round = mem8[ROUND_NUMBER];
  let bracket = START_RUNG_ROUNDS_11_UP;
  if (round < SECOND_BRACKET_FROM) bracket = START_RUNG_ROUNDS_1_5;
  else if (round < THIRD_BRACKET_FROM) bracket = START_RUNG_ROUNDS_6_10;
  mem8[START_RUNG] = mem8[bracket];

  mem8[KILLS_REMAINING] = mem8[KILL_QUOTA];
  mem8[MOTHER_SHIP_ARMED] = 0;
  mem8[ROUND_TRANSITION_HOLD] = 0;
  mem8[ARMED_FLAG] = ARMED;
}
