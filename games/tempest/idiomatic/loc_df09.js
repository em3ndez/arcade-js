// SPDX-License-Identifier: GPL-3.0-only
import { emitRecordBodyByte } from "./emitHeaderedBodyRecord.js";

// Store the fixed body byte at the cursor origin and run the shared record tail.
export function loc_df09(m) {
  return emitRecordBodyByte(m, 0xc0);
}
