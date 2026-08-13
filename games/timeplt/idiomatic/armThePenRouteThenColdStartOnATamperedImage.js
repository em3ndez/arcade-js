// SPDX-License-Identifier: GPL-3.0-only
/** armThePenRouteThenColdStartOnATamperedImage — put the tracing pen back at the start of its route, then check the program image.
 * The pen walks a fixed route one leg at a time, stamping a character cell as it goes; three cells hold where it has
 * got to — the leg it is on, and two coordinates each carrying a whole cell index and a fraction below. This entry
 * sends it back to leg zero and drops it on the route's first point, both coordinates written a word at a time so
 * index and fraction land together; neither is a literal — each is lifted from a fixed pair of program bytes, so the
 * route's own start moves with the image. The check that follows folds a fixed image run into one eight-bit total;
 * anything but a genuine image's value hands to the cold-start entry, which wipes all state and never returns. LIVE-OUT: memory only. */

import { u8, u16 } from "../../../core/int.js";
import { PEN_COLUMN_POS, PEN_ROUTE_LEG, PEN_ROW_POS, loc_0d45, loc_0e33, loc_280c } from "./names.js";

const CHECKED_BYTES = 0x100;
const GENUINE_TOTAL = 0xfd;
const COLD_START = 0x0069;

export function armThePenRouteThenColdStartOnATamperedImage(m) {
  const { mem8, mem16 } = m;
  mem8[PEN_ROUTE_LEG] = 0;
  mem16[PEN_ROW_POS] = mem16[loc_0d45];
  mem16[PEN_COLUMN_POS] = mem16[loc_280c];

  let total = 0;
  for (let i = 0; i < CHECKED_BYTES; i++) total = u8(total + mem8[u16(loc_0e33 + i)]);
  if (total !== GENUINE_TOTAL) return m.call(COLD_START);
}
