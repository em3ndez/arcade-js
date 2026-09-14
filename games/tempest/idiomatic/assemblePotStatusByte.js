// SPDX-License-Identifier: GPL-3.0-only
import { SLOT_LOOP_INDEX, POKEY1_AUDCTL, POKEY1_POTGO, POKEY2_AUDCTL, POKEY2_POTGO } from "./names.js";

/**
 * assemblePotStatusByte — merge POKEY pot/AUDCTL bits into one status byte. ROM 0xdbe0.
 *
 * Role in the machine: Tempest reads its spinner and option settings through two POKEY chips. This helper
 * folds a few control bits from the POKEY AUDCTL registers into a single status byte the option-decode path
 * (decodeOptionSwitches) records. It also strobes each POKEY's POTGO (pot-scan start) register as a side
 * effect of writing through them.
 *
 * Behavior: store the incoming accumulator into POKEY2 POTGO (POKEY2_POTGO). Take the low three bits of
 * $60d8 (POKEY2_AUDCTL) as `lo`, mirror them into the scratch/loop index $37 (SLOT_LOOP_INDEX) and into
 * POKEY1 POTGO $60cb (POKEY1_POTGO). Lift bit 5 of $60c8 (POKEY1_AUDCTL) and relocate it down two
 * positions (>> 2, i.e. into bit 3) as `hi`. Return (and set m.regs.a to) hi | lo.
 *
 * Live-out: $37 = the low three AUDCTL bits, the two POTGO strobes, and A = the merged status byte.
 * Grounding: [seen].
 */
export function assemblePotStatusByte(m, a = m.regs.a) {
  const { mem8 } = m;
  mem8[POKEY2_POTGO] = a;                     // strobe POKEY2 pot scan with the incoming value
  const lo = mem8[POKEY2_AUDCTL] & 0x07;      // low three AUDCTL bits ($60d8)
  mem8[SLOT_LOOP_INDEX] = lo;                 // mirror into scratch $37
  mem8[POKEY1_POTGO] = lo;                    // and into POKEY1 POTGO $60cb (strobes its pot scan)
  const hi = (mem8[POKEY1_AUDCTL] & 0x20) >> 2; // relocate bit5 down to bit3
  return (m.regs.a = hi | lo);
}
