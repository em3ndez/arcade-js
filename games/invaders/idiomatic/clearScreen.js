// SPDX-License-Identifier: GPL-3.0-only
import { VIDEO_RAM_BASE, VIDEO_RAM_END } from "./names.js";

// Zero the video-RAM span, from its base up to the top of RAM.
export function clearScreen(m) {
  for (let a = VIDEO_RAM_BASE; a < VIDEO_RAM_END; a++) m.mem8[a] = 0x00;
}
