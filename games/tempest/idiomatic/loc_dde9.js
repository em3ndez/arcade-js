// SPDX-License-Identifier: GPL-3.0-only
import { loc_ddf3 } from "./loc_ddf3.js";

// Trampoline: run the shared mask-merge with the fixed mask 0x04.
export function loc_dde9(m) {
  loc_ddf3(m, 0x04);
}
