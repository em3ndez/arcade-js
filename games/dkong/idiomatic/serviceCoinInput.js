// SPDX-License-Identifier: GPL-3.0-only
/**
 * serviceCoinInput — debounce the coin line, tally pulses, and award BCD credits.
 *
 * Run once per vblank from the NMI service. It reads the coin input bit and turns a
 * possibly-held coin line into at most one counted coin per insertion, then converts
 * full coin groups into credits.
 *
 * COIN_EDGE is a one-bit edge latch. While no coin is on the line it is held at 1
 * ("armed"); a coin only counts when it finds the latch already armed, and counting
 * clears it — so holding the coin line does NOT repeat-credit.
 *
 *   - No coin present: re-arm the latch (write 1) and return.
 *   - Coin present but latch not armed: this coin was already counted — ignore it.
 *   - Coin present and armed (a fresh insertion):
 *       · Unless a game is already running (GAME_STATE == 3 keeps its own audio),
 *         silence whatever is playing and fire the coin-insert chime —
 *         SND_TRIGGER[3] := 3, a 3-frame assert.
 *       · Clear the latch and bump the partial-coin tally COINS_PARTIAL.
 *       · Once the tally reaches DIP_COINS_PER_CREDIT it is a full group: reset the
 *         tally to 0, and — unless the credit count is already at the 0x90 BCD cap —
 *         add DIP_CREDITS_PER_COIN to CREDITS as a BCD sum and post a deferred
 *         credit task [opcode 0x04, arg 0x00] onto the task ring.
 *
 * LIVE-OUT: memory-only — COIN_EDGE, COINS_PARTIAL, CREDITS, the coin-chime trigger
 * and the task ring. The caller reads no register or flag back.
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

const IN2_PORT = 0x7d00; //   coin/start input; reading it also re-kicks the watchdog
const COIN1_BIT = 0x80; //    IN2 bit 7 = COIN1
const GAME_RUNNING = 0x03; //  GAME_STATE value for an in-progress game (keeps its audio)
const COIN_CHIME = SND_TRIGGER + 3; // the coin-insert sound trigger
const SND_ASSERT_FRAMES = 0x03; //     value stored into a trigger = a 3-frame assert
const CREDIT_CAP = 0x90; //    credits are capped at BCD 0x90
const CREDIT_TASK = 0x0400; // task message: opcode 0x04, arg 0x00

/**
 * An 8-bit BCD addition. The decimal-adjust step's ±0x06 / ±0x60 corrections depend on
 * the half-carry and the carry the plain add produced, so both are reconstructed here
 * exactly as the ALU sets them; the adjust is in its addition form, never its
 * subtraction one. This is the score-critical decimal-adjust path.
 */
function bcdAdd(a, b) {
  const sum = a + b;
  const lo = sum & 0xff;
  const halfCarry = ((a ^ b ^ lo) & 0x10) !== 0; // the add's half-carry
  const carry = sum > 0xff; //                      the add's carry
  let correction = 0;
  if (halfCarry || (lo & 0x0f) > 9) correction |= 0x06;
  if (carry || lo > 0x99) correction |= 0x60;
  return (lo + correction) & 0xff;
}

export function serviceCoinInput(m) {
  const { regs, mem } = m;

  // Read IN2 (also re-kicks the watchdog). COIN1 is bit 7.
  const coinPresent = (mem.read8(IN2_PORT) & COIN1_BIT) !== 0;

  if (!coinPresent) {
    mem.write8(COIN_EDGE, 0x01); // no coin on the line: (re)arm the edge latch
    return;
  }

  // Coin present: it only counts on the rising edge, i.e. while the latch is armed.
  if (mem.read8(COIN_EDGE) === 0) return; // already counted this coin — ignore

  // -- coin accepted --
  // Play the coin chime unless a game is already running (state 3 keeps its audio).
  if (mem.read8(GAME_STATE) !== GAME_RUNNING) {
    silenceSound(m); //                        cut any currently-playing sound first
    mem.write8(COIN_CHIME, SND_ASSERT_FRAMES); // then trigger SND_TRIGGER[3]
  }

  // Consume the latch and tally this coin pulse.
  mem.write8(COIN_EDGE, 0x00);
  const partial = (mem.read8(COINS_PARTIAL) + 1) & 0xff;
  mem.write8(COINS_PARTIAL, partial);

  // Not a full coin group yet? (tally != coins-per-credit) — nothing more to do.
  if (mem.read8(DIP_COINS_PER_CREDIT) !== partial) return;

  // A full group: reset the tally and award credits.
  mem.write8(COINS_PARTIAL, 0x00);

  // Credits are capped at BCD 0x90; at or above it, award nothing further.
  const credits = mem.read8(CREDITS);
  if (credits >= CREDIT_CAP) return;

  // Add credits-per-coin as a BCD sum and store the new credit count.
  mem.write8(CREDITS, bcdAdd(credits, mem.read8(DIP_CREDITS_PER_COIN)));

  // Post the deferred credit task (opcode 0x04, arg 0x00) onto the ring.
  regs.de = CREDIT_TASK;
  enqueueTask(m);
}
