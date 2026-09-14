// SPDX-License-Identifier: GPL-3.0-only
import { emitVectorHeaderAndClearSlots } from "./emitVectorHeaderAndClearSlots.js";

/**
 * emitPrimedHeaderAndClearVectorSlots — emit the fixed readout header then blank its slot rows. ROM 0xdb7e.
 *
 * Role in the machine: the fixed-header front onto emitVectorHeaderAndClearSlots. Before the per-frame
 * pot/spinner readout list is rebuilt, the emitter lays a fixed header vector word (from the value/index
 * pair 0x32,0xb6) and then zeroes the four even-indexed accumulator slots of the two work rows at 0x60c1
 * and 0x60d1, so the readout starts each frame from a clean slate.
 *
 * Behaviour: call emitVectorHeaderAndClearSlots with the primed value 0x32 and index 0xb6. Because that
 * value byte is nonzero, the delegate takes the header-then-clear path; its alternate self-seeding entry
 * (reached only when the value arrives zero) is never taken from here.
 *
 * Live-out: the emitted header word in the vector list plus the four cleared even slots of 0x60c1/0x60d1;
 * both are produced by the delegate. Grounding: [seen].
 */
export function emitPrimedHeaderAndClearVectorSlots(m) {
  return emitVectorHeaderAndClearSlots(m, 0x32, 0xb6); // value 0x32 (nonzero -> header+clear path), index 0xb6
}
