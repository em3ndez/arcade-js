// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { loc_2008, loc_2009, ALIEN_DRAW_ADDR, FLEET_MOVE_DIR } from "./names.js";
import { activeFieldRecordPointer } from "./activeFieldRecordPointer.js";

/**
 * loadReferenceAlienState — rebuild the fleet's reference corner from the active player's save record.
 *
 * WHAT IT IS
 *   Reads the active player's saved field record (near the top of their RAM page), mirrors the fleet's
 *   reference-corner coordinate word into two working spots, derives a working step-count byte, and
 *   sets the fleet's move-direction flag when the saved record carries the edge sentinel.
 *
 * ROLE IN THE MACHINE
 *   The whole fleet's on-screen position is tracked by a single reference corner; every alien's
 *   coordinate is that corner plus a grid offset (see mechanisms.md "The alien field and its march").
 *   Each player's corner and heading are saved per page so they persist across the turn hand-off.
 *   activeFieldRecordPointer builds (ACTIVE_PLAYER_PAGE<<8)|0xfc — the save slot. This routine reads
 *   the 16-bit coordinate word there and copies it into BOTH loc_2009/loc_200a (the anchor pair the
 *   alien index-to-coordinate math reads) and ALIEN_DRAW_ADDR (0x200b). It then reads the byte one
 *   below the pointer (page-offset 0xfb, the per-player saved delta) as a working count into loc_2008,
 *   decrementing it by one when it reads exactly 0x03, and raises FLEET_MOVE_DIR (0x200d) when that
 *   byte carries the sentinel 0xfe (which encodes the reversed/leftward heading). Because loc_2009/
 *   loc_200a are refreshed here every pass, nudging the reference corner slides the entire fleet in
 *   lockstep — that is the march. The anchor cells loc_2008/loc_2009/loc_200a keep loc_ names; their
 *   pixel-axis convention is not confident from the code alone.
 *
 * ROM 0x00b1.  Grounding: [seen].
 *
 * LIVE-OUT: RAM only — loc_2009/loc_200a, ALIEN_DRAW_ADDR (word), loc_2008 (count), FLEET_MOVE_DIR.
 */
export function loadReferenceAlienState(m) {
  const { mem8, mem16 } = m;
  // Address the active player's field-save slot at page:0xfc.
  const ptr = activeFieldRecordPointer(m);
  // Read the saved reference-corner coordinate word (little-endian) from the slot.
  const value = mem16[ptr];
  // Publish that corner into the two live anchors: the index-to-screen math reads loc_2009/loc_200a,
  // and the draw pass reads ALIEN_DRAW_ADDR — both start the frame pointing at the reference corner.
  mem16[loc_2009] = value;
  mem16[ALIEN_DRAW_ADDR] = value;
  // The byte just below the pointer (page-offset 0xfb) is the saved per-player delta/step.
  const below = mem8[u16(ptr - 1)];
  // Copy it down as the working step count, quirk-decrementing by one when it reads 0x03 (matching
  // the ROM's special-case adjust of that value).
  const count = below === 0x03 ? u8(below - 1) : below;
  mem8[loc_2008] = count;
  // The sentinel 0xfe in that byte marks the reversed heading: set FLEET_MOVE_DIR when seen, else 0.
  mem8[FLEET_MOVE_DIR] = count === 0xfe ? 0x01 : 0x00;
}
