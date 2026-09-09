// SPDX-License-Identifier: GPL-3.0-only
import { loc_8c } from "./names.js";
import { rewritePointerTableRowFromStart } from "./writePointerTableRow.js";

/**
 * redrawPointerTableRowUnblanked — clear the blank/sign cell, then re-emit the current row from its
 * first descriptor byte so it draws unblanked. The re-entry index is 0. [code]
 */
export function redrawPointerTableRowUnblanked(m) {
  m.mem8[loc_8c] = 0;
  return rewritePointerTableRowFromStart(m, 0);
}
