// SPDX-License-Identifier: GPL-3.0-only
import { VECRAM_TAIL_CURSOR_LO, VECRAM_TAIL_CURSOR_HI } from "./names.js";
import { unpackLevelNibbleTables } from "./unpackLevelNibbleTables.js";

/**
 * resetVectorTailCursor — rebuild level nibble tables and seat the vector-list tail cursor. ROM 0xb888.
 *
 * Role in the machine: Tempest builds its display each frame as a list of vector-generator words in a
 * region of RAM; the "tail cursor" is the two-byte pointer marking where the current vector list ends
 * (its append point). On a level reset this routine first regenerates the packed per-level nibble
 * geometry tables, then seats the tail cursor at its fixed starting address so the frame builder begins
 * appending vectors at the right place.
 *
 * Behavior: it calls unpackLevelNibbleTables to rebuild the packed-nibble level tables, then writes the
 * two-byte tail cursor VECRAM_TAIL_CURSOR_LO ($139)=0x7f and VECRAM_TAIL_CURSOR_HI ($13a)=0x04 — i.e.
 * seats the cursor at $047f.
 *
 * Live-out: the rebuilt level nibble tables (via the callee) and the vector-tail cursor $139/$13a set
 * to 0x047f. Grounding: [seen].
 */
export function resetVectorTailCursor(m) {
  const { mem8 } = m;
  // Regenerate the packed per-level nibble geometry tables.
  unpackLevelNibbleTables(m);
  // Seat the two-byte vector-list tail cursor at $047f (lo=0x7f, hi=0x04).
  mem8[VECRAM_TAIL_CURSOR_LO] = 0x7f;
  mem8[VECRAM_TAIL_CURSOR_HI] = 0x04;
}
