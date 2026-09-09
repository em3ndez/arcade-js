// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { loc_00, loc_70, loc_f0, loc_f3, POKEY_RANDOM } from "./names.js";
import { seedWaveState } from "./seedWaveState.js";
import { armSlotWhenObjectInRange } from "./armSlotWhenObjectInRange.js";
import { resolveTileCellAtXY } from "./resolveTileCellAtXY.js";
import { stampEmptyTileCell } from "./stampEmptyTileCell.js";

// Stash the object cell into $70; when its $f0-folded value is tiny, re-seed the wave. Otherwise run the
// slot-12 collision check and two low-bit frame gates, and on a clear pass resolve the grid cell under the
// object and stamp it.  [code]
export function stampGridCellAtObject(m, a = m.regs.a) {
  const { mem8 } = m;
  mem8[loc_70] = a;
  const key = u8(a ^ mem8[loc_f0]);
  if (key < 4) { seedWaveState(m); return; }
  // Collision check for slot 12: arm the slot when the object is in range; bail on carry-clear.
  const carry = armSlotWhenObjectInRange(m, 12);
  if (!carry) return;
  if ((mem8[loc_00] & 0x03) !== 0) return;
  if ((mem8[POKEY_RANDOM] & 0x03) !== 0) return;
  const col = u8((0x04 ^ mem8[loc_f3]) + mem8[loc_70]);
  resolveTileCellAtXY(m, col, 0);
  stampEmptyTileCell(m);
}
