// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { loc_29 } from "./names.js";

/**
 * partitionByteToFineCoarseSeed — split one input byte into three derived live-outs. ROM 0x93e0.
 *
 * Role in the machine: a helper reseedStateTables leans on to fan a source byte (loc_163 / loc_120 /
 * loc_160) out into its satellite cells. It carves the byte into a "seed" keyed off the byte's high bits
 * and a matching "coarse index" keyed off that seed's complement, so the two can be scattered together as a
 * fine/coarse pair.
 *
 * Behaviour: fold A's top three bits, MSB first, into the low bits of a 0xff seed — three left-shifts of
 * both A and the accumulator, OR-ing each extracted top bit into the accumulator — then stash the seed in
 * scratch loc_29. A is left holding the input shifted left three times (the original ROM's pha/pla
 * preserves the SHIFTED A, not the input), and the coarse index X is derived as ((seed ^ 0xff) + 0x0d) >> 1.
 *
 * Live-out: loc_29 (the seed), plus registers A = input << 3, X = coarse index, Y = seed. Grounding: [seen].
 */
export function partitionByteToFineCoarseSeed(m, a = m.regs.a) {
  const { mem8 } = m;
  let acc = 0xff;
  for (let i = 0; i < 3; i++) {
    const bit = (a >> 7) & 1;
    a = u8(a << 1);
    acc = u8((acc << 1) | bit);
  }
  mem8[loc_29] = acc;
  // Three register live-outs (A shifted, X derived, Y=seed) — all ride the return so callers see them.
  return [(m.regs.a = a), (m.regs.x = ((acc ^ 0xff) + 0x0d) >> 1), (m.regs.y = acc)];
}
