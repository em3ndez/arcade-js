// SPDX-License-Identifier: GPL-3.0-only
/**
 * decideSlopeGirderFooting — decide whether Mario keeps his footing on an angled girder or the
 * ground has run out and he starts to fall.
 *
 * Reached from the foot-contact cascade once Mario's foot-probe tile is a slope tile. Two
 * ways the ground can be judged to have gone away, each of which starts a fall:
 *   - Mario is exactly column-aligned (his sub-tile X offset is zero): there is no
 *     girder edge to catch him here, so he falls.
 *   - Otherwise the tile ONE ROW UP from the foot probe is inspected. A solid girder
 *     tile there (code at or above 0xB0 with a low nibble under 8) means he is standing
 *     on the angled girder and keeps his footing. Anything else up there — a slope tile
 *     or an empty tile — means there is no ground and he falls.
 *
 * Starting the fall is a single one-shot request; the keeps-footing case writes nothing.
 * Whichever way it goes, this routine returns nothing a caller reads.
 *
 * The two live-ins — the probe X and the foot-cell tilemap pointer — arrive in registers,
 * because that is how the foot-contact cascade above hands them over.
 *
 * LIVE-OUT: memory-only — the one-shot fall request, raised on the fall branches only.
 */

import { triggerMarioFall } from "./triggerMarioFall.js";

// One tilemap row is 32 cells; stepping the foot-cell pointer back by this lands on the
// cell directly above it in the 32-wide tilemap.
const ONE_ROW = 0x20;

export function decideSlopeGirderFooting(m) {
  const { regs, mem } = m;

  // The horizontal probe coordinate; its low 3 bits are Mario's offset within the tile.
  // Exactly column-aligned (offset 0) means no girder edge underfoot — the ground is gone.
  const probeX = regs.d;
  if ((probeX & 0x07) === 0) return triggerMarioFall(m);

  // Not aligned: inspect the tile one row above the foot probe (the foot cell is the live-in).
  const upperTile = mem.read8((regs.hl - ONE_ROW) & 0xffff);

  // No solid girder overhead means there is nothing to stand on — start falling. A solid
  // girder is a tile at or above 0xB0 whose low nibble is under 8; a lower code (slope or
  // empty) or a low nibble of 8+ is not solid ground.
  if (upperTile < 0xb0) return triggerMarioFall(m);
  if ((upperTile & 0x0f) >= 8) return triggerMarioFall(m);

  // Solid girder overhead: Mario keeps his footing on the slope.
}
