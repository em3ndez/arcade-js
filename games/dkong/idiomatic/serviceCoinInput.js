// SPDX-License-Identifier: GPL-3.0-only
/**
 * serviceCoinInput — debounce the coin line, tally pulses, and award BCD credits once per vblank.
 * COIN_EDGE is a one-bit edge latch armed while the line is clear, so a held coin counts once.
 *
 * LIVE-OUT: memory-only — COIN_EDGE, COINS_PARTIAL, CREDITS, the coin-chime trigger, task ring.
 */

import { silenceSound } from "./silenceSound.js";
import { enqueueTask } from "./enqueueTask.js";
import {
  COIN_EDGE,
  COINS_PARTIAL,
  CREDITS,
  GAME_STATE,
  DIP_COINS_PER_CREDIT,
  DIP_CREDITS_PER_COIN,
  SND_TRIGGER,
} from "./names.js";

const IN2_PORT = 0x7d00; // reading it also re-kicks the watchdog
const COIN1_BIT = 0x80;
const GAME_RUNNING = 0x03;
const COIN_CHIME = SND_TRIGGER + 3;
const SND_ASSERT_FRAMES = 0x03; // a trigger value = frames to assert
const CREDIT_CAP = 0x90;
const CREDIT_TASK = 0x0400;

/** 8-bit BCD addition (Z80 DAA in its addition form). Score-critical path. */
function bcdAdd(a, b) {
  const sum = a + b;
  const lo = sum & 0xff;
  const halfCarry = ((a ^ b ^ lo) & 0x10) !== 0;
  const carry = sum > 0xff;
  let correction = 0;
  if (halfCarry || (lo & 0x0f) > 9) correction |= 0x06;
  if (carry || lo > 0x99) correction |= 0x60;
  return (lo + correction) & 0xff;
}

export function serviceCoinInput(m) {
  const { regs, mem, mem8 } = m;

  const coinPresent = (mem.read8(IN2_PORT) & COIN1_BIT) !== 0;

  if (!coinPresent) {
    mem8[COIN_EDGE] = 0x01;
    return;
  }

  if (mem8[COIN_EDGE] === 0) return;

  if (mem8[GAME_STATE] !== GAME_RUNNING) {
    silenceSound(m);
    mem8[COIN_CHIME] = SND_ASSERT_FRAMES;
  }

  mem8[COIN_EDGE] = 0x00;
  const partial = (mem8[COINS_PARTIAL] + 1) & 0xff;
  mem8[COINS_PARTIAL] = partial;

  if (mem8[DIP_COINS_PER_CREDIT] !== partial) return;

  mem8[COINS_PARTIAL] = 0x00;

  const credits = mem8[CREDITS];
  if (credits >= CREDIT_CAP) return;

  mem8[CREDITS] = bcdAdd(credits, mem8[DIP_CREDITS_PER_COIN]);

  regs.de = CREDIT_TASK;
  enqueueTask(m);
}
