// SPDX-License-Identifier: GPL-3.0-only
/** startNextRound — start the next round. The round counter is stepped on, the era it selects rolls
 * forward and wraps back to the first after the fifth, and the rung a round starts on is reloaded
 * from one of three cells chosen by how far into the run the round counter has got — the first
 * bracket covers the opening rounds, the second the middle ones, the third everything after. The kill
 * quota is refilled from a cell that is not era-keyed, so it is the same in every round. Two
 * flags are cleared and a third is set to all-ones, which is what leaves the round armed rather
 * than merely counted. LIVE-OUT: memory only. */

import { ERA_INDEX, KILLS_REMAINING, KILL_QUOTA, ROUND_NUMBER, START_RUNG_ROUNDS_1_5, START_RUNG_ROUNDS_6_10, START_RUNG_ROUNDS_11_UP, MOTHER_SHIP_ARMED } from "./names.js";
import { u8 } from "../../../core/int.js";

const ERAS = 5;

const SECOND_BRACKET_FROM = 6;
const THIRD_BRACKET_FROM = 11;
const START_RUNG = 0xad0a;

const ROUND_OVER_FLAG = 0xacc6;
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
  mem8[ROUND_OVER_FLAG] = 0;
  mem8[ARMED_FLAG] = ARMED;
}
