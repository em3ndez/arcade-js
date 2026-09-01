// SPDX-License-Identifier: GPL-3.0-only
import { loc_19d3 } from "./loc_19d3.js";

// Clear the game-active flag by storing 0 through the shared accumulator tail.
export function loc_19d7(m) {
  loc_19d3(m, 0);
}
