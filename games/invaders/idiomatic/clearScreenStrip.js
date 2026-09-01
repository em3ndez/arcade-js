// SPDX-License-Identifier: GPL-3.0-only
import { fillScreenRow } from "./fillScreenRow.js";

// Clear a screen column: fill the run of rows with zero.
export function clearScreenStrip(m) {
  return fillScreenRow(m, 0);
}
