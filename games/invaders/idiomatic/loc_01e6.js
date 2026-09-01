// SPDX-License-Identifier: GPL-3.0-only
import { blockCopy } from "./blockCopy.js";
import { loc_1b00, loc_2000 } from "./names.js";

// Boot-init: copy the caller's B bytes of a template block into the work-RAM base.
export function loc_01e6(m) {
  blockCopy(m, loc_1b00, loc_2000);
}
