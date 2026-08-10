// SPDX-License-Identifier: GPL-3.0-only
/** applyEraRungSettings — load a ten-byte row and scatter it over twelve fixed cells. The row is chosen
 * by (era<<4)+rung indexing a table of row ADDRESSES rather than rows; eight bytes go to one cell each and
 * two to two cells each, in order, nothing read back or returned. LIVE-OUT: memory. */

import { u8, u16 } from "../../../core/int.js";
import { ERA_INDEX, ERA_RUNG, ROUND_CRAFT_COUNT, SCRIPT_PICK_THRESHOLD } from "./names.js";
import { fetchTableWord } from "./fetchTableWord.js";

const ROW_TABLE = 0x1b04;
const ROWS_PER_ERA = 16;

/** Where each byte of a row lands, in the order the row supplies them. */
const DESTINATIONS = [
  [0xa844], [0xa837], [0xa827], [0xa817, 0xa814], [ROUND_CRAFT_COUNT],
  [SCRIPT_PICK_THRESHOLD], [0xa8c6], [0xa8d6], [0xa8e6], [0xa8f4, 0xa8f6],
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
