// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";

/**
 * fleetReachedEdge — has any alien pixel reached the edge column being tested?
 *
 * WHAT IT IS
 *   Scans 23 (0x17) consecutive bytes upward from a starting pointer, looking for the first nonzero
 *   byte. Returns true (and sets carry) the moment it finds one; returns false (clears carry) if all
 *   23 are zero.
 *
 * ROLE IN THE MACHINE
 *   The fleet's horizontal sweep reverses when the leading edge touches a screen boundary (see
 *   mechanisms.md "The alien field and its march"). reverseFleetAtEdge picks which VRAM edge column
 *   to test from FLEET_MOVE_DIR — the left column FLEET_LEFT_EDGE_VRAM (0x2524) or the right column
 *   FLEET_RIGHT_EDGE_VRAM (0x3ea4) — and passes its address here. A screen column spans the alien
 *   band as a run of bytes; a nonzero byte means an alien pixel is lit in that column, i.e. the fleet
 *   has reached the edge. The 0x17-byte length is the height of the region scanned. reverseFleetAtEdge
 *   reads the result via the carry flag (its rnc: return-if-no-carry means "not at the edge yet").
 *   The set-carry "found" tail is the same one loc_166b (0x166b) provides as a shared sentinel; it is
 *   inlined here so the routine returns a real boolean rather than the seam's undefined ret value.
 *
 * ROM 0x15c5.  Grounding: [seen].
 *
 * LIVE-OUT: carry flag (m.regs.fC) — set = edge reached, clear = all-zero; also the returned boolean.
 * `ptr` defaults from HL when the caller omits it.
 */
export function fleetReachedEdge(m, ptr = m.regs.hl) {
  // Walk 23 bytes up from ptr. The first nonzero byte is an alien pixel in the edge column: report
  // "edge reached" by setting carry and returning true immediately (mirrors the loc_166b stc; ret).
  for (let i = 0; i < 0x17; i++) {
    if (m.mem8[u16(ptr + i)] !== 0) return (m.regs.fC = true);
  }
  // All 23 bytes were zero — no alien has reached this edge. Clear carry (the Z80 falls through an
  // ana a that resets carry) and return false.
  return (m.regs.fC = false);
}
