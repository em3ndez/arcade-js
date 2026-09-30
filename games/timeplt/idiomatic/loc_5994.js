// SPDX-License-Identifier: GPL-3.0-only
/** loc_5994 — hand back the doubled component pair an object's OWN heading calls for, at the pace
 * one fixed table of samples sets. Choosing that table is all this entry adds; the heading comes
 * off the record, and any pointer the caller was holding is discarded. LIVE-OUT: the pair.
 *
 * ROM 0x5994-0x5999 (frozen lift translated/loc_5994.js: `ld hl,0x5c00 / jp 0x599d`).
 * Grounding: [seen] (names.js ROUTINES 0x5994).
 *
 * ROLE IN THE MACHINE. The twin of loc_598e: byte-for-byte the same two instructions apart from
 * the table address (names.js). A heading is a point on a 256-step circle held at byte +2 of an
 * object's record; the Z80 seats the table in HL and jumps to 0x599D (loc_599d), which reads that
 * heading from (IX+2) and falls into doubledVelocityForHeading (0x59A0). That body looks up two
 * perpendicular 16-bit velocity components for the heading and doubles each. Its caller here is
 * stepMotherShip, which stores the pair into the object's record as its velocity.
 *
 * The table is VELOCITY_TABLE_5C00 (0x5C00): a ROM velocity table whose era names.js records as
 * not determined, read by this entry and loc_59cb.
 */

import { doubledVelocityForHeading } from "./doubledVelocityForHeading.js";
import { VELOCITY_TABLE_5C00 } from "./names.js";

// The table this shim fixes (the ROM's `ld hl,0x5c00`) and byte +2 of an object record, the
// heading loc_599d reads with `ld a,(ix+0x02)`.
const VELOCITY_TABLE = VELOCITY_TABLE_5C00;
const HEADING_CELL = 2;

export function loc_5994(m, object = m.regs.ix) {
  const { mem8 } = m;
  // `object` is the record the ROM's IX points at. Read its heading, then do the doubled lookup
  // in the fixed table; the pair is returned (and left in DE/BC) for the caller to bank.
  return doubledVelocityForHeading(m, VELOCITY_TABLE, mem8[object + HEADING_CELL]);
}
