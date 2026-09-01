// SPDX-License-Identifier: GPL-3.0-only
import { clearPlayfield } from "./clearPlayfield.js";

// Clear the play-field framebuffer. Live-out: memory; the seam completes the ret.
export function loc_1988(m) {
  clearPlayfield(m);
}
