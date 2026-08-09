// SPDX-License-Identifier: GPL-3.0-only
/** loc_3156 — fix the fill byte, then hand control on; control leaves and does not come back. LIVE-OUT: memory. */

import { clearSceneryEntriesThenRunEraScenery } from "./clearSceneryEntriesThenRunEraScenery.js";

const FILL_BYTE = 40;

export function loc_3156(m) {
  m.regs.a = FILL_BYTE;
  return clearSceneryEntriesThenRunEraScenery(m);
}
