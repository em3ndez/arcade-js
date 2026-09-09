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
 * stepHeadSegment -- advance the centipede's LEAD segment one step (ROM 0x2ec6). [code]
 *
 * ROLE. The head-slot handler of the per-segment walk. Where the trailing body cells are
 * carried by routeSegmentByRange, the lead segment gets this dedicated routine: it moves the
 * head one row forward, works out what tile the head is stepping onto, and stamps that grid
 * cell (this is how the head leaves/eats marks in the mushroom field as it travels). When the
 * head has nothing special to do it falls through to the shared tail spine (loc_3046), and an
 * empty destination cell drops it into the per-segment router seeded to the last slot.
 *
 * MECHANISM. The head coordinate loc_72 is first "folded" against the vertical direction
 * selector loc_ef (so one code path serves both travel directions) and hard band-gated — off
 * the playfield (>= 0xf3) it exits immediately. When the head lands exactly on the biased row
 * coordinate (a match against the target built from loc_73 / loc_f0) it decides whether to
 * fire a spawn tick or arm the channel-3 reload cell SFX_TIMER_CH3 (0xb4, [seen]) — the fire
 * decision reads either the IN1 input port or the POKEY hardware RNG, chosen by the owner slot
 * loc_86's sign. Then it rolls the head position forward, resolves the destination tile cell,
 * and — for a cell in the stampable mushroom band (>= 0x38) — writes a marker through the
 * working tile pointer TILEMAP_PTR_LO (0x32, [seen]), with two boundary codes handled
 * specially (reset the step cell + roll the path accumulator, then stamp empty).
 *
 * LIVE-OUT. May write SFX_TIMER_CH3, loc_8b, loc_72, loc_8d, and one tilemap cell; tail-calls
 * loc_3046, tickSpawnCadence, or routeSegmentByRange. m.regs.x is set to 0x0d on the router path.
 */
export function stepHeadSegment(m, x = m.regs.x) {
  const { mem8, mem16 } = m;

  // Fold the head coordinate against the vertical selector so a single path serves both travel
  // directions, then hard band-gate: a head that has run off the playfield exits to the tail spine.
  let head = mem8[loc_72];
  const sel = mem8[loc_ef];
  if (sel !== 0) head = u8(u8(head + 7) ^ 0xff);
  if (head >= 0xf3) return loc_3046(m); // out of band -> tail spine

  // Target match: the head has arrived on the biased row coordinate. At that moment the machine
  // decides between firing a spawn/step tick and arming the reload cell -- the choice reading a
  // control bit from IN1 (or, when the owner slot is disabled, from the hardware RNG for variety).
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

  // Roll the head one row forward, publishing the row it just left into the scratch cells $8b/$8d
  // that the cell-resolve step below reads.
  mem8[loc_8b] = mem8[loc_62];
  const prevRow = mem8[loc_72];
  mem8[loc_72] = u8((7 ^ mem8[loc_f4]) + mem8[loc_72]);
  mem8[loc_8d] = prevRow;

  // Resolve which grid cell the head is now over (row index 0) from the biased row coordinate. An
  // empty cell means there is nothing to stamp here, so hand off to the per-segment router.
  const probeCoord = u8((1 ^ mem8[loc_f3]) + mem8[loc_8d]);
  const cell = resolveTileCellAtXY(m, probeCoord, 0)[0];
  if (cell === 0) return (m.regs.x = 0x0d), routeSegmentByRange(m); // empty -> per-segment router

  // Only cells in the mushroom "stampable" band (>= 0x38 in the low six bits) get rewritten; a
  // lower code is left alone and the head exits to the tail spine.
  let code = cell & 0x3f;
  if (code < 0x38) return loc_3046(m); // below the stampable band -> tail spine
  code = u8(code - 1);

  // The two boundary codes (0x3b / 0x37, i.e. edges of the band) are special: reset the step cell
  // and advance the path accumulator, then the stamp source becomes loc_ef so the cell is left empty.
  let src;
  if (code === 0x3b || code === 0x37) {
    mem8[loc_8b] = 0x00;
    advancePathAccumulator(m, 0x01, x);
    src = mem8[loc_ef];
  } else {
    src = code;
  }

  // Write the new marker (folded against loc_ef) through the resolved tile pointer. If the stamp
  // came out empty, the neighbour count may have just dropped, so give it a chance to decay.
  const stamp = u8(src ^ mem8[loc_ef]);
  mem8[mem16[TILEMAP_PTR_LO]] = stamp; // write through the resolved pointer (row 0)
  if (stamp !== 0) return loc_3046(m);
  maybeDecrementTableEntry(m); // empty stamp -> maybe decay the neighbour count
  return loc_3046(m);
}
