// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { COORD_LIST_PTR_LO } from "./names.js";
import { computeCoordListBackDelta } from "./computeCoordListBackDelta.js";

// Fetch a repeat count, load the first entry it selects from a table pointer,
// then fold that many more copies of the next entry into a one-byte total.
export function sumCoordListEntryRun(m, y = m.regs.y) {
  const { mem8, mem16 } = m;
  let count = computeCoordListBackDelta(m, y);
  const ptr = mem16[COORD_LIST_PTR_LO];
  let sum = mem8[u16(ptr + y)];
  y = (y + 1) & 0xff;
  if (count !== 0) {
    do {
      sum = (sum + mem8[u16(ptr + y)]) & 0xff;
      count = (count - 1) & 0xff;
    } while (count !== 0);
  }
  return sum;
}
