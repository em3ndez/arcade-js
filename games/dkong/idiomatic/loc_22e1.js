// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_22e1 — pick an object's velocity magnitude by level, then commit it via the shared store
 * tail (magnitude at +0x11, sign derived from its low bit at +0x10). All three bytes are odd, so
 * the sign field is always 0x00.
 *
 * @param {object} m
 * @param {number} objRecord  base pointer of the object record to write.
 * LIVE-OUT: memory-only — the record's sign and magnitude fields.
 */

import { LEVEL } from "./names.js";
import { loc_22f9 } from "./loc_22f9.js";

const LEVEL1_MAGNITUDE = 0x01;
const LEVEL2_MAGNITUDE = 0xb1;
const HIGHER_LEVEL_MAGNITUDE = 0xe9;

export function loc_22e1(m, objRecord) {
  const level = m.mem8[LEVEL];
  const magnitude =
    level === 1 ? LEVEL1_MAGNITUDE :
    level === 2 ? LEVEL2_MAGNITUDE :
    HIGHER_LEVEL_MAGNITUDE;
  return loc_22f9(m, objRecord, magnitude);
}
