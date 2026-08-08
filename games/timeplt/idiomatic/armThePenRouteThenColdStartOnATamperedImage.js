// SPDX-License-Identifier: GPL-3.0-only
/** armThePenRouteThenColdStartOnATamperedImage — put the tracing pen back at the start of its route, then check the program image.
 * The pen walks a fixed route one leg at a time, stamping a character cell as it goes; three cells
 * hold where it has got to — the leg it is on, and two coordinates that each carry a whole cell
 * index and a fraction below it. This entry sends it back to leg zero and drops it on the route's
 * first point, both coordinates written a word at a time so index and fraction land together.
 * Neither is a literal here: each is lifted out of a fixed pair of program bytes, so the route's
 * own start moves with the image. The check that follows folds a fixed run of that image into one
 * eight-bit total; anything but the value a genuine image gives hands control to the cold-start
 * entry, which wipes the machine's whole state and never comes back here. LIVE-OUT: memory only. */

import { u8, u16 } from "../../../core/int.js";

const PEN_ROUTE_LEG = 0xa9e2;
const PEN_FIRST_AXIS = 0xa9e3;
const PEN_SECOND_AXIS = 0xa9e5;
const FIRST_AXIS_START = 0x0d45;
const SECOND_AXIS_START = 0x280c;

const CHECKED_BLOCK = 0x0e33;
const CHECKED_BYTES = 0x100;
const GENUINE_TOTAL = 0xfd;
const COLD_START = 0x0069;

export function armThePenRouteThenColdStartOnATamperedImage(m) {
  const { mem8, mem16 } = m;
  mem8[PEN_ROUTE_LEG] = 0;
  mem16[PEN_FIRST_AXIS] = mem16[FIRST_AXIS_START];
  mem16[PEN_SECOND_AXIS] = mem16[SECOND_AXIS_START];

  let total = 0;
  for (let i = 0; i < CHECKED_BYTES; i++) total = u8(total + mem8[u16(CHECKED_BLOCK + i)]);
  if (total !== GENUINE_TOTAL) return m.call(COLD_START);
}
