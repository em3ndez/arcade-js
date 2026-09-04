// SPDX-License-Identifier: GPL-3.0-only
import { storeGameActive } from "./storeGameActive.js";

// Mark the game active by storing 1 through the shared accumulator tail.
export function setGameActive(m) {
  storeGameActive(m, 1);
}
