// SPDX-License-Identifier: GPL-3.0-only
import { storeGameActive } from "./storeGameActive.js";

// Clear the game-active flag by storing 0 through the shared accumulator tail.
export function clearGameActive(m) {
  storeGameActive(m, 0);
}
