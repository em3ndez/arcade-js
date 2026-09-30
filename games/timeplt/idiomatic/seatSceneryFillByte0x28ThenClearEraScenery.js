// SPDX-License-Identifier: GPL-3.0-only
/** seatSceneryFillByte0x28ThenClearEraScenery — fix the fill byte, then hand control on with the era and entry cursor the
 * caller carried; control leaves and does not come back. LIVE-OUT: memory. */

import { clearSceneryEntriesThenRunEraScenery } from "./clearSceneryEntriesThenRunEraScenery.js";

const FILL_BYTE = 40;

export function seatSceneryFillByte0x28ThenClearEraScenery(m, era = m.regs.c, entryCursor = m.regs.iy) {
  return clearSceneryEntriesThenRunEraScenery(m, FILL_BYTE, era, entryCursor);
}
