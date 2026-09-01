// SPDX-License-Identifier: GPL-3.0-only
import { blockCopy } from "./blockCopy.js";
import { WORKRAM_INIT_IMAGE, ALIEN_DRAW_PENDING } from "./names.js";

// Boot-init: copy the caller's B bytes of a template block into the work-RAM base.
export function initWorkRam(m) {
  blockCopy(m, WORKRAM_INIT_IMAGE, ALIEN_DRAW_PENDING);
}
