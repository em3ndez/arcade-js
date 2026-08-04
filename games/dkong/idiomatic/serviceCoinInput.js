// SPDX-License-Identifier: GPL-3.0-only
/**
 * serviceCoinInput — debounce the coin line, tally pulses, and award BCD credits.  ROM 0x017B.
 *
 * Run once per vblank from the NMI handler (entry_0066 calls it at ROM 0x00BC).
 * It reads IN2 bit 7 (COIN1) and turns a possibly-held coin line into at most one
 * counted coin per insertion, then converts full coin groups into credits.
 *
 * COIN_EDGE (0x6003) is a one-bit edge latch. While no coin is on the line it is
 * held at 1 ("armed"); a coin only counts when it finds the latch already armed,
 * and counting clears it — so holding the coin line does NOT repeat-credit.
 *
 *   - No coin present: re-arm the latch (write 1) and return.
 *   - Coin present but latch not armed: this coin was already counted — ignore it.
 *   - Coin present and armed (a fresh insertion):
 *       · Unless a game is already running (GAME_STATE == 3 keeps its own audio),
 *         silence whatever is playing (silenceSound, ROM 0x011C) and fire the
 *         coin-insert chime — SND_TRIGGER[3] := 3 (a 3-frame assert).
 *       · Clear the latch and bump the partial-coin tally COINS_PARTIAL.
 *       · Once the tally reaches DIP_COINS_PER_CREDIT it is a full group: reset the
 *         tally to 0, and — unless the credit count is already at the 0x90 BCD cap —
 *         add DIP_CREDITS_PER_COIN to CREDITS as a BCD sum and post a deferred
 *         credit task [opcode 0x04, arg 0x00] onto the task ring (enqueueTask).
 *
 * Memory-equivalent to the frozen oracle — equivalence-017b.test.js.
 * GATE:     crafted-entry; real captured attract dispatches exercise the no-coin
 *           re-arm arm (attract inserts no coin, so the line reads clear every
 *           frame). The coin-accepted, sound, not-enough-pulses, credit-award,
 *           max-cap and BCD-carry arms are crafted — poke IN2 bit 7 (io.inputAssert)
 *           plus the latch/state/DIP/credit bytes IDENTICALLY on both sides.
 * LIVE-OUT: memory-only — COIN_EDGE, COINS_PARTIAL, CREDITS, the coin-chime
 *           trigger and the task ring. The sole caller (NMI handler at ROM 0x00BC)
 *           reads no register/flag from the return before overwriting. The oracle's
 *           push/pop/ret and residual A/F are dead ABI; the JS call stack replaces
 *           the Z80 stack, so the only oracle-vs-idiomatic residue is STACK_SCRATCH,
 *           excluded by the contract.
 * NAMES:    COIN_EDGE (0x6003), COINS_PARTIAL (0x6002), CREDITS (0x6001),
 *           GAME_STATE (0x6005), DIP_COINS_PER_CREDIT (0x6024),
 *           DIP_CREDITS_PER_COIN (0x6025), SND_TRIGGER (0x6080) from names.js.
 *           Hex-kept: 0x7D00 = IN2 port (COIN1 = bit 7; the read also kicks the
 *           watchdog), 0x0400 = the credit task message (opcode 0x04, arg 0x00).
 */

import { silenceSound } from "./silenceSound.js"; // ROM 0x011C
import { enqueueTask } from "./enqueueTask.js"; //   ROM 0x309F
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
const COIN_CHIME = SND_TRIGGER + 3; // 0x6083 — the coin-insert sound trigger
const SND_ASSERT_FRAMES = 0x03; //     value stored into a trigger = a 3-frame assert
const CREDIT_CAP = 0x90; //    credits are capped at BCD 0x90
const CREDIT_TASK = 0x0400; // enqueueTask message: D = opcode 0x04, E = arg 0x00

/**
 * The `add a,(hl) / daa` pair at ROM 0x01B0–0x01B1: an 8-bit BCD addition. DAA's
 * ±0x06 / ±0x60 corrections depend on the half-carry and carry the ADD produced,
 * so both are reconstructed here exactly as the Z80 ALU sets them (add clears N,
 * so DAA is in its add form). This is the score-critical DAA path the oracle flags.
 */
function bcdAdd(a, b) {
  const sum = a + b;
  const lo = sum & 0xff;
  const halfCarry = ((a ^ b ^ lo) & 0x10) !== 0; // add's H flag
  const carry = sum > 0xff; //                      add's C flag
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

  // Post the deferred credit task (D = opcode 0x04, E = arg 0x00) onto the ring.
  regs.de = CREDIT_TASK;
  enqueueTask(m); // ROM 0x309F
}
