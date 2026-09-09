// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { resolveTileCellAtXY } from "./resolveTileCellAtXY.js";
import { routeByCoordDelta } from "./routeByCoordDelta.js";
import { loc_63, loc_73, loc_86, loc_8b } from "./names.js";

/**
 * clampCoordToBand -- move an actor's $73 coordinate (ROM 0x0073) forward by the
 * signed delta in A (plus the incoming carry), clamp the result into the legal band,
 * and then continue into the follow-up router -- but only actually write the new
 * position if the destination tile cell is empty.
 *
 * ROLE IN THE MACHINE: this is the "try to step here" primitive for an object that
 * moves along one axis of the playfield. The grid has two forbidden dead zones (the
 * gaps between the mushroom field's legal columns); the band keeps the coordinate out
 * of them by folding edge results to the nearest legal boundary (0x08 / 0x30 on the
 * low run, 0xc8 / 0xf0 on the high run) while letting interior values through. The
 * cell probe implements collision-with-the-playfield: if a mushroom (or other object)
 * already occupies the target cell, the move is refused and $73 stays put, so the
 * actor cannot walk into an occupied square. Behaviour-derived. [code]
 *
 * MECHANISM: a 6502 CLC/ADC (or the carried ADC shown here) forms the tentative new
 * coordinate. Before committing it, the routine seeds the row-scratch cell $8b from
 * the object's row $63 (ROM 0x0063) and calls the tile resolver at (sum, Y=0) to read
 * what occupies the destination. A zero cell means empty -> the clamped sum is stored.
 * Finally the sign cell $86 (ROM 0x0086) decides whether more work follows: when it is
 * non-negative (bit 7 clear) control falls into routeByCoordDelta for the next stage;
 * a negative $86 ends the chain here.
 *
 * LIVE-OUT: RAM cell $73 (conditionally) and $8b; otherwise whatever
 * routeByCoordDelta returns, or undefined when $86 is negative.
 */
export function clampCoordToBand(m, a = m.regs.a, carryIn = m.regs.fC) {
  const { mem8 } = m;
  // Tentative new coordinate: current $73 + signed delta A + carry-in (6502 ADC).
  const sum = u8(a + mem8[loc_73] + (carryIn ? 1 : 0));
  mem8[loc_8b] = mem8[loc_63]; // seed the row scratch for the cell probe (Y = 0)
  // Read the grid cell at the destination (column = tentative sum, row = 0). A live
  // occupant here is a collision that will veto the move.
  const cell = resolveTileCellAtXY(m, sum, 0)[0];
  // Occupied destination leaves $73 untouched; an empty cell writes the clamped sum.
  // Clamp folds each of the four edge cases to its nearest legal rail so the stored
  // coordinate never lands inside a dead zone; interior values pass through as-is.
  if (cell === 0) {
    let clamped;
    if (sum < 0x08) clamped = 0x08;
    else if (sum >= 0xf1) clamped = 0xf0;
    else if (sum < 0x80) clamped = sum < 0x31 ? sum : 0x30;
    else clamped = sum >= 0xc8 ? sum : 0xc8;
    mem8[loc_73] = clamped;
  }
  // Chain control: a non-negative sign cell means the follow-up router still has work;
  // a negative one ($86 bit 7 set) terminates the step here.
  if ((mem8[loc_86] & 0x80) === 0) return routeByCoordDelta(m); // sign cell non-negative -> follow-up stage
}
