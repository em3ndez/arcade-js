// SPDX-License-Identifier: GPL-3.0-only
import { drawSlotRimSegment } from "./drawSlotRimSegment.js";
import { drawStyledSlotRimSegment } from "./drawStyledSlotRimSegment.js";
import { emitJumpModeSlot } from "./emitJumpModeSlot.js";
import { emitAnimatedPhaseSlot } from "./emitAnimatedPhaseSlot.js";
import { emitInterpolatedSlotVector } from "./emitInterpolatedSlotVector.js";

/**
 * dispatchSlotDrawHandler — pick and run one of five per-slot rim-draw handlers. ROM 0xb5d7.
 *
 * Role in the machine: the styled-slot draw loop at loc_b5ad renders the tube rim one slot at a time.
 * Each slot's paired control byte carries a two-bit style selector saying HOW that segment should be
 * drawn — a plain rim segment, a styled rim segment, a jump-mode slot, an animated-phase slot, or an
 * interpolated vector. loc_b5ad extracts and doubles that selector into A and jumps here; this routine
 * is the 6502 computed-JMP that lands on the matching draw handler.
 *
 * Behaviour: A arrives pre-doubled (0,2,4,6,8 — a byte offset into the ROM's 2-byte-per-entry jump
 * table); halve it (>>1) to index the JS table and tail-call the selected handler, carrying the slot
 * index x through as its argument so the handler knows which rim segment to emit.
 *
 * Live-out: none of its own — the selected handler does the drawing (emitting vector records) and its
 * result returns straight to loc_b5ad's per-slot loop. Grounding: [seen].
 */
const TABLE = [drawSlotRimSegment, drawStyledSlotRimSegment, emitJumpModeSlot, emitAnimatedPhaseSlot, emitInterpolatedSlotVector];

export function dispatchSlotDrawHandler(m, a = m.regs.a, x = m.regs.x) {
  // Halve the pre-doubled style selector to an entry index; tail-return the handler, slot x carried in.
  return TABLE[a >> 1](m, x);
}
