// SPDX-License-Identifier: GPL-3.0-only
import { fetchNextDrawRecord } from "./fetchNextDrawRecord.js";
import { loc_184c } from "./loc_184c.js";
import { u16 } from "../../../core/int.js";

// Walk a draw script from `bc`: fetch each 4-byte record (dest + source) and type it, until the 0xff
// terminator. The script pointer is a JS local. Generator; memory-only.
export function* loc_183a(m, bc) {
  let ptr = bc;
  for (;;) {
    if (m.mem8[ptr] === 0xff) return;
    const rec = fetchNextDrawRecord(m, ptr); // rec[0] = dest, rec[1] = source
    ptr = u16(ptr + 4);
    yield* loc_184c(m, rec[1], rec[0]);
  }
}
