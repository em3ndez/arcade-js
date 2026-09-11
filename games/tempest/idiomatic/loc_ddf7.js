// SPDX-License-Identifier: GPL-3.0-only
import { loc_ddfd } from "./loc_ddfb.js";

// Supply mask 0x03 to the zeroed-index merge entry.
export function loc_ddf7(m) {
  loc_ddfd(m, 0x03);
}
