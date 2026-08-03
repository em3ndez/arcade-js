// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_3202 — service one record of the 0x6400 object array: route it through the state
 * machine its own state selects, then publish its working position into the drawn one.
 * ROM 0x3202.
 *
 * The record is handed over through OBJ_ITER_PTR (the iterator at ROM 0x31B1 stores the
 * pointer there and then calls here), and every callee below reads it back out of the
 * machine, so it is held in the machine's record register rather than in a local. The ROM
 * re-reads OBJ_ITER_PTR at three points; each re-read is reproduced.
 *
 * Three things happen, in order:
 *
 *   1. ROUTING. An object whose OBJ_INSERT_REQUESTED is 1 goes straight to the board-keyed
 *      object walker (loc_32bd) and nothing else here runs. Otherwise, an object on the LOW
 *      side of the state split (isHighState below) gets one of two timer ticks first — loc_32d6
 *      when its +0x19 field holds 2, loc_330f otherwise — and only the loc_330f branch, and
 *      only on a pass that finds the low two bits of RANDOM clear, goes on to the
 *      movement/collision state machine at ROM 0x333D. A state that has come back to 0 skips
 *      straight to step 3.
 *   2. MOVEMENT. An object on the HIGH side of the state split runs loc_33e7 (animation + step
 *      counter). On the low side, loc_33ad steps the working X one pixel the way OBJ_STATE
 *      points, and loc_298c then judges the tile ahead of the new position: out of band and the
 *      step is UNDONE and the travel direction reversed; in band and only the two X edges can
 *      re-arm the direction — below 16 it is set to travel X-up, at or above 240 to travel
 *      X-down.
 *   3. PUBLISH. The working coordinates become the drawn ones: OBJ_X takes the working X
 *      unchanged, and OBJ_Y takes the working Y plus one byte fetched from a ROM table at
 *      0x3A7A. The record's own +0x13 field is the index into that table and counts DOWN
 *      each pass, reloading to 17 when it reaches 0.
 *
 * WHICH FIELDS THESE ARE, corroborated from outside this routine. ram.js grounds OBJ_X (+3)
 * and OBJ_Y (+5) live as the DRAWN coordinates (gatherSpriteRecords copies them into the
 * sprite record), so the two stores at the end are a publish, not another working step. Its
 * sibling loc_33ad — written from the other side — names the same pair of record fields as the
 * sources of exactly these two stores, and reports +0x0E measured equal to OBJ_X on all 309 of
 * its own real attract dispatches. The travel-direction reading agrees with loc_33ad
 * independently: it reads state 1 as the one that steps the working X UP, and the two arms here
 * move X the OPPOSITE way from the state they then write, which is what an undo-and-reverse
 * must do. That the record belongs to the 0x6400 array is ram.js's own OBJ_ITER_PTR entry,
 * which names this routine as one of the two that re-load the iterator.
 *
 * WHAT IS NOT ESTABLISHED: what the 0x3A7A table means, and therefore what the +0x13
 * countdown selects — only that its byte is added to the working Y on the way to the drawn Y.
 * Nor which object of the 0x6400 array this services; that is whatever the iterator points at.
 *
 * NAME: kept the neutral loc_ — the mechanism is pinned to the oracle, but the object and the
 * table are not established to the routine-name bar. Promote once corroborated.
 *
 * Memory-equivalent to the frozen oracle — equivalence-3202.test.js.
 * GATE:     captured + crafted, ATTRACT ONLY — no gameplay board is covered. Measured: 0x3202
 *           is first dispatched at frame 870 and fires 481 times in a 3000-frame attract run,
 *           always on record base 0x6400, with OBJ_STATE only ever 0, 1 or 8 at entry and the
 *           +0x19 field always 0; the gate replays a sample of those covering every entry shape
 *           the run produced. THREE arms attract never reaches: the +0x19 timer branch, the
 *           out-of-band reverse, and the HIGH working-X edge. Those, and the state values
 *           attract never shows (2, 3, 4, 131, 132, 255), are crafted on a real captured
 *           dispatch and poked identically on both sides. The compare is RAM minus STACK_SCRATCH,
 *           plus the return value; pc and SP are NOT compared (the direct-call layer models no
 *           Z80 stack). Teeth: five broken twins, each observed failing.
 * LIVE-OUT: memory-only, plus the void return. Derived: 0x3202 has exactly ONE caller in the
 *           whole frozen layer — ROM 0x31CD inside loc_31b1 — and its very next instruction
 *           reloads the accumulator from its loop counter and recomputes the flags from it, so
 *           the oracle's residual registers and the flags live at its 0x3279 exit are dead ABI;
 *           the record register is dead too (the loop re-reads its pointer from OBJ_ITER_PTR).
 *           This live-out is DERIVED; there is no committed live-wire arm in this gate to
 *           corroborate it.
 * NAMES:    OBJ_ITER_PTR (0x63C8), RANDOM (0x6018), OBJ_INSERT_REQUESTED (+0x18),
 *           OBJ_STATE (+0x0D), OBJ_X (+3), OBJ_Y (+5) — from ram.js. Record fields +0x0E, +0x0F,
 *           +0x13 and +0x19 have no ram.js name and stay local consts, as in loc_33ad/loc_33c3.
 *           Direct-called: loc_32bd (0x32BD), loc_32d6 (0x32D6), loc_330f (0x330F),
 *           loc_33ad (0x33AD), loc_298c (0x298C), loc_33e7 (0x33E7), loc_33c3 (0x33C3).
 *           ORACLE BOUNDARY: the movement/collision state machine at ROM 0x333D has no
 *           idiomatic twin in ROUTINES yet, so it is still reached through the registry and the Z80 call
 *           bracket its two skip-capable callees unwind through is still pushed by hand.
 */

