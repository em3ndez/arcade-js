// SPDX-License-Identifier: GPL-3.0-only
import { emitVectorWordTag70 } from "./emitVectorWordTag70.js";

// Emit a vector word tagged with the $70 header, with a zero data byte.
export function loc_df6a(m, a = m.regs.a) {
  return emitVectorWordTag70(m, a, 0x00);
}
