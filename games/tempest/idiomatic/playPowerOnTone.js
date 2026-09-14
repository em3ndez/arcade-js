// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { SEG_SPREAD_A_LO_1, WATCHDOG_CLEAR, POKEY1_AUDF1, POKEY1_AUDC1, LED_FLIP_LATCH } from "./names.js";
import { checksumRomAndSettleEntropy } from "./checksumRomAndSettleEntropy.js";

// Power-on tone-and-delay. Stores the passed byte at SEG_SPREAD_A_LO_1, then drives POKEY chip-0 through a
// descending run of tone bursts: each pass writes the POKEY control/frequency cells and the output
// latch, then drains a fixed count while kicking the watchdog. The last pass switches to the low tone.
// Then it tail-delegates to the checksum/self-test.
export function playPowerOnTone(m, a = m.regs.a) {
  return runPowerOnToneBursts(m, a, 0);
}

// Second entry: the byte stored at SEG_SPREAD_A_LO_1 is passed as `count`, and its low nibble nudges the pass
// total that `a` seeds ((a >> 2) << 1, +1 when the nibble is zero).
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