import { u8 } from "../../../core/int.js";
import {
  OBJ_INSERT_REQUESTED, OBJ_ITER_PTR, OBJ_STATE, OBJ_X, OBJ_Y, RANDOM,
} from "./ram.js";
import { loc_298c } from "./loc_298c.js"; // ROM 0x298C — is the tile ahead outside the accepted band?
import { loc_32bd } from "./loc_32bd.js"; // ROM 0x32BD — board-keyed object-walker dispatch
import { loc_32d6 } from "./loc_32d6.js"; // ROM 0x32D6 — interval down-counter + periodic tick
import { loc_330f } from "./loc_330f.js"; // ROM 0x330F — periodic timer tick
import { loc_33ad } from "./loc_33ad.js"; // ROM 0x33AD — one-pixel X step + sprite/animation work
import { loc_33c3 } from "./loc_33c3.js"; // ROM 0x33C3 — 25m girder-slope re-snap
import { loc_33e7 } from "./loc_33e7.js"; // ROM 0x33E7 — animation step + step-counter nudge

// Object-record fields with no ram.js name; kept as local offsets, as loc_33ad and loc_33c3 do.
const OBJ_WORKING_X = 0x0e;      // working X, published to OBJ_X below (loc_33ad steps it)
const OBJ_WORKING_Y = 0x0f;      // working Y, published to OBJ_Y below (loc_33c3 re-snaps it)
const OBJ_Y_OFFSET_INDEX = 0x13; // index into the 0x3A7A table; counts down, reloads at 0
const OBJ_FIELD_19 = 0x19;       // routes to loc_32d6 when it holds 2; loc_32d6 clears it

// ROM table whose byte is added to the working Y to make the drawn OBJ_Y. What the table
// holds, and so what the index above selects, is not established.
const Y_OFFSET_TABLE = 0x3a7a;
const Y_OFFSET_INDEX_RELOAD = 17;

// Travel directions the state field carries on this array. loc_33ad reads state 1 as the one
// that steps the working X up; every other state steps it down.
const TRAVEL_X_UP = 1;
const TRAVEL_X_DOWN = 2;

// The two X positions that re-arm the travel direction: below the low edge the object is sent
// back up, at or above the high edge it is sent back down.
const X_LOW_EDGE = 16;
const X_HIGH_EDGE = 240;

// The ROM's high/low split on the state field is a test of bit 7 of (state - 4), so states
// 4..131 count as high and 0..3 together with 132..255 count as low. Written at the ROM's full
// width rather than narrowed to the {0,1,2,4,8} enum the array is grounded on.
const isHighState = (state) => (u8(state - 4) & 0x80) === 0;

