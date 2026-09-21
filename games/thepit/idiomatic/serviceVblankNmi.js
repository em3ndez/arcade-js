// SPDX-License-Identifier: GPL-3.0-only
/**
 * serviceVblankNmi — the per-frame vblank interrupt service: acknowledge, guard the credit
 * count, fire a queued sound, blit sprites, tick timers, debounce inputs, and bank coins.
 * Its first act drops the interrupt-enable line so a following vblank cannot re-enter mid-service;
 * the normal path re-raises it before returning. A watchdog cold-resets the machine if the credit
 * count's three redundant copies disagree or it runs past its cap.
 */

import {
  COINS_PER_CREDIT_A,
  COINS_PER_CREDIT_B,
  COIN_START_PORT,
  COIN_SW_ACCUM,
  CREDIT_COUNT,
  CREDIT_MIRROR_A,
  CREDIT_MIRROR_B,
  FRAME_COUNTER_PRESCALER,
  FRAME_WAIT_COUNTDOWN,
  GAME_STATE,
  IN0_DEBOUNCED,
  IN0_PREV,
  IN1_DEBOUNCED,
  IN1_PREV,
  JOYSTICK_INPUT_PORT,
  NMI_MASK_LATCH,
  PLAY_PHASE_COUNTER,
  SECONDS_PRESCALER,
  SOUND_CMD_LATCH,
  SOUND_HEAD,
  SOUND_RING,
  SOUND_TAIL,
  SPRITE_RAM_BASE,
  SPRITE_STAGING_BASE,
  START1_SW_ACCUM,
  START2_SW_ACCUM,
  VARIANT,
  loc_800f,
  loc_801d,
  loc_812d,
} from "./names.js";
import { coldBootInit } from "./coldBootInit.js";
import { showCreditScreen } from "./showCreditScreen.js";
import { startGame } from "./startGame.js";
import { enableSound } from "./enableSound.js";
import { requestSound3 } from "./requestSound3.js";

const CREDIT_CAP = 10; // one past the highest bankable credit (banking clamps to 9)

export function serviceVblankNmi(m) {
  const { mem8 } = m;

  mem8[NMI_MASK_LATCH] = 0;

  // Credit watchdog: the count lives in three redundant copies. A disagreement or an
  // overflow means the counter was corrupted, so cold-reset the machine. This handler runs at
  // the engine's top level (outside gen.next()), so hand off via nextMain like the coin/start
  // restarts below — NOT restartMain (its RESTART throw would escape the inner catch). coldBootInit
  // re-seats everything, so abandoning the rest of the handler here is faithful to the original jump.
  const credit = mem8[CREDIT_COUNT];
  if (credit >= CREDIT_CAP || mem8[CREDIT_MIRROR_A] !== credit || mem8[CREDIT_MIRROR_B] !== credit) {
    m.nextMain = () => coldBootInit(m); // warm restart: the engine swaps in the cold-boot loop
    return true;
  }

  fireQueuedSound(m);
  blitSpriteBuffer(m);
  tickFrameTimers(m);
  debounceInputs(m);

  // Coin/credit accounting. When it banks a start it hands the frame off to the
  // credit/start flow, which owns the exit — this handler must not re-arm on top of it.
  if (bankCoinInput(m)) return;

  // Normal per-frame exit: re-arm the interrupt for the next vblank and return to the
  // interrupted code. The `ret` pops the PC the NMI pushed on entry — load-bearing when the
  // whole game runs idiomatic and this handler is dispatched by the live vblank rather than a
  // translated caller that would balance the stack itself.
  mem8[NMI_MASK_LATCH] = 1;
  return m.ret();
}

/**
 * Dequeue at most one pending command from the sound ring and fire it to the audio
 * latch. The ring is empty when its read index has caught up to the enqueue head.
 * A slot only fires when it carries the pending marker in its high bit.
 */
function fireQueuedSound(m) {
  const { mem8 } = m;

  const readIndex = mem8[SOUND_TAIL];
  if (mem8[SOUND_HEAD] === readIndex) return;

  mem8[SOUND_TAIL] = (readIndex + 1) & 7; // advance the read index (8-slot ring)
  const command = mem8[SOUND_RING + readIndex];
  mem8[SOUND_RING + readIndex] = 0; // consume the slot
  if (command & 0x80) mem8[SOUND_CMD_LATCH] = command;
}

/** Copy the 32-byte (8 sprites x 4) staging buffer into hardware sprite RAM each frame. */
function blitSpriteBuffer(m) {
  const { mem8 } = m;
  for (let i = 0; i < 32; i++) {
    mem8[SPRITE_RAM_BASE + i] = mem8[SPRITE_STAGING_BASE + i];
  }
}

