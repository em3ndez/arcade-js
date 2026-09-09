// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { loc_00, SFX_TIMER_CH1_PRIORITY, FIELD_SCAN_PTR_LO, FIELD_SCAN_PTR_HI, loc_ef, loc_8b, loc_3f, loc_6f, loc_5f, loc_b2 } from "./names.js";
import { plotRecordFieldColumns } from "./plotRecordFieldColumns.js";
import { advancePathAccumulator } from "./advancePathAccumulator.js";

/**
 * scanForRangedCellAndSeed -- throttled playfield scan that finds the next "in-range"
 * cell in the field cell-stream, erases it, and turns its position into a seed
 * coordinate for a new object.
 *
 * ROLE IN THE MACHINE. Centipede keeps the playfield as a stream of cells addressed
 * by a 16-bit pointer ($da/$db = FIELD_SCAN_PTR_LO/HI). Once in a while the machine
 * walks that pointer forward looking for a cell whose value falls in a particular
 * band; the first match is consumed (erased) and its stream position is folded into
 * the seed coordinate cells so a new actor can be placed there. This is the driver
 * for that scan.
 *
 * THROTTLING + GUARDS. The scan runs only once every eighth frame ($00 & 7 == 0)
 * and only when the ch1-priority SFX timer cell ($b7) is clear -- so it never fights
 * a higher-priority event. The pointer walk is boundary-guarded three ways: a zero
 * high byte ends the pass; reaching the top of page 7 ($07xx, lo >= 0xc0) folds the
 * high byte back to zero and ends; and a pointer that wraps all the way around hands
 * off to plotRecordFieldColumns (the table draw) instead of continuing.
 *
 * MATCH CRITERION. A cell "matches" when its low 6 bits ($3f mask) land in the
 * half-open band [0x38,0x3f). The first match calls seedRangedHit and returns.
 *
 * GROUNDING: [code]. LIVE-OUT: FIELD_SCAN_PTR_LO/HI, and (on a hit, via seedRangedHit)
 * the erased field cell plus $8b,$6f,$5f,$3f,$b2. May tail into plotRecordFieldColumns.
 */
export function scanForRangedCellAndSeed(m) {
  const { mem8, mem16 } = m;
  // THROTTLE: run at most once per eight frames. $00 is a free-running frame counter;
  // when its low 3 bits are non-zero this frame is not our slot, so bail.
  if ((mem8[loc_00] & 0x07) !== 0) return; // only every eighth frame
  // PRIORITY GUARD: if the ch1-priority SFX timer cell is armed, a higher-priority
  // event owns this slot -- skip the scan entirely this frame.
  if (mem8[SFX_TIMER_CH1_PRIORITY] !== 0) return; // priority cell busy -> skip

  // Outer loop re-checks the page-level boundary guards after every high-byte carry.
  for (;;) {
    if (mem8[FIELD_SCAN_PTR_HI] === 0) return; // high byte exhausted
    // Top-of-page fold: past $07c0 there is nothing to scan; wrap the high byte to 0
    // and end the pass (matches the ROM's page-boundary check).
    if (mem8[FIELD_SCAN_PTR_HI] === 0x07 && mem8[FIELD_SCAN_PTR_LO] >= 0xc0) { mem8[FIELD_SCAN_PTR_HI] = 0x00; return; } // top-of-page fold

    // Inner loop walks the pointer forward one cell at a time within the page.
    for (;;) {
      // Dereference the 16-bit pointer and keep the low 6 bits: the cell's band value.
      const cell = mem8[mem16[FIELD_SCAN_PTR_LO]] & 0x3f;
      // In-range cell found: process exactly one hit and return.
      if (cell >= 0x38 && cell < 0x3f) { seedRangedHit(m); return; } // in-range cell -> process one and stop

      // Not a match: advance the low byte to the next cell.
      mem8[FIELD_SCAN_PTR_LO] = u8(mem8[FIELD_SCAN_PTR_LO] + 1); // step to the next cell
      if (mem8[FIELD_SCAN_PTR_LO] !== 0) break; // still in-page -> re-check the boundary guard
      // Low byte wrapped 0xff->0x00: carry into the high byte and re-evaluate guards.
      mem8[FIELD_SCAN_PTR_HI] = u8(mem8[FIELD_SCAN_PTR_HI] + 1);
      if (mem8[FIELD_SCAN_PTR_HI] === 0) return plotRecordFieldColumns(m); // pointer fully wrapped -> hand off to the table draw
    }
  }
}

/**
 * seedRangedHit -- the in-range handler. Consumes the matched cell and converts the
 * pointer position into a pair of seed coordinate cells.
 *
 * MECHANISM. It erases the matched cell (folding an $3f pattern with the $ef mirror
 * byte), advances the path-accumulator spine (the object-placement bookkeeping),
 * then shifts the 16-bit pointer position left by three bits and derives two seed
 * coordinates from the result -- one from the shifted-in high bits, one from the
 * inverted low bits with the 6502's borrow accounted for. Finally it steps the
 * pointer past the processed cell and re-arms the $b2 timer cell.
 */
function seedRangedHit(m) {
  const { mem8, mem16 } = m;
  // Erase the matched cell: write the $3f erase pattern XOR-folded with the $ef
  // mirror byte so the value is correct in either cabinet orientation.
  mem8[mem16[FIELD_SCAN_PTR_LO]] = 0x3f ^ mem8[loc_ef]; // erase pattern folded with the mask
  // advancePathAccumulator takes a high increment via $8b (here consumed as 0) and a
  // low increment (0x05); the caller's index x is inherited by the accumulator.
  mem8[loc_8b] = 0x00; // high increment consumed by the advance
  advancePathAccumulator(m, 0x05); // low increment into the advance; x (caller index) inherited
  mem8[loc_3f] = 0xff;

  // Shift the pointer position left by three bits, carrying low->high each step, to
  // scale it into the coordinate space. $8b gets the shifted high byte, $6f the low.
  let acc = mem8[FIELD_SCAN_PTR_LO];
  let hi = mem8[FIELD_SCAN_PTR_HI];
  for (let k = 0; k < 3; k++) { const c = acc >> 7; acc = u8(acc << 1); hi = u8((hi << 1) | c); }
  mem8[loc_8b] = hi;
  mem8[loc_6f] = acc;
  // Second seed coordinate: take the shifted high 5 bits, invert them, shift up by 3,
  // then subtract with borrow (carry is clear after the shifts, hence the extra -1).
  const v = u8(((hi & 0x1f) ^ 0x1f) << 3);
  mem8[loc_5f] = u8(v - 3 - 1); // sub with borrow (carry clear after the shifts)

  // Step the pointer past the cell we just processed, carrying into the high byte.
  mem8[FIELD_SCAN_PTR_LO] = u8(mem8[FIELD_SCAN_PTR_LO] + 1); // bump the pointer past the processed cell
  if (mem8[FIELD_SCAN_PTR_LO] === 0) mem8[FIELD_SCAN_PTR_HI] = u8(mem8[FIELD_SCAN_PTR_HI] + 1);
  mem8[loc_b2] = 0x13; // re-arm the timer cell
}
