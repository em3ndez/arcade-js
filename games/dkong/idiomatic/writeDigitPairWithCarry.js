// SPDX-License-Identifier: GPL-3.0-only
/**
 * writeDigitPairWithCarry — stamp two digit tiles side by side, spilling a value of 10 into a
 * fixed tens cell so it can be shown as two digits.
 *
 * A tiny tilemap digit writer. The caller supplies a target cell and two digit values, the left
 * one and the right one, and they are stamped two columns apart — a column is 2 bytes in this
 * tilemap layout, so the second tile lands two cells along rather than one.
 *
 *   - the left value is written straight into the target cell.
 *   - the right value is written two cells along, EXCEPT when it is exactly 10. One tile cannot
 *     show "10", so it is split: a 0 goes into the cell two along and a 1 into a fixed tens cell
 *     elsewhere on screen. Tile codes and digit values coincide here, so writing the number
 *     writes the digit. For any other value the tens cell is left alone.
 *
 * In play this draws the coins-per-credit readout that comes from the machine's own settings, so
 * the left digit is the one-player price and the right one the two-player price, with a
 * two-player price of 10 rendered across those two separated cells.
 *
 * THE TAIL IS THE LOAD-BEARING QUIRK. It does NOT preserve the caller's target cell and digit
 * values; it OVERWRITES them with a second, fixed set. The caller calls this routine and then
 * falls straight into the same code again, so it runs twice with no loop counter, and the second
 * run reads exactly the values this tail leaves behind — drawing "1" and "2" at a different
 * place on screen. That is why they are live out: the second pass consumes them.
 *
 * A PURE LEAF otherwise — it calls nothing.
 *
 * LIVE-OUT: the two digit cells, the tens cell on the value-10 arm, and the target cell and digit
 * pair the second pass runs with.
 */
export function writeDigitPairWithCarry(m) {
  const { regs, mem } = m;

  // Left digit at the caller's cell; the paired digit two columns along.
  mem.write8(regs.hl, regs.e);
  const secondCell = (regs.hl + 2) & 0xffff;
  mem.write8(secondCell, regs.d);

  // A value of exactly 10 cannot be one tile: split it into a 0 here and a 1 in the
  // fixed tens cell. Any other value leaves the tens cell alone.
  if (regs.d === 0x0a) {
    mem.write8(secondCell, 0x00); // the ones digit
    mem.write8(0x758e, 0x01); // the tens digit
  }

  // Hand the SECOND pass its arguments — the caller falls straight back into this code
  // and reads them. A deliberate hand-off, not a failure to preserve.
  regs.de = 0x0201;
  regs.hl = 0x768c;
}