/** Tick the frame timers: a per-frame countdown plus two ~one-second (60-frame) dividers. */
function tickFrameTimers(m) {
  const { mem8 } = m;

  // The busy-wait countdown the frame pacer polls: one tick per frame.
  mem8[FRAME_WAIT_COUNTDOWN] = mem8[FRAME_WAIT_COUNTDOWN] - 1;

  // A 60-frame divider: on each rollover it borrows from the counter beneath it and reloads.
  const downDivider = mem8[SECONDS_PRESCALER] - 1;
  mem8[SECONDS_PRESCALER] = downDivider;
  if (downDivider === 0) {
    mem8[loc_800f] = mem8[loc_800f] - 1;
    mem8[SECONDS_PRESCALER] = 60;
  }

  // A second 60-frame divider that counts PLAY_PHASE_COUNTER up on each rollover.
  const upDivider = mem8[FRAME_COUNTER_PRESCALER] - 1;
  mem8[FRAME_COUNTER_PRESCALER] = upDivider;
  if (upDivider === 0) {
    mem8[PLAY_PHASE_COUNTER] = mem8[PLAY_PHASE_COUNTER] + 1;
    mem8[FRAME_COUNTER_PRESCALER] = 60;
  }
}

/**
 * Debounce the two input ports: latch a port's value only after two consecutive reads
 * agree, then roll the previous sample forward. Downstream code reads the stable latch,
 * never the raw port.
 */
function debounceInputs(m) {
  const { mem8 } = m;

  const coinStart = mem8[COIN_START_PORT]; // coin/start port
  if (coinStart === mem8[IN1_PREV]) mem8[IN1_DEBOUNCED] = coinStart;
  mem8[IN1_PREV] = coinStart;

  const joystick = mem8[JOYSTICK_INPUT_PORT]; // joystick/dig port
  if (joystick === mem8[IN0_PREV]) mem8[IN0_DEBOUNCED] = joystick;
  mem8[IN0_PREV] = joystick;
}

/**
 * Coin/credit accounting off the debounced coin-switch byte. Each of the three coin
 * lines has a shift-register accumulator toggling between two alternating-bit sentinels;
 * a completed switch pulse (the accumulator holding the armed sentinel) banks a credit.
 * Slot 1 shows the credit screen; slots 2 and 3 pay a coins-per-credit cost and start a
 * game. Returns true when it has handed the frame off to the credit/start flow (which
 * owns the exit); false to take the normal re-arm-and-return path.
 */
function bankCoinInput(m) {
  const { mem8 } = m;

  const coinSwitches = mem8[IN1_DEBOUNCED];
  const mode = mem8[GAME_STATE];
  // The credit/start action is suppressed while a game is already in play (mode 1 or 2)
  // and no variant override is set; slots 2 and 3 are not serviced at all in that case.
  const suppressCreditAction = mem8[VARIANT] === 0 && (mode === 1 || mode === 2);

  // --- coin line 1 (switch bit 0), accumulator COIN_SW_ACCUM ---
  if (coinSwitches & 0x01) {
    mem8[COIN_SW_ACCUM] = 0x55; // line asserted: arm the detector
  } else {
    const armed = mem8[COIN_SW_ACCUM] === 0x55;
    mem8[COIN_SW_ACCUM] = 0xaa;
    if (armed) {
      // A completed line-1 pulse: bank one credit, clamped to 9.
      let banked = mem8[CREDIT_COUNT] + 1;
      if (banked >= CREDIT_CAP) banked = 9;
      mem8[CREDIT_COUNT] = banked;
      mem8[CREDIT_MIRROR_A] = banked;
      mem8[CREDIT_MIRROR_B] = banked;
      if (suppressCreditAction) return false;
      enableSound(m);
      requestSound3(m);
      m.nextMain = () => showCreditScreen(m); // warm restart: the engine swaps in the credit-screen loop
      return true;
    }
  }

  if (suppressCreditAction) return false;

  // --- coin line 2 (switch bit 2), accumulator START1_SW_ACCUM, coins-per-credit COINS_PER_CREDIT_A ---
  if (coinSwitches & 0x04) {
    const armed = mem8[START1_SW_ACCUM] === 0xaa;
    mem8[START1_SW_ACCUM] = 0x55;
    if (armed) return bankCreditAndStart(m, mem8[COINS_PER_CREDIT_A], 1);
  } else {
    mem8[START1_SW_ACCUM] = 0xaa; // arm
  }

  // --- coin line 3 (switch bit 1), accumulator START2_SW_ACCUM, coins-per-credit COINS_PER_CREDIT_B ---
  if (coinSwitches & 0x02) {
    const armed = mem8[START2_SW_ACCUM] === 0xaa;
    mem8[START2_SW_ACCUM] = 0x55;
    if (armed) return bankCreditAndStart(m, mem8[COINS_PER_CREDIT_B], 2);
    return false;
  }
  mem8[START2_SW_ACCUM] = 0xaa; // arm
  return false;
}

/**
 * Pay a coins-per-credit cost out of the banked count and, if it covers the cost, record
 * the coin slot (1 or 2) as the game mode and start a game. Both the count and the mode
 * are written to their redundant copies. Returns true when a game was started (it owns
 * the exit), false when the cost was not covered.
 */
function bankCreditAndStart(m, cost, slot) {
  const { mem8 } = m;

  const remaining = mem8[CREDIT_COUNT] - cost;
  if (remaining < 0) return false;

  mem8[CREDIT_COUNT] = remaining;
  mem8[CREDIT_MIRROR_A] = remaining;
  mem8[CREDIT_MIRROR_B] = remaining;
  mem8[GAME_STATE] = slot;
  mem8[loc_801d] = slot;
  mem8[loc_812d] = slot;
  m.nextMain = () => startGame(m); // warm restart: the engine swaps in the new game
  return true;
}
