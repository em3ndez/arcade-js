// SPDX-License-Identifier: GPL-3.0-only
/** loc_0066 — the per-frame interrupt entry: control lands here once a frame and hands straight on to the frame-service handler, writing nothing of its own. LIVE-OUT: memory. */

import { loc_00d8 } from "./loc_00d8.js";

export function loc_0066(m) {
  return loc_00d8(m);
}
