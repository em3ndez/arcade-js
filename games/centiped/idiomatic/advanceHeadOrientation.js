// SPDX-License-Identifier: GPL-3.0-only
import { loc_00, TILEMAP_PTR_LO, loc_40, loc_70, loc_ef } from "./names.js";
import { seedWaveState } from "./seedWaveState.js";
import { resolveTileCellAtXY } from "./resolveTileCellAtXY.js";

/**
 * advanceHeadOrientation — the centipede head's orientation/steer routine, two ROM entry points that
 * share one code body.
 *
 * ROM 0x2e94 (guardHeadOrientationWrap entry) and 0x2e9d (advanceHeadOrientationAndStampTile entry).
 * Grounding: [code] overall; the working tile pointer it writes through, TILEMAP_PTR_LO (0x32), is
 * MAME-confirmed [seen], and the direction selector `loc_ef` and orientation cell `loc_40` are bare
 * behavioural placeholders.
 *
 * ROLE IN THE MACHINE. The centipede "head" is the lead segment; unlike a trailing body cell it has to
 * pick a heading of its own and eat mushrooms it walks into. The head's heading is stored as a *folded*
 * orientation byte (XORed through the per-wave direction key `loc_ef`, which flips the whole field's
 * left/right sense) so the same code serves a normal and a flipped playfield.
 *
 * guardHeadOrientationWrap (ROM 0x2e94) — the wrap guard. The caller forwards the head's folded
 *   orientation byte in A. It unfolds the byte through `loc_ef`; once the true value has climbed to the
 *   top of its range (>= 0xfa) the heading is still valid and it just returns the unfolded value.
 *   Below that it means the orientation has wandered out of range, so it re-seeds the whole wave state
 *   (a fresh heading/velocity) — the head effectively re-rolls its course.
 *   LIVE-OUT: A = the unfolded orientation (top-of-range case), else whatever `seedWaveState` returns.
 *
 * advanceHeadOrientationAndStampTile (ROM 0x2e9d) — the per-tick step + mushroom-eat. Every 4th tick it
 *   rotates the head's orientation by one of four values (kept folded in 0x30..0x33), resolves the tile
 *   the head faces, and — only when that cell reads in the mushroom band [0x3c, 0x40) — stamps a masked
 *   marker (cell & 0xfb) back into the tile, which is how the head consumes a mushroom in its path.
 *   LIVE-OUT: the orientation cell `loc_40`, and (on a hit) the faced tile cell via TILEMAP_PTR_LO; A =
 *   the stamped marker.
 */
export function guardHeadOrientationWrap(m, a = m.regs.a) {
  // Unfold the folded orientation byte the caller forwarded in A: XOR back through the per-wave
  // direction key so the comparison below runs against the true (unflipped) orientation value.
  const value = (a ^ m.mem8[loc_ef]) & 0xff;
  // At the top of the orientation range the heading is still good -> return it unchanged in A.
  if (value >= 0xfa) return (m.regs.a = value);
  // Wandered out of range -> re-seed the wave (fresh heading + velocity) instead.
  return seedWaveState(m);
}

export function advanceHeadOrientationAndStampTile(m) {
  const { mem8, mem16 } = m;

  // Rotate the head's heading only every 4th tick (loc_00's low 2 bits == 0), so the head turns at a
  // steady, sub-frame cadence rather than spinning every frame. The rotation is mod-4 (four compass
  // headings), OR'd back into the 0x30 base and re-folded through the direction key `loc_ef`.
  if ((mem8[loc_00] & 0x03) === 0) {
    mem8[loc_40] = (((mem8[loc_40] + 1) & 0x03) | 0x30) ^ mem8[loc_ef];
  }

  // Resolve the tile cell the head currently faces. `loc_70` is the head's folded position; the second
  // arg 0x00 selects the facing column. resolveTileCellAtXY returns [cell, ...]; we want the cell byte.
  const [cell] = resolveTileCellAtXY(m, mem8[loc_70], 0x00);
  // A mushroom occupies the tile-code band [0x3c, 0x40). Anything at or above 0x40 is not a mushroom
  // (empty/other), so leave it alone.
  if (cell >= 0x40) return;
  // Anything below 0x3c is likewise not an eatable mushroom -> nothing to stamp.
  if (cell < 0x3c) return;
  // In-band: eat the mushroom by clearing bit 2 of its code (cell & 0xfb) — that demotes the mushroom
  // one stage — then re-fold through `loc_ef` and write it back through the working tile pointer.
  const marker = ((cell & 0xfb) ^ mem8[loc_ef]) & 0xff;
  mem8[mem16[TILEMAP_PTR_LO]] = marker;
  return (m.regs.a = marker);
}
