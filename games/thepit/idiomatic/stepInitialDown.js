// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepInitialDown — step a caller's bounded cyclic index down one notch and request sound 8.
 *
 * The caller hands in a small cyclic index and reads the stepped value back. The index lives in the
 * range 10..35 plus an "off / not engaged" sentinel (255). Every call first asks for sound 8 (an
 * unconditional feedback request), then steps down: from off it re-enters at the top, within the
 * range it drops one, and falling to the floor turns it off. Counterpart of the sibling stepping up.
 */
import { requestSound8 } from "./requestSound8.js";

const OFF = 255; // the "not engaged" sentinel the index parks at when off
const TOP = 35; // top of the live index range
const FLOOR = 9; // stepping to or past this floor (below the range's bottom, 10) turns the index off

export function stepInitialDown(m, index) {
  requestSound8(m);

  // From off, stepping down re-enters the range at the top.
  if (index === OFF) return TOP;

  // Otherwise drop one step; falling to the floor turns the index off.
  const stepped = index - 1;
  return stepped > FLOOR ? stepped : OFF;
}
