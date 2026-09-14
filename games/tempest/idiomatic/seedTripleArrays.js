// SPDX-License-Identifier: GPL-3.0-only
import { COLOR_CYCLE_0, COLOR_CYCLE_1, COLOR_CYCLE_2, COLOR_RAM_9, COLOR_RAM_A, COLOR_RAM_B } from "./names.js";

/**
 * seedTripleArrays — seed the paired three-entry colour arrays with fixed constants. ROM 0x85f.
 *
 * Role in the machine: Tempest keeps two small parallel three-entry colour tables — a
 * colour-cycle triple at $22..$24 and a colour-RAM triple at $809..$80b — that drive the
 * playfield's cycling colour scheme. This routine plants their fixed initial values so the
 * colour animation starts from a known base; both tables are seeded to the same 0/4/12 run.
 *
 * Behavior: write the constants 0x00, 0x04, 0x0c into each table, entry for entry. Entry 2
 * (0x0c) and entry 1 (0x04) are written to both the colour-RAM and colour-cycle cells, then
 * entry 0 (0x00). The values are literals, so there is no input state.
 *
 * Live-out: $22..$24 (colour-cycle triple) and $809..$80b (colour-RAM triple), each holding
 * {0x00, 0x04, 0x0c}. Grounding: [seen].
 */
export function seedTripleArrays(m) {
  const { mem8 } = m;
  mem8[COLOR_RAM_B] = 0x0c;   // colour-RAM entry 2 ($80b)
  mem8[COLOR_CYCLE_2] = 0x0c; // colour-cycle entry 2 ($24)
  mem8[COLOR_RAM_A] = 0x04;   // colour-RAM entry 1 ($80a)
  mem8[COLOR_CYCLE_1] = 0x04; // colour-cycle entry 1 ($23)
  mem8[COLOR_CYCLE_0] = 0x00; // colour-cycle entry 0 ($22)
  mem8[COLOR_RAM_9] = 0x00;   // colour-RAM entry 0 ($809)
}
