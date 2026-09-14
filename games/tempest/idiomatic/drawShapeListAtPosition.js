// SPDX-License-Identifier: GPL-3.0-only
import { SAVED_INDEX, loc_2a, loc_2b } from "./names.js";
import { expandShapeListToVectors } from "./expandShapeListToVectors.js";

/**
 * drawShapeListAtPosition — a thin front over the shared shape-list builder. ROM 0xab98.
 *
 * Role in the machine: Tempest's vector display is assembled from small "shape lists" — runs of
 * vector-generator words drawn at a chosen slot and position. Several callers want to draw one such
 * list but differ only in which shape slot and where; this routine is their common entry: it seats the
 * two per-draw scratch inputs and a zero colour/flag header, then falls straight through into the
 * shared emitter so every caller shares one record-building path.
 *
 * Behavior: it copies the slot index x into SAVED_INDEX (loc_35) and the position seed a into loc_2a,
 * clears the colour/flag header loc_2b to 0x00 (default tint, no special flag), and tail-calls
 * expandShapeListToVectors, which walks the selected shape's table and emits its vector-word run.
 *
 * Live-out: loc_35 (slot), loc_2a (position seed) and loc_2b (=0) staged for the builder, plus the
 * vector words that expandShapeListToVectors appends to the display list. Grounding: [seen].
 */
export function drawShapeListAtPosition(m, x = m.regs.x, a = m.regs.a) {
  const { mem8 } = m;
  mem8[SAVED_INDEX] = x;      // loc_35: which shape slot to draw
  mem8[loc_2a] = a;           // position seed for the emitted run
  mem8[loc_2b] = 0x00;        // colour/flag header: default, no special flag
  return expandShapeListToVectors(m); // fall through into the shared record builder
}
