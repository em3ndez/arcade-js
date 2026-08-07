// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampGridBox — stamp a block of four fixed character codes at the cursor: two into the pair of cells
 * the cursor names, and two into the pair one place further along the line, which is thirty-two
 * addresses on. The four codes are constants chosen here, so this reads nothing and lays down the
 * same block wherever it is pointed, and the cursor is left exactly where it was found.
 * LIVE-OUT: memory, plus the step from the second cell to the third, left in an address pair.
 */

const NEXT_CELL = 32;
const SECOND_TO_THIRD = NEXT_CELL - 1;

const FIRST_CODE = 86;
const SECOND_CODE = 131;
const THIRD_CODE = 199;
const FOURTH_CODE = 239;

export function stampGridBox(m, cursor = m.regs.hl) {
  const { regs, mem8 } = m;
  mem8[cursor] = FIRST_CODE;
  mem8[cursor + 1] = SECOND_CODE;
  mem8[cursor + NEXT_CELL] = THIRD_CODE;
  mem8[cursor + NEXT_CELL + 1] = FOURTH_CODE;
  regs.de = SECOND_TO_THIRD;
}
