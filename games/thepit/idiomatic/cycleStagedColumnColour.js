// SPDX-License-Identifier: GPL-3.0-only
/**
 * cycleStagedColumnColour — advance the byte at BOARD_MODE, keeping bit 3 clear, then paint it
 * down a column of cells.
 *
 * Reads BOARD_MODE, adds one, and forces bit 3 (the 8s bit) to stay clear on every step, so a
 * byte kept in 0..7 cycles 0,1,...,7 and back to 0 while any higher bits ride through untouched
 * (a bit-3 clear, not a plain modulo-8). The advanced byte is stored back, then handed to
 * fillColourColumn, which stamps that same byte straight down a column. That fill is a tail call,
 * so its return is this routine's return.
 */

import { BOARD_MODE } from "./names.js";
import { fillColourColumn } from "./fillColourColumn.js";

export function cycleStagedColumnColour(m) {
  const { mem8 } = m;

  // Advance one step but hold bit 3 clear, so a value kept in 0..7 wraps to 0 after 7.
  mem8[BOARD_MODE] = (mem8[BOARD_MODE] + 1) & 0xf7;

  return fillColourColumn(m);
}
