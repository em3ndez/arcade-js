// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { loc_00, loc_70, loc_f0, loc_f3, POKEY_RANDOM } from "./names.js";
import { seedWaveState } from "./seedWaveState.js";
import { armSlotWhenObjectInRange } from "./armSlotWhenObjectInRange.js";
import { resolveTileCellAtXY } from "./resolveTileCellAtXY.js";
import { stampEmptyTileCell } from "./stampEmptyTileCell.js";

/**
 * stampGridCellAtObject -- decide, for the object whose cell arrives in A, whether to drop a mushroom
 * under it this frame, and (rarely) re-seed the wave instead.
 *
 * ROM 0x2XXX (playfield tile subsystem). Grounding: [code] -- read from the routine; POKEY RANDOM and
 * the input/orientation cells are [seen], the bare zero-page cells are behavioural placeholders.
 *
 * ROLE IN THE MACHINE. This is the front door that turns an object's position into a possible mushroom
 * stamp. It parks the object's cell value in $70 (loc_70), then runs a short cascade of gates. Most
 * frames it does nothing -- the point of the gates is to make the object leave mushrooms only
 * occasionally and only when it is in the right place, so the field fills gradually rather than every
 * tick. When all gates pass it resolves the grid cell under the object and stamps it.
 *
 * THE GATES, IN ORDER:
 *  1. Fold the incoming cell A with the orientation byte $f0 (loc_f0). If the folded key is tiny (< 4)
 *     this is the special "object at the seed corner" case: re-seed the whole wave and return -- no stamp.
 *  2. Collision check for slot 12: arm that slot if the object is in range; the returned carry says
 *     whether the object actually overlaps. Carry clear -> not in range -> bail, no stamp.
 *  3. Two low-bit frame gates: $00 & 3 must be 0 (a coarse 1-in-4 frame divider) AND the POKEY RANDOM
 *     register's low two bits must be 0 (a 1-in-4 random coin). Both together keep stamps sparse.
 *  4. All clear: compute the target column from `(0x04^$f3) + $70`, resolve that grid cell into the
 *     $32/$33 pointer, and hand off to stampEmptyTileCell (which itself only writes an empty, legal cell).
 *
 * LIVE-OUT: $70 = the object cell; on the tiny-key path the wave state is re-seeded; on the full pass
 * the $32/$33 tile pointer is positioned and (if legal) a mushroom is stamped under the object.
 */
export function stampGridCellAtObject(m, a = m.regs.a) {
  const { mem8 } = m;
  // Stash the object's cell so the later column math and the wave-seed path both see the same value.
  mem8[loc_70] = a;
  // Fold with the orientation byte; a tiny result marks the seed corner -> re-seed the wave, done.
  const key = u8(a ^ mem8[loc_f0]);
  if (key < 4) { seedWaveState(m); return; }
  // Collision check for slot 12: arm the slot when the object is in range; bail on carry-clear.
  const carry = armSlotWhenObjectInRange(m, 12);
  if (!carry) return;
  // Frame divider: only act on every fourth frame ($00 counts frames; low two bits must be zero).
  if ((mem8[loc_00] & 0x03) !== 0) return;
  // Random coin on top of the frame divider: 1-in-4 by the POKEY hardware RNG's low two bits. Together
  // with the frame gate this makes an object leave mushrooms only sparsely, not on every eligible tick.
  if ((mem8[POKEY_RANDOM] & 0x03) !== 0) return;
  // All gates passed. Derive the target column by folding the orientation byte $f3 (0x04^$f3, the
  // flip-cabinet mirror) with the stashed object cell, then position the tile pointer over that cell.
  const col = u8((0x04 ^ mem8[loc_f3]) + mem8[loc_70]);
  resolveTileCellAtXY(m, col, 0);
  // Stamp it -- stampEmptyTileCell writes `0x3f^$ef` only if that cell is empty and a stampable column.
  stampEmptyTileCell(m);
}
