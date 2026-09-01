// SPDX-License-Identifier: GPL-3.0-only
import { loc_1aa1, loc_1cb8, loc_20cf } from "./names.js";
import { currentPlayerRecordPtr } from "./currentPlayerRecordPtr.js";

// Pick the alien-march rate for the current field size: the first threshold the count reaches, else the default.
export function loc_170e(m) {
  const key = m.mem8[currentPlayerRecordPtr(m) + 1];
  let i = 0;
  while (i < 4 && m.mem8[loc_1cb8 + i] < key) i++;
  m.mem8[loc_20cf] = m.mem8[loc_1aa1 + i];
}
