// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import {
  loc_43, loc_62, loc_72, loc_73, loc_86, loc_8b, loc_8d,
  loc_ef, loc_f0, loc_f3, loc_f4,
  SFX_TIMER_CH3, TILEMAP_PTR_LO, IN1, POKEY_RANDOM,
} from "./names.js";
import { maybeDecrementTableEntry } from "./maybeDecrementTableEntry.js";
import { resolveTileCellAtXY } from "./resolveTileCellAtXY.js";
import { advancePathAccumulator } from "./advancePathAccumulator.js";
import { tickSpawnCadence } from "./tickSpawnCadence.js";
import { loc_3046 } from "./loc_3046.js";
import { routeSegmentByRange } from "./routeSegmentByRange.js";

/**
 * stepHeadSegment -- advance the lead segment one step. Range-gates the head coordinate against a
 * folded target; on a match it either drops the whole sweep into the spawn tick or arms the reload
 * cell, then rolls the head position, resolves the destination grid cell and stamps it. Falls into
 * the per-segment router for the trailing segments. [code]
 */
export function stepHeadSegment(m, x = m.regs.x) {
  const { mem8, mem16 } = m;

  // Fold the head coordinate against the vertical selector, then hard band-gate it.
  let head = mem8[loc_72];
  const sel = mem8[loc_ef];
  if (sel !== 0) head = u8(u8(head + 7) ^ 0xff);
  if (head >= 0xf3) return loc_3046(m); // out of band -> tail spine

  // Target match: the head equals the biased row coordinate.
  const target = u8((4 ^ mem8[loc_f0]) + mem8[loc_73]);
  if (target === mem8[loc_72]) {
    if ((mem8[loc_43] & 0xaf) !== 0) return tickSpawnCadence(m); // busy -> spawn tick
    x = mem8[loc_86]; // owner slot; its sign selects the dispatch source
    let bits = mem8[IN1];
    if (x & 0x80) bits = mem8[POKEY_RANDOM]; // disabled owner -> entropy source
    const probe = (sel === 0xc0) ? 0x08 : 0x04;
    if (bits & probe) return tickSpawnCadence(m); // probe hit -> spawn tick
    mem8[SFX_TIMER_CH3] = 0x0b; // arm the reload cell
  }

  // Roll the head position, publishing the prior row into $8b/$8d.
  mem8[loc_8b] = mem8[loc_62];
  const prevRow = mem8[loc_72];
  mem8[loc_72] = u8((7 ^ mem8[loc_f4]) + mem8[loc_72]);
  mem8[loc_8d] = prevRow;

  // Resolve the destination cell from the biased row (row index 0).
  const probeCoord = u8((1 ^ mem8[loc_f3]) + mem8[loc_8d]);
  const cell = resolveTileCellAtXY(m, probeCoord, 0)[0];
  if (cell === 0) return (m.regs.x = 0x0d), routeSegmentByRange(m); // empty -> per-segment router

  let code = cell & 0x3f;
  if (code < 0x38) return loc_3046(m); // below the stampable band -> tail spine
  code = u8(code - 1);

  // The two boundary codes reset the step cell and roll the path accumulator before stamping empty.
  let src;
  if (code === 0x3b || code === 0x37) {
    mem8[loc_8b] = 0x00;
    advancePathAccumulator(m, 0x01, x);
    src = mem8[loc_ef];
  } else {
    src = code;
  }

  const stamp = u8(src ^ mem8[loc_ef]);
  mem8[mem16[TILEMAP_PTR_LO]] = stamp; // write through the resolved pointer (row 0)
  if (stamp !== 0) return loc_3046(m);
  maybeDecrementTableEntry(m); // empty stamp -> maybe decay the neighbour count
  return loc_3046(m);
}
