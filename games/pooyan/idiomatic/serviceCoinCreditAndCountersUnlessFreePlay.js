// SPDX-License-Identifier: GPL-3.0-only
import { accrueCreditFromDripRingA } from "./accrueCreditFromDripRingA.js";
import { accrueCreditFromCoin1Pulse } from "./accrueCreditFromCoin1Pulse.js";
import { accrueCreditsFromCoinSlot2 } from "./accrueCreditsFromCoinSlot2.js";
import { pulseCoinCounter1Latch } from "./pulseCoinCounter1Latch.js";
import { bumpTamperStrikeOnRomChecksumMiss } from "./bumpTamperStrikeOnRomChecksumMiss.js";
import { pulseCoinCounter2Latch } from "./pulseCoinCounter2Latch.js";
import { COINAGE_CONFIG, COINAGE_CONFIG_SLOT2 } from "./names.js";
/**
 * serviceCoinCreditAndCountersUnlessFreePlay -- the coin subsystem's per-frame entry point.
 *
 * WHAT IT IS
 *   The single routine that, once per frame, turns the raw state of the two coin slots and the
 *   service button into game credits and into pulses on the cabinet's mechanical coin meters. It
 *   is the whole "put a coin in, get a credit" pipeline for one frame, plus the periodic ROM
 *   integrity check that piggybacks on the same cadence.
 *
 * ROLE IN THE MACHINE
 *   The vertical-blank interrupt service, right after it samples the input ports, calls this once
 *   each frame. It is a fixed chain of six sub-updates run in order:
 *     1. three near-identical credit accumulators (one per input bit -- service, coin slot 1,
 *        coin slot 2) that debounce the raw bit, do the coinage arithmetic, and add credits;
 *     2. the coin-counter-1 strobe generator, which drives the slot-1 mechanical meter;
 *     3. a periodic anti-tamper ROM checksum guard that happens to run on this cadence;
 *     4. a tail into the coin-counter-2 strobe generator, the structural twin of (2).
 *   The whole chain is gated on coinage: on a free-play machine coins are never counted, so the
 *   routine short-circuits before doing any of the six steps.
 *
 * ROM ADDRESS: 0x59e8-0x5a05.
 *
 * Grounding: [seen]
 *
 * LIVE-OUT: none -- a void update chain. Every effect it produces lives in memory and hardware
 *   latches, written by the sub-steps: the binary credit count CREDIT_COUNT (0x8802, capped at
 *   0x63), the per-slot coin-pulse accumulators and queued-pulse counters (0x8824-0x882e), the two
 *   LS259 coin-counter latch bits (0xa183 bit3 / 0xa184 bit4), a queued credit-display refresh
 *   command, and -- only under a corrupted ROM -- the ROM tamper-strike counter.
 */
const FREE_PLAY = 0x0f;

export function serviceCoinCreditAndCountersUnlessFreePlay(m) {
  const { mem8 } = m;

  // Coinage gate. DSW0's two nibbles are decoded once at boot through the ROM coinage table into
  // COINAGE_CONFIG (0x882c, coin slot 1) and COINAGE_CONFIG_SLOT2 (0x882f, coin slot 2). The
  // descriptor value 0x0f is the free-play sentinel. A free-play cabinet does not track coins or
  // credits at all, so if EITHER slot is configured for free play the entire per-frame chain is
  // skipped -- no accrual, no coin-counter strobes, no anti-tamper pass.
  if (mem8[COINAGE_CONFIG] === FREE_PLAY) return; // slot 1 free play
  if (mem8[COINAGE_CONFIG_SLOT2] === FREE_PLAY) return; // slot 2 free play

  // Step A -- service-credit accrual. Watches the service-credit bit (IN0 bit 2) through its
  // debounce ring and, on a clean accept pulse, awards exactly one credit. Service credits are
  // free: there is no coinage arithmetic and no mechanical meter behind this slot.
  accrueCreditFromDripRingA(m);

  // Step B -- coin slot 1 accrual. Rotates the coin-slot-1 bit (IN0 bit 0) into its debounce ring
  // each frame; on a settled accept pulse it emits the coin sound, bumps the slot-1 queued-pulse
  // counter (which later drives the mechanical meter), adds 0x10 to the slot-1 coinage accumulator,
  // and when the accumulator overtakes the COINAGE_CONFIG descriptor it awards that descriptor's
  // credits -- the "N coins per credit" arithmetic -- into CREDIT_COUNT.
  accrueCreditFromCoin1Pulse(m);

  // Step C -- coin slot 2 accrual. Identical machinery to step B but on the coin-slot-2 bit
  // (IN0 bit 1), using its own debounce ring, its own accumulator, and the COINAGE_CONFIG_SLOT2
  // descriptor. Both coin steps converge on the same credit-add-and-clamp tail.
  accrueCreditsFromCoinSlot2(m);

  // Step D -- coin-counter 1 strobe. Turns queued slot-1 coin pulses into a clean, fixed-width
  // electrical pulse on the cabinet's slot-1 mechanical meter, driven through LS259 latch bit 3
  // (0xa183). It seeds a phase timer to 0x30 and raises the latch when a pulse is queued, drops the
  // latch mid-phase, and retires one queued pulse when the phase counts down to zero -- one meter
  // click per accepted coin, decoupled in time from the coin pulse itself.
  pulseCoinCounter1Latch(m);

  // Step E -- periodic anti-tamper check. Not part of coin metering; it rides this per-frame
  // cadence because the coin service already runs every frame. It sums a ROM block and, on a
  // checksum miss (a tampered/altered ROM), bumps the ROM tamper-strike counter, which downstream
  // code uses to freeze spawns and disrupt play. On an intact ROM it does nothing observable.
  bumpTamperStrikeOnRomChecksumMiss(m);

  // Step F (tail) -- coin-counter 2 strobe. The structural twin of step D for coin slot 2, driving
  // LS259 latch bit 4 (0xa184). Running it last, its completion ends the whole chain and hands
  // control back to the interrupt service.
  return pulseCoinCounter2Latch(m); // tail
}
