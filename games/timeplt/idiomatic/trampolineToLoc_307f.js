// SPDX-License-Identifier: GPL-3.0-only
/** trampolineToLoc_307f — a bare tail transfer into a lifted destination: every input the destination reads is handed
 * straight through, control does not return here, and the live-out is whatever the destination leaves. */
import { loc_307f } from "./loc_307f.js";

export function trampolineToLoc_307f(m, pointer = m.regs.hl, coordinate = m.regs.e, fold = m.regs.a, counter = m.regs.b, entry = m.regs.iy, offset = m.regs.c) {
  return loc_307f(m, pointer, coordinate, fold, counter, entry, offset);
}
