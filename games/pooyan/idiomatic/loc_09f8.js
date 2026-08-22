// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { SPRITE_OBJECT_TABLE } from "./names.js";
import { loc_4006 } from "./loc_4006.js";
import { loc_02ef } from "./loc_02ef.js";
/**
 * loc_09f8 — advance four object records' animations, then rebuild the sprite display list.
 *
 * Steps each of the four consecutive object records (one record stride apart from the
 * object-record table base) through its animation sequence in turn, then hands off to the
 * per-frame display-list rebuild that reads those updated records.
 *
 * LIVE-OUT: none — memory only. Both stages write RAM and leave nothing a caller reads back
 * (the tail rebuild is itself a void per-frame worker).
 */

const RECORD_STRIDE = 0x18; // object-record pitch
const RECORD_COUNT = 0x04; // records advanced per pass

export function loc_09f8(m) {
  let rec = SPRITE_OBJECT_TABLE;
  for (let n = 0; n < RECORD_COUNT; n++) {
    loc_4006(m, rec); // advance this record's animation
    rec = u16(rec + RECORD_STRIDE);
  }
  loc_02ef(m); // rebuild the display list from the stepped records
}
