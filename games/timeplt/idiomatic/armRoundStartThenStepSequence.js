// SPDX-License-Identifier: GPL-3.0-only
/** armRoundStartThenStepSequence — a round-start sequence arm. Seats a pair of player-object records to their
 * defaults, requests a sound and loads the difficulty record in force, then splits on
 * PLAY_ACTIVE: mid-game it queues a command and folds a program-image checksum into the
 * sound latch; on a fresh round it cycles the stage counter, reseeds the random register,
 * clears two RAM banks and paints the star field. Both arms tail-advance the sequence
 * sub-step. LIVE-OUT: memory (registers and the dead stack scratch aside). */

import { requestRoundStartSound } from "./requestRoundStartSound.js";
import { postCommand } from "./postCommand.js";
import { loadDifficultyRecord } from "./loadDifficultyRecord.js";
import { seedRandomRegister } from "./seedRandomRegister.js";
import { advanceSequenceSubStep } from "./advanceSequenceSubStep.js";
import { u8 } from "../../../core/int.js";
import { ACTIVE_PLAYER, ATTRACT_STAGE_COUNTER, BCD_FRAME_COUNTER, DIFFICULTY_SETTING, ENEMY_AIM_ANCHOR_Y, ENEMY_AIM_POINT_TABLE, ENEMY_STANDOFF_AIM_BLOCK_END, ENEMY_STANDOFF_AIM_SET_Y, FRAME_TICK, KILL_QUOTA, PEN_COLOUR, PLAYER1_SCORE_LO, PLAYER1_SCORE_MID, PLAYER2_SCORE_LO, PLAYER2_SCORE_MID, PLAYER_ONE_BONUS_LIFE_LATCH, PLAYER_ONE_ERA_INDEX, PLAYER_ONE_KILLS_REMAINING, PLAYER_ONE_LIFE_TICKS_MID, PLAYER_ONE_MOTHER_SHIP_ARMED, PLAYER_ONE_ROUND_ARMED, PLAYER_ONE_ROUND_NUMBER, PLAYER_ONE_START_RUNG, PLAYER_SHOT_ARRAY, PLAYER_STATE, PLAYER_TWO_BONUS_LIFE_LATCH, PLAYER_TWO_ERA_INDEX, PLAYER_TWO_KILLS_REMAINING, PLAYER_TWO_LIFE_TICKS_MID, PLAYER_TWO_MOTHER_SHIP_ARMED, PLAYER_TWO_ROUND_ARMED, PLAYER_TWO_ROUND_NUMBER, PLAYER_TWO_START_RUNG, PLAY_ACTIVE, SCRIPT_CYCLE_COUNTER, SEQUENCE_DELAY, SEQUENCE_PHASE, START_RUNG_ROUNDS_1_5, DISPLAY_LATCH_CHECKSUM_BASE, SEQUENCE_PHASE_CHECKSUM_BASE, PLAYER_STATE_BLOCK_END, PLAYER_SHOT_ARRAY_END, VIDEO_ENABLE_LATCH } from "./names.js";

const ZERO_CELLS = [PLAYER_ONE_ERA_INDEX, PLAYER_TWO_ERA_INDEX, ACTIVE_PLAYER, PLAYER_ONE_BONUS_LIFE_LATCH, PLAYER_TWO_BONUS_LIFE_LATCH, PLAYER_ONE_MOTHER_SHIP_ARMED, PLAYER_TWO_MOTHER_SHIP_ARMED, PEN_COLOUR];
const ONE_CELLS = [PLAYER_ONE_ROUND_NUMBER, PLAYER_TWO_ROUND_NUMBER, PLAYER_ONE_ROUND_ARMED, PLAYER_TWO_ROUND_ARMED];

export function armRoundStartThenStepSequence(m) {
  const { mem8, mem16, regs } = m;

  requestRoundStartSound(m);

  mem8[ENEMY_AIM_ANCHOR_Y] = 0x78;
  mem8[ENEMY_AIM_POINT_TABLE] = 0x84;
  mem16[PLAYER_ONE_LIFE_TICKS_MID] = 0x0000;
  mem16[PLAYER_TWO_LIFE_TICKS_MID] = 0x0000;

  const shared = mem8[KILL_QUOTA];
  mem8[PLAYER_ONE_KILLS_REMAINING] = shared;
  mem8[PLAYER_TWO_KILLS_REMAINING] = shared;

  for (const cell of ZERO_CELLS) mem8[cell] = 0x00;
  for (const cell of ONE_CELLS) mem8[cell] = 0x01;

  if (mem8[PLAY_ACTIVE] !== 0) {
    mem8[PLAYER1_SCORE_LO] = 0x00;
    mem16[PLAYER1_SCORE_MID] = 0x0000;
    mem8[PLAYER2_SCORE_LO] = 0x00;
    mem16[PLAYER2_SCORE_MID] = 0x0000;

    regs.de = 0x0400;
    postCommand(m);

    regs.a = mem8[DIFFICULTY_SETTING];
    loadDifficultyRecord(m);

    let a = 0;
    for (let hl = DISPLAY_LATCH_CHECKSUM_BASE, i = 0; i < 256; i++, hl++) a ^= mem8[hl];
    mem8[VIDEO_ENABLE_LATCH] = u8(a + 1);

    const r = mem8[START_RUNG_ROUNDS_1_5];
    mem8[PLAYER_ONE_START_RUNG] = r;
    mem8[PLAYER_TWO_START_RUNG] = r;
    mem8[SEQUENCE_DELAY] = 0x96;
    return advanceSequenceSubStep(m);
  }

  let stage = u8(mem8[ATTRACT_STAGE_COUNTER] + 1);
  if (stage >= 0x04) stage = 0x01;
  mem8[ATTRACT_STAGE_COUNTER] = stage;
  mem8[PLAYER_ONE_ERA_INDEX] = stage;
  mem8[PLAYER_ONE_ROUND_NUMBER] = u8(stage + 1);

  mem8[FRAME_TICK] = 0x00;
  mem8[BCD_FRAME_COUNTER] = 0x00;
  mem8[SCRIPT_CYCLE_COUNTER] = 0x00;
  seedRandomRegister(m);

  for (let cell = PLAYER_SHOT_ARRAY; cell <= PLAYER_SHOT_ARRAY_END; cell++) mem8[cell] = 0x00;
  for (let cell = PLAYER_STATE; cell <= PLAYER_STATE_BLOCK_END; cell++) mem8[cell] = 0x00;

  regs.a = 0x02;
  loadDifficultyRecord(m);

  const r = mem8[START_RUNG_ROUNDS_1_5];
  mem8[PLAYER_ONE_START_RUNG] = r;
  mem8[PLAYER_TWO_START_RUNG] = r;

  let sum = mem8[SEQUENCE_PHASE];
  for (let hl = SEQUENCE_PHASE_CHECKSUM_BASE, i = 0; i < 256; i++, hl++) sum = u8(sum - mem8[hl]);
  mem8[SEQUENCE_PHASE] = sum ^ 0x90;

  for (let cell = ENEMY_STANDOFF_AIM_SET_Y; cell <= ENEMY_STANDOFF_AIM_BLOCK_END; cell++) mem8[cell] = 0x80;
  mem8[SEQUENCE_DELAY] = 0x5a;
  return advanceSequenceSubStep(m);
}
