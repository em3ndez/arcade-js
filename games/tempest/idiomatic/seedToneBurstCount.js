// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { MODE_DISPATCH_SEL } from "./names.js";
import { runPowerOnToneBursts } from "./playPowerOnTone.js";

/**
 * seedToneBurstCount — tail that hands a burst count and a pass-seed to the power-on tone. ROM 0xd931.
 *
 * Role in the machine: the power-on / self-test path plays a short sequence of tone bursts
 * as an audible sign-of-life. This routine sits at the end of that path: it takes the burst
 * count that reached it in the accumulator and derives the pitch/pass seed the tone player
 * needs from the mode-dispatch selector cell, then delegates the actual sound to the burst
 * runner. It is reached from foldToneTableByte (0xd92f), which XOR-folds a table byte into
 * A before falling through here.
 *
 * Behavior: carry the incoming byte A straight through as the burst count. Read the seed
 * from $1 (the mode-dispatch selector): values >= 0x20 are folded down by 0x18 to bring
 * them into range, then the result is masked to its low five bits (0x1f). Hand count and
 * seed to runPowerOnToneBursts and return its result.
 *
 * Live-out: no cells written here; produces (count, index) and drives the tone burst runner,
 * returning its value. Grounding: [code].
 */
export function seedToneBurstCount(m, a = m.regs.a) {
  const { mem8 } = m;
  const count = a;                       // incoming A passes through as the burst count
  let index = mem8[MODE_DISPATCH_SEL];   // pass-seed source: mode-dispatch selector $1
  if (index >= 0x20) index = u8(index - 0x18); // fold high values down into range
  index &= 0x1f;                         // keep only the low five bits
  return runPowerOnToneBursts(m, count, index);
}
