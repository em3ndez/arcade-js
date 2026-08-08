// SPDX-License-Identifier: GPL-3.0-only
/** loc_56d2 — ask for a burst of sounds in one go. Three codes are fetched from bytes of the
 * program image and offered one after another to the in-play permission test, so all three are
 * dropped together whenever a game is not running; the entry then runs straight on into a further
 * pair of requests, which decide for themselves whether they may be heard. Nothing arrives from
 * the caller: the choice of codes is the whole content here. LIVE-OUT: memory. */

import { loc_560c } from "./loc_560c.js";
import { loc_56e4 } from "./loc_56e4.js";

const FIRST_CODE_CELL = 0x0c5b;
const SECOND_CODE_CELL = 0x0855;
const THIRD_CODE_CELL = 0x1675;

export function loc_56d2(m) {
  const { mem8 } = m;
  loc_560c(m, mem8[FIRST_CODE_CELL]);
  loc_560c(m, mem8[SECOND_CODE_CELL]);
  loc_560c(m, mem8[THIRD_CODE_CELL]);
  loc_56e4(m);
}
