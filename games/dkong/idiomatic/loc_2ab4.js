// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2ab4 — decide whether Mario keeps his footing on an angled girder or the
 * ground has run out and he starts to fall.  ROM 0x2AB4.
 *
 * Reached from the foot-contact cascade (sub_2a85) once Mario's foot-probe tile is a
 * slope tile. Two ways the ground can be judged to have gone away, each of which starts
 * a fall:
 *   - Mario is exactly column-aligned (his sub-tile X offset is zero): there is no
 *     girder edge to catch him here, so he falls.
 *   - Otherwise the tile ONE ROW UP from the foot probe is inspected. A solid girder
 *     tile there (code at or above 0xB0 with a low nibble under 8) means he is standing
 *     on the angled girder and keeps his footing. Anything else up there — a slope tile
 *     or an empty tile — means there is no ground and he falls.
 *
 * Starting the fall is a single one-shot request (triggerMarioFall); the keeps-footing
 * case writes nothing. Whichever way it goes, this routine returns nothing a caller reads.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2ab4.test.js.
 * GATE:     crafted-entry, factored-exhaustive over the two decision variables — the
 *           probe X's low 3 bits (over all 256 X values) and the upper tile (over all
 *           256 codes), plus the full residue×tile grid. 0x2AB4 is a non-attract
 *           frontier (0 dispatches in 2000 attract frames — the slope cascade is only
 *           poke-reached), so entries are crafted on a real attract base identically on
 *           both sides. Teeth: three twins, one per decision boundary.
 * LIVE-OUT: memory-only (MARIO_START_FALL, raised inside triggerMarioFall on the fall
 *           branches; the keeps-footing branch writes nothing). The oracle's residual
 *           registers/flags and its terminal return / tail into the fall trigger are
 *           dead — the still-translated caller tail-invokes this and consumes no value.
 * NAMES:    touches no named work-RAM cell directly. The tile read is a computed
 *           video-RAM pointer (foot cell − one row; no ram.js name), and the fall write
 *           is MARIO_START_FALL (0x6221) inside the direct-called triggerMarioFall
 *           (ROM 0x2ACD). Its two live-ins — the probe X and the foot-cell pointer — are
 *           read from registers at the still-translated sub_2a85 (ROM 0x2A85) boundary.
 */

import { triggerMarioFall } from "./triggerMarioFall.js"; // ROM 0x2ACD

// One tilemap row is 32 cells; stepping the foot-cell pointer back by this lands on the
// cell directly above it in the 32-wide tilemap.
const ONE_ROW = 0x20;

export function loc_2ab4(m) {
  const { regs, mem } = m;

  // The horizontal probe coordinate; its low 3 bits are Mario's offset within the tile.
  // Exactly column-aligned (offset 0) means no girder edge underfoot — the ground is gone.
  const probeX = regs.d;
  if ((probeX & 0x07) === 0) return triggerMarioFall(m);

  // Not aligned: inspect the tile one row above the foot probe. regs.hl is the foot cell.
  const upperTile = mem.read8((regs.hl - ONE_ROW) & 0xffff);

  // No solid girder overhead means there is nothing to stand on — start falling. A solid
  // girder is a tile at or above 0xB0 whose low nibble is under 8; a lower code (slope or
  // empty) or a low nibble of 8+ is not solid ground.
  if (upperTile < 0xb0) return triggerMarioFall(m);
  if ((upperTile & 0x0f) >= 8) return triggerMarioFall(m);

  // Solid girder overhead: Mario keeps his footing on the slope.
}
