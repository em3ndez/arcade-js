// SPDX-License-Identifier: GPL-3.0-only
/** armThePenRouteThenColdStartOnATamperedImage — put the tracing pen back at the start of its route, then check the program image.
 * The pen walks a fixed route one leg at a time, stamping a character cell as it goes; three cells hold where it has
 * got to — the leg it is on, and two coordinates each carrying a whole cell index and a fraction below. This entry
 * sends it back to leg zero and drops it on the route's first point, both coordinates written a word at a time so
 * index and fraction land together; neither is a literal — each is lifted from a fixed pair of program bytes, so the
 * route's own start moves with the image. The check that follows folds a fixed image run into one eight-bit total.
 * The run lies wholly inside the program image, so the total is a constant of the image: a genuine image always
 * folds to the expected value and the mismatch arm is dead. On a tampered image the original hands to the
 * cold-start entry, which wipes all state and never comes back to this caller; that restart is not modelled as a
 * call from inside a frame, so the mismatch arm raises instead. LIVE-OUT: memory only. */

import { u8, u16 } from "../../../core/int.js";
import { PEN_COLUMN_POS, PEN_ROUTE_LEG, PEN_ROW_POS, PEN_ROUTE_START_ROW, PEN_ROUTE_CHECKSUM_BASE, PEN_ROUTE_START_COLUMN } from "./names.js";
import { NotImplemented } from "../../../boards/timeplt/io.js";

const CHECKED_BYTES = 0x100;
const GENUINE_TOTAL = 0xfd;

export function armThePenRouteThenColdStartOnATamperedImage(m) {
  const { mem8, mem16 } = m;
  mem8[PEN_ROUTE_LEG] = 0;
  mem16[PEN_ROW_POS] = mem16[PEN_ROUTE_START_ROW];
  mem16[PEN_COLUMN_POS] = mem16[PEN_ROUTE_START_COLUMN];

  let total = 0;
  for (let i = 0; i < CHECKED_BYTES; i++) total = u8(total + mem8[u16(PEN_ROUTE_CHECKSUM_BASE + i)]);
  if (total !== GENUINE_TOTAL) {
    throw new NotImplemented(
      "armThePenRouteThenColdStartOnATamperedImage: the folded image run missed its expected total, so the " +
        "image is tampered and the original would cold-start; a genuine image always matches",
    );
  }
}
