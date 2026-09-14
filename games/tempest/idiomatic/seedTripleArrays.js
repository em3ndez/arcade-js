// SPDX-License-Identifier: GPL-3.0-only
import { COLOR_CYCLE_0, COLOR_CYCLE_1, COLOR_CYCLE_2, COLOR_RAM_9, COLOR_RAM_A, COLOR_RAM_B } from "./names.js";

// Seed the paired 3-entry arrays with the fixed values 0, 4, 12.
export function seedTripleArrays(m) {
  const { mem8 } = m;
  mem8[COLOR_RAM_B] = 0x0c;
  mem8[COLOR_CYCLE_2] = 0x0c;
  mem8[COLOR_RAM_A] = 0x04;
  mem8[COLOR_CYCLE_1] = 0x04;
  mem8[COLOR_CYCLE_0] = 0x00;
  mem8[COLOR_RAM_9] = 0x00;
}
