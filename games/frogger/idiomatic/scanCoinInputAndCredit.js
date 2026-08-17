// SPDX-License-Identifier: GPL-3.0-only
/**
 * scanCoinInputAndCredit — the coin/credit scanner the vblank NMI calls first. On the boot/attract pass
 * (the latch cell is 0) it latches the coin+service bits of the inverted IN0 and returns. Once the latch
 * is armed it waits for the release edge (all masked bits low); on the edge it issues the coin sound,
 * pulses the hardware coin counter for the credited slot (the latch's slot bit selects it), adds this
 * coinage's credit count to the packed-BCD total (clamped at 99), and — unless a game is already in play
 * — forces the game mode to the player-select mode, clears the fly/object work block, and redraws the
 * credit line. The coinage word in {0,2,4,6} indexes the per-slot credit amount, and one slot variant
 * credits only every second coin. LIVE-OUT: memory-only.
 */
import {
  IN0_PORT, COIN_INPUT_LATCH, COINAGE_WORD, COIN_PAIR_TOGGLE,
  COIN_COUNTER_0, COIN_COUNTER_1, COIN_PULSE_TIMER_0, COIN_PULSE_TIMER_1,
  CREDIT_BCD, PLAY_FLAG, GAME_MODE, POINT_TABLE_DRAW_STATE, FLY_SPRITE_X,
} from "./names.js";
import { issueSoundCommand } from "./issueSoundCommand.js";
import { blitPlayerSelectPrompt } from "./blitPlayerSelectPrompt.js";
import { renderCreditLine } from "./renderCreditLine.js";

const COIN_SERVICE_MASK = 0xc4;
const SLOT2_BIT = 0x40, SKIP_COUNTER_BIT = 0x04;
const COIN_PULSE = 0x04;
const CREDIT_CLAMP = 0x99;
const SELECT_MODE = 5;
const WORK_BLOCK_LEN = 0x20; // length of the fly/object work block cleared on start

export function scanCoinInputAndCredit(m) {
  const { regs, mem8, mem16 } = m;

  const notIn0 = (~mem8[IN0_PORT]) & 0xff;
  if (mem8[COIN_INPUT_LATCH] === 0) {
    mem8[COIN_INPUT_LATCH] = notIn0 & COIN_SERVICE_MASK; // boot/attract: arm the latch
    return;
  }
  if ((notIn0 & COIN_SERVICE_MASK) !== 0) return; // a coin/service bit is still held

  regs.a = 1;
  issueSoundCommand(m); // coin sound

  const coinage = mem16[COINAGE_WORD];
  const latch = mem8[COIN_INPUT_LATCH];

  let credit;
  if ((latch & SLOT2_BIT) !== 0) {
    mem8[COIN_INPUT_LATCH] = 0;
    mem8[COIN_COUNTER_1] = 1;
    mem8[COIN_PULSE_TIMER_1] = COIN_PULSE;
    credit = creditForSlot2(m, coinage);
  } else {
    const skipCounter = (latch & SKIP_COUNTER_BIT) !== 0; // tested before the clear below
    mem8[COIN_INPUT_LATCH] = 0;
    if (!skipCounter) {
      mem8[COIN_COUNTER_0] = 1;
      mem8[COIN_PULSE_TIMER_0] = COIN_PULSE;
    }
    credit = creditForSlot1(m, coinage);
  }
  if (credit === null) return; // every-other-coin gate declined this coin
  return addCreditAndMaybeStart(m, credit);
}

// Increment the coin-pair toggle and credit only on every second coin (even count).
function everyOtherCoin(m) {
  const c = (m.mem8[COIN_PAIR_TOGGLE] + 1) & 0xff;
  m.mem8[COIN_PAIR_TOGGLE] = c;
  return (c & 1) === 0 ? 1 : null;
}

function creditForSlot1(m, coinage) {
  switch (coinage) {
    case 0: return 1;
    case 2: return everyOtherCoin(m);
    case 4: return everyOtherCoin(m);
    case 6: return 1;
    default: throw new Error(`scanCoinInputAndCredit: coinage 0x${coinage.toString(16)} outside {0,2,4,6}`);
  }
}

function creditForSlot2(m, coinage) {
  switch (coinage) {
    case 0: return 1;
    case 2: return everyOtherCoin(m);
    case 4: return 3;
    case 6: return 6;
    default: throw new Error(`scanCoinInputAndCredit: coinage 0x${coinage.toString(16)} outside {0,2,4,6}`);
  }
}

// Add the BCD credit (clamped at 99), then start the player-select flow unless already playing.
function addCreditAndMaybeStart(m, credit) {
  const { regs, mem8 } = m;
  regs.a = mem8[CREDIT_BCD];
  regs.add(credit);
  regs.daa();
  if (regs.fC) regs.a = CREDIT_CLAMP;
  mem8[CREDIT_BCD] = regs.a;

  if (mem8[PLAY_FLAG] !== 0) return; // a game is already in play

  if (mem8[GAME_MODE] === SELECT_MODE) blitPlayerSelectPrompt(m);
  mem8[GAME_MODE] = SELECT_MODE;
  mem8[POINT_TABLE_DRAW_STATE] = 0;
  for (let i = 0; i < WORK_BLOCK_LEN; i++) mem8[(FLY_SPRITE_X + i)] = 0;
  return renderCreditLine(m);
}
