// SPDX-License-Identifier: GPL-3.0-only
/** loc_3114 — a bare tail transfer into a lifted destination that drops the trailing ret chain and the register dance; control does not return, the stack pointer ends one word higher on the frozen side, and the live-out is whatever the destination leaves. */
import { loc_307f } from "./loc_307f.js";

export function loc_3114(m) {
  return loc_307f(m);
}
