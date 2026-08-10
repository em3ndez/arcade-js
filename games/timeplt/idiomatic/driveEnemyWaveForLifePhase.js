// SPDX-License-Identifier: GPL-3.0-only
/** driveEnemyWaveForLifePhase — while the wave-hold cell is clear, drive the enemy-wave work for the current life
 * phase. Era four and the three low phases each hand off to a dedicated spawner; phase nine and up,
 * with the low tick spent, spawn a fresh wave inline across the craft band from a heading-biased
 * shape run, then request a sound once enough slots ended up filled. LIVE-OUT: memory. */

import { u8, u16 } from "../../../core/int.js";
import { drawRandomByte } from "./drawRandomByte.js";
import { offsetAddress } from "./offsetAddress.js";
import { fetchTableByte } from "./fetchTableByte.js";
import { pickScriptAtRandomOrInTurn } from "./pickScriptAtRandomOrInTurn.js";
import { stepShapeAnimation } from "./stepShapeAnimation.js";
import { spawnEnemyWaveIntoFreeSlots } from "./spawnEnemyWaveIntoFreeSlots.js";
import { stopFiveSlotAnimations } from "./stopFiveSlotAnimations.js";
import { gateTheFreeSlotSearchAndPickItsRun } from "./gateTheFreeSlotSearchAndPickItsRun.js";
import { loc_379f } from "./loc_379f.js";
import { loc_5817 } from "./loc_5817.js";
import { ROUND_CRAFT_COUNT, ROUND_TRANSITION_HOLD, WAVE_CLAIM_TIMER, WAVE_DESCRIPTOR_INDEX, WAVE_KILL_COUNTDOWN } from "./names.js";

const ERA_INDEX = 0xad04;
const LIFE_PHASE = 0xad06;
const LIFE_TICKS_LOW = 0xad05;
const KILLS_REMAINING = 0xad02;
const PLAYER_HEADING = 0xa802;
const WAVE_MARK = 0xacc2;

const CRAFT_BAND = 0xa850;
const ENTRY_BAND = 0xaa1a;
const BIAS_TABLE = 0x38d9;
const DESCRIPTOR_TABLE = 0x397b;
const SHAPE_TABLE = 0x38e9;

const BOSS_ERA = 4;
const DEFAULT_COUNT = 5;
const RECORD_STRIDE = 16;
const PRIMED_TIMER = 0x20;
const AIM_OFFSET = 0x80;
const READY_STATUS = 0xe4;

export function driveEnemyWaveForLifePhase(m) {
  const { regs, mem8 } = m;
  if (mem8[ROUND_TRANSITION_HOLD] !== 0) return;
  if (mem8[ERA_INDEX] === BOSS_ERA) return spawnEnemyWaveIntoFreeSlots(m);

  regs.hl = LIFE_TICKS_LOW; // the phase tails all read the byte here
  const phase = mem8[LIFE_PHASE] & 0x0f;
  if (phase === 7) return stopFiveSlotAnimations(m);
  if (phase < 7) return gateTheFreeSlotSearchAndPickItsRun(m);
  if (phase < 9) return loc_379f(m);
  if (mem8[LIFE_TICKS_LOW] !== 0) return;

  const parityBit = drawRandomByte(m) & 1;
  mem8[WAVE_MARK] = 0xff;
  mem8[WAVE_DESCRIPTOR_INDEX] = u8(2 * mem8[ERA_INDEX] + parityBit);

  const headingIndex = u8(mem8[PLAYER_HEADING] + 8) >> 4;
  regs.hl = BIAS_TABLE;
  regs.a = headingIndex;
  const bias = mem8[offsetAddress(m)];

  regs.a = u8(16 * mem8[WAVE_DESCRIPTOR_INDEX]);
  regs.hl = DESCRIPTOR_TABLE;
  let descriptor = offsetAddress(m); // two-byte entries, one consumed per filled slot

  const count = mem8[KILLS_REMAINING] !== 0 ? mem8[ROUND_CRAFT_COUNT] : DEFAULT_COUNT;
  mem8[WAVE_KILL_COUNTDOWN] = 0;
  let record = CRAFT_BAND;
  let entry = ENTRY_BAND;

  let remaining = count;
  do {
    if (mem8[record] === 0) {
      regs.a = u8(2 * (mem8[descriptor] + bias));
      regs.hl = SHAPE_TABLE;
      mem8[entry + 0x31] = fetchTableByte(m);
      mem8[entry] = mem8[regs.hl + 1];

      const aimed = u8(mem8[PLAYER_HEADING] + AIM_OFFSET);
      mem8[record + 0x01] = aimed;
      mem8[record + 0x02] = aimed;

      mem8[record + 0x0a] = u8(pickScriptAtRandomOrInTurn(m) + 9);
      mem8[record + 0x0e] = mem8[descriptor + 1];
      descriptor = u16(descriptor + 2);

      mem8[record + 0x03] = 0;
      mem8[record + 0x05] = 0;
      mem8[record + 0x09] = PRIMED_TIMER;
      stepShapeAnimation(m, record);

      mem8[record] = mem8[record + 0x0e] === 0 ? 0xff : 0xfe; // live, and settled when its tail is clear
      mem8[WAVE_KILL_COUNTDOWN] = u8(mem8[WAVE_KILL_COUNTDOWN] + 1);
    }
    record = u16(record + RECORD_STRIDE);
    entry = u16(entry + 2);
    remaining = u8(remaining - 1);
  } while (remaining !== 0);

  mem8[WAVE_MARK] = 0;
  mem8[WAVE_CLAIM_TIMER] = READY_STATUS;
  const filled = mem8[WAVE_KILL_COUNTDOWN];
  if (filled >= DEFAULT_COUNT) return loc_5817(m);
  const owed = mem8[ROUND_CRAFT_COUNT];
  mem8[WAVE_KILL_COUNTDOWN] = owed;
  if (filled >= owed) return loc_5817(m);
}
