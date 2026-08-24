// SPDX-License-Identifier: GPL-3.0-only
import { COIN2_PULSE_COUNT, COIN2_PULSE_PHASE, COIN2_COUNTER_LATCH } from "./names.js";
/**
 * pulseCoinCounter2Latch — coin-counter 2 pulse generator: turn queued coin pulses into a timed strobe on the
 * second coin-counter latch (LS259 bit 4). No pulses queued -> return. Fresh pulse (phase idle) ->
 * seed the phase timer and raise the latch. Counting -> step the phase down, lower the latch at the
 * drop point, retire one queued pulse when the phase reaches zero. Structural twin of the
 * coin-counter 1 pulse generator.
 * LIVE-OUT: memory only — the pulse count + phase timer + the write-only coin-counter latch bit.
 */

const PULSE_PHASE_SEED = 0x30;
const PULSE_DROP_PHASE = 0x18;

export function pulseCoinCounter2Latch(m) {
  const { mem8 } = m;

  if (mem8[COIN2_PULSE_COUNT] === 0) return;

  const phase = mem8[COIN2_PULSE_PHASE];
  if (phase === 0) {
    // fresh pulse: start the phase timer and raise the latch
    mem8[COIN2_PULSE_PHASE] = PULSE_PHASE_SEED;
    mem8[COIN2_COUNTER_LATCH] = 1;
    return;
  }

  const next = (phase - 1) & 0xff;
  mem8[COIN2_PULSE_PHASE] = next;
  if (next === 0) {
    mem8[COIN2_PULSE_COUNT] = mem8[COIN2_PULSE_COUNT] - 1;
    return;
  }
  if (next === PULSE_DROP_PHASE) {
    mem8[COIN2_COUNTER_LATCH] = 0;
  }
}