// The address the still-frozen state machine at 0x333D returns to. It is pushed by hand because
// two of that routine's own callees can return by unwinding PAST it, straight to this address.
const RETURN_FROM_333D = 0x3233;

/**
 * @param {object} m  the machine. The record pointer arrives in memory (OBJ_ITER_PTR), not in
 *                    a register, so there is no register live-in to promote to a parameter.
 * @returns {void}
 */
export function loc_3202(m) {
  const { regs, mem8, mem16 } = m;

  // The record the iterator is pointing at. Held in the machine's record register because the
  // callees below take it from there rather than as an argument.
  const loadRecord = () => { regs.ix = mem16[OBJ_ITER_PTR]; };
  const field = (off) => (regs.ix + off) & 0xffff;

  // Step 3: publish the working position into the drawn position, and step the table index.
  function publishPosition() {
    const index = mem8[field(OBJ_Y_OFFSET_INDEX)];
    const next = index === 0 ? Y_OFFSET_INDEX_RELOAD : index - 1;

    mem8[field(OBJ_Y_OFFSET_INDEX)] = next;
    mem8[field(OBJ_X)] = mem8[field(OBJ_WORKING_X)];
    mem8[field(OBJ_Y)] = mem8[Y_OFFSET_TABLE + next] + mem8[field(OBJ_WORKING_Y)];
  }

  // The move was rejected: undo the pixel loc_33ad just stepped and reverse the travel
  // direction, then let the 25m girder-slope tail re-snap the working Y under the new X.
  function reverseTravel() {
    loadRecord();
    if (mem8[field(OBJ_STATE)] === TRAVEL_X_UP) {
      mem8[field(OBJ_WORKING_X)] = mem8[field(OBJ_WORKING_X)] - 1;
      mem8[field(OBJ_STATE)] = TRAVEL_X_DOWN;
    } else {
      mem8[field(OBJ_WORKING_X)] = mem8[field(OBJ_WORKING_X)] + 1;
      mem8[field(OBJ_STATE)] = TRAVEL_X_UP;
    }
    loc_33c3(m);
    publishPosition();
  }

  // Step 2: the movement update — every routing path that has not already returned ends here.
  function stepMovement() {
    if (isHighState(mem8[field(OBJ_STATE)])) {
      loc_33e7(m);
      publishPosition();
      return;
    }

    // One pixel along, then judge the tile the object is now heading into.
    loc_33ad(m);
    if (loc_298c(m)) {
      reverseTravel();
      return;
    }

    // Accepted. Only the two X edges can re-arm the direction from here.
    loadRecord();
    const workingX = mem8[field(OBJ_WORKING_X)];
    if (workingX < X_LOW_EDGE) mem8[field(OBJ_STATE)] = TRAVEL_X_UP;
    else if (workingX >= X_HIGH_EDGE) mem8[field(OBJ_STATE)] = TRAVEL_X_DOWN;
    publishPosition();
  }

  // Step 1: routing.
  loadRecord();

  // An insert-pending object is the walker's business only.
  if (mem8[field(OBJ_INSERT_REQUESTED)] === 1) {
    loc_32bd(m);
    return;
  }

  if (!isHighState(mem8[field(OBJ_STATE)])) {
    if (mem8[field(OBJ_FIELD_19)] === 2) {
      loc_32d6(m);
    } else {
      loc_330f(m);
      // Only a pass that finds the low two bits of RANDOM clear may reach the state machine;
      // every other pass goes straight on to the movement update.
      if ((mem8[RANDOM] & 0x03) !== 0) {
        stepMovement();
        return;
      }
    }

    // Both timer ticks can reset the state to 0, and an object back at 0 has nothing to move.
    if (mem8[field(OBJ_STATE)] === 0) {
      publishPosition();
      return;
    }
  }

  // The movement/collision state machine, still the frozen oracle. It has two callees that
  // return by unwinding past it to this exact point, so the call bracket is pushed by hand and
  // execution continues here whether it finished or bailed — either way the machine is back
  // here and the object state below is read as it left it.
  m.push16(RETURN_FROM_333D);
  m.call(0x333d);

  stepMovement();
}
