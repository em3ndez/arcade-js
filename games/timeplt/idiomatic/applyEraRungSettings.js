// SPDX-License-Identifier: GPL-3.0-only
/** applyEraRungSettings — load one row of ten bytes and scatter it over twelve fixed cells. Which row is a
 * composite number: the era cell's low nibble moved up into the high nibble, plus a rung kept in
 * a cell of its own, so every era owns sixteen rows and the sum wraps at eight bits. The table
 * the number indexes holds row ADDRESSES rather than rows. Eight of the ten bytes go to one cell
 * each and two go to two cells each, in the order the row supplies them; nothing is read back and
 * nothing is returned, so a caller learns nothing from this beyond the cells being set.
 * LIVE-OUT: memory. */

import { u8, u16 } from "../../../core/int.js";
import { ERA_INDEX, ERA_RUNG } from "./names.js";
import { fetchTableWord } from "./fetchTableWord.js";

const ROW_TABLE = 0x1b04;
const ROWS_PER_ERA = 16;

/** Where each byte of a row lands, in the order the row supplies them. */
const DESTINATIONS = [
  [0xa844], [0xa837], [0xa827], [0xa817, 0xa814], [0xacc1],
  [0xacc4], [0xa8c6], [0xa8d6], [0xa8e6], [0xa8f4, 0xa8f6],
];

export function applyEraRungSettings(m) {
  const { mem8, regs } = m;
  regs.a = u8(ROWS_PER_ERA * (mem8[ERA_INDEX] % ROWS_PER_ERA) + mem8[ERA_RUNG]);
  regs.hl = ROW_TABLE;

  let source = fetchTableWord(m);
  for (const cells of DESTINATIONS) {
    const value = mem8[source];
    for (const cell of cells) mem8[cell] = value;
    source = u16(source + 1);
  }
}
