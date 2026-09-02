// SPDX-License-Identifier: GPL-3.0-only
import { blockCopy } from "./blockCopy.js";
import { WORKRAM_INIT_IMAGE, ALIEN_DRAW_PENDING } from "./names.js";

// Boot-init: copy the fixed 0xc0-byte template image into the base of work RAM.
export function loc_01e4(m) {
  blockCopy(m, WORKRAM_INIT_IMAGE, ALIEN_DRAW_PENDING, 0xc0);
}
