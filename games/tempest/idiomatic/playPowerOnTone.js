// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { SEG_SPREAD_A_LO_1, WATCHDOG_CLEAR, POKEY1_AUDF1, POKEY1_AUDC1, LED_FLIP_LATCH } from "./names.js";
import { checksumRomAndSettleEntropy } from "./checksumRomAndSettleEntropy.js";

/**
 * playPowerOnTone — the power-on tone-and-delay chime that plays as the board boots. ROM 0xd8ca.
 *
 * Role in the machine: on cold start Tempest sounds a short descending run of beeps before it drops into the
 * ROM checksum / self-test. This is the first entry point; it fixes the tone-burst count at 0 and hands off
 * to the shared burst driver below. The audible run plus the fixed drain delays double as a settling wait so
 * the hardware is stable before the self-test reads it.
 *
 * Behaviour: store the passed byte at SEG_SPREAD_A_LO_1, then step POKEY chip-0 through the bursts, writing
 * the POKEY control/frequency cells and strobing the LED/output latch, draining a fixed count each pass
 * while kicking the watchdog. The last pass switches to the low tone. It tail-delegates to
 * checksumRomAndSettleEntropy.
 *
 * Live-out: POKEY chip-0 audio registers (POKEY1_AUDC1 / POKEY1_AUDF1), the LED_FLIP_LATCH output strobe,
 * SEG_SPREAD_A_LO_1, and a serviced watchdog; then whatever the checksum tail leaves. Grounding: [code].
 */
export function playPowerOnTone(m, a = m.regs.a) {
  return runPowerOnToneBursts(m, a, 0); // first entry: burst count seeded to 0
}

/**
 * runPowerOnToneBursts — the shared body of the power-on chime (second entry of playPowerOnTone). ROM
 * 0xd8cd.
 *
 * The byte stored at SEG_SPREAD_A_LO_1 arrives here as `count`, and its low nibble nudges the pass total
 * that `a` seeds: passes = (a >> 2) << 1, plus one more when the low nibble is zero. Each pass fires a tone
 * burst (control 0xa2, frequency 0xc0, or 0x60 on the final pass) then a silent gap, draining a fixed inner
 * count both times while kicking the watchdog; the loop ends when the pass counter underflows past 0. Tail-
 * delegates to checksumRomAndSettleEntropy. Grounding: [code].
 */
export function runPowerOnToneBursts(m, count = m.regs.y, a = m.regs.a) {
  const { mem8 } = m;
  mem8[SEG_SPREAD_A_LO_1] = count;

  let passes = (a >> 2) << 1;
  if ((count & 0x0f) === 0) passes = passes + 1;

  let remaining = passes;
  do {
    mem8[POKEY1_AUDC1] = 0xa2;
    const lastPass = remaining === 0;
    const tone = lastPass ? 0x60 : 0xc0;
    const firstBurst = lastPass ? 9 : 1;
    mem8[POKEY1_AUDF1] = tone;
    mem8[LED_FLIP_LATCH] = 3;

    drain(mem8, firstBurst, tone);
    mem8[POKEY1_AUDC1] = 0;
    mem8[LED_FLIP_LATCH] = 0;
    drain(mem8, 9, 0);

    remaining = u8(remaining - 1);
  } while ((remaining & 0x80) === 0);

  return checksumRomAndSettleEntropy(m);
}

// One burst: a 256-tick inner drain repeated `passes` times, kicking the watchdog each tick
// (`value` rides the write but the device ignores it). The per-tick 3kHz clock sync that paces this on
// the machine has no stored effect and is not modelled.
function drain(mem8, passes, value) {
  let outer = passes;
  do {
    let inner = 0;
    do {
      mem8[WATCHDOG_CLEAR] = value;
      inner = u8(inner - 1);
    } while (inner !== 0);
    outer = u8(outer - 1);
  } while (outer !== 0);
}
