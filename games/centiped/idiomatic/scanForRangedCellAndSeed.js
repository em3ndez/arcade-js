// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { loc_00, SFX_TIMER_CH1_PRIORITY, FIELD_SCAN_PTR_LO, FIELD_SCAN_PTR_HI, loc_ef, loc_8b, loc_3f, loc_6f, loc_5f, loc_b2 } from "./names.js";
import { plotRecordFieldColumns } from "./plotRecordFieldColumns.js";
import { advancePathAccumulator } from "./advancePathAccumulator.js";

/**
 * scanForRangedCellAndSeed -- once every eighth frame, and only when the priority cell is clear, walk the
 * 16-bit cell-stream pointer forward. The first cell whose low 6 bits land in [0x38,0x3f) is erased (folded
 * with the mask), its stream position is turned into the seed coordinate cells, and the accumulator spine is
 * advanced. Boundary-guarded: a zero high byte or the top-of-page fold ends the pass; a fully wrapped
 * pointer hands off to the table draw. [code]
 */
export function scanForRangedCellAndSeed(m) {
  const { mem8, mem16 } = m;
  if ((mem8[loc_00] & 0x07) !== 0) return; // only every eighth frame
  if (mem8[SFX_TIMER_CH1_PRIORITY] !== 0) return; // priority cell busy -> skip

  for (;;) {
    if (mem8[FIELD_SCAN_PTR_HI] === 0) return; // high byte exhausted
    if (mem8[FIELD_SCAN_PTR_HI] === 0x07 && mem8[FIELD_SCAN_PTR_LO] >= 0xc0) { mem8[FIELD_SCAN_PTR_HI] = 0x00; return; } // top-of-page fold

    for (;;) {
      const cell = mem8[mem16[FIELD_SCAN_PTR_LO]] & 0x3f;
      if (cell >= 0x38 && cell < 0x3f) { seedRangedHit(m); return; } // in-range cell -> process one and stop

      mem8[FIELD_SCAN_PTR_LO] = u8(mem8[FIELD_SCAN_PTR_LO] + 1); // step to the next cell
      if (mem8[FIELD_SCAN_PTR_LO] !== 0) break; // still in-page -> re-check the boundary guard
      mem8[FIELD_SCAN_PTR_HI] = u8(mem8[FIELD_SCAN_PTR_HI] + 1);
      if (mem8[FIELD_SCAN_PTR_HI] === 0) return plotRecordFieldColumns(m); // pointer fully wrapped -> hand off to the table draw
    }
  }
}

// The in-range handler: erase the cell, advance the accumulator spine, then fold the pointer position into
// the seed coordinate cells and bump the pointer.
function seedRangedHit(m) {
  const { mem8, mem16 } = m;
  mem8[mem16[FIELD_SCAN_PTR_LO]] = 0x3f ^ mem8[loc_ef]; // erase pattern folded with the mask
  mem8[loc_8b] = 0x00; // high increment consumed by the advance
  advancePathAccumulator(m, 0x05); // low increment into the advance; x (caller index) inherited
  mem8[loc_3f] = 0xff;

  // Fold the pointer position up by three bits into one seed cell; its inverted low bits into the other.
  let acc = mem8[FIELD_SCAN_PTR_LO];
  let hi = mem8[FIELD_SCAN_PTR_HI];
  for (let k = 0; k < 3; k++) { const c = acc >> 7; acc = u8(acc << 1); hi = u8((hi << 1) | c); }
  mem8[loc_8b] = hi;
  mem8[loc_6f] = acc;
  const v = u8(((hi & 0x1f) ^ 0x1f) << 3);
  mem8[loc_5f] = u8(v - 3 - 1); // sub with borrow (carry clear after the shifts)

  mem8[FIELD_SCAN_PTR_LO] = u8(mem8[FIELD_SCAN_PTR_LO] + 1); // bump the pointer past the processed cell
  if (mem8[FIELD_SCAN_PTR_LO] === 0) mem8[FIELD_SCAN_PTR_HI] = u8(mem8[FIELD_SCAN_PTR_HI] + 1);
  mem8[loc_b2] = 0x13; // re-arm the timer cell
}
