// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2079 — retire the object record the movement branch was stepping, then hand the frame on
 *            to the shared object-sprite tail.  ROM 0x2079.
 *
 * One exit of the per-frame walk over the OBJ_ARRAY_67 records (ROM 0x1F72). Its only caller is
 * the active-movement branch at ROM 0x2053, which reaches here on one test it makes after the
 * collision step reports nothing: the record's OBJ_X, plus 8, below 16. That window is the eight
 * columns at the left edge (X 0..7) together with the eight that have wrapped past it
 * (X 248..255) — an object within 8 pixels of X = 0 either way. Both halves occur live: natural
 * attract reaches this routine at X = 248, a credited 1-player game at X = 7 (see the gate note).
 *
 * It clears two bytes of the record — OBJ_ACTIVE and OBJ_X — and jumps into the shared sprite tail
 * at ROM 0x21BA, which copies four of the record's fields into the walk's sprite destination and
 * re-enters the walk's loop advance. So the retired record still contributes a sprite this frame,
 * with X = 0; it drops out of the walk from the NEXT frame, because the walk's per-slot check at
 * ROM 0x1F83 admits only a record whose OBJ_ACTIVE holds 1.
 *
 * The reading that this retires an object which has run out of playfield on the left rests on the
 * CALLER's window and on the WALK's per-slot check, not on this routine's own body — the body
 * itself tests nothing and clears the two bytes unconditionally. What is NOT established here is
 * what the OBJ_ARRAY_67 records hold on the boards where this fires, so the routine keeps its loc_
 * name. The gate saw it live on records 1 and 5 of that array, and nowhere else.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2079.test.js.
 * GATE:     captured + crafted + live. 0x2079 is reached naturally but RARELY: 2 dispatches in a
 *           6000-frame attract run and 2 more in a 6000-frame credited 1-player game (asserted,
 *           not sampled — ALL FOUR are replayed), covering both edges of the caller's window and
 *           two different record bases. Everything else is crafted on those real captures: a
 *           1024-entry sweep over all 256 OBJ_X values crossed with four OBJ_ACTIVE values, the
 *           record pointer moved to each of the ten OBJ_ARRAY_67 bases, and a whole-record
 *           fingerprint check that no third byte moves. A LIVE test wires this routine at 0x2079
 *           for a 6000-frame attract run and diffs the frame trace against the all-oracle
 *           baseline. Teeth: five broken twins.
 * LIVE-OUT: memory + pc + SP + the propagated return value — and NO register, NO flag.
 *           DERIVED: 0x2079 has exactly ONE caller in the frozen tree — loc_2053, whose jump at
 *           ROM 0x2065 is the sole `m.call(0x2079)` anywhere in translated/, and being a jump,
 *           control never comes back to it. This routine's own exit is a jump too, so the sole
 *           continuation is ROM 0x21BA onward. The oracle's zeroed accumulator is overwritten one
 *           instruction into that continuation, at ROM 0x21BB, before anything reads it.
 *           Its flags survive a little further — ROM 0x21BF rewrites all of them but the carry,
 *           ROM 0x1F8E rewrites the carry — but the first conditional anywhere on that path is
 *           the walk's loop-counter test at ROM 0x1F90, which reads the counter and not a flag.
 *           So neither the accumulator nor any flag is ever read, and both are dropped rather
 *           than modelled.
 *           MEASURED, because "dead" is a claim and not an observation: the gate runs the REAL
 *           routine with the accumulator and the whole flag byte poisoned at the exact instant of
 *           the hand-off, once, leaving the frozen tail otherwise untouched. That is identical to
 *           the oracle on all four captured entries and on five crafted positions — and the gate
 *           shows the probe is not inert by aiming the same mechanism at the record pointer,
 *           which IS caught. pc and SP need no fixup: the tail chain runs on both sides and nets
 *           out the caller's return by itself (both end at ROM 0x1986 with the same SP).
 * NAMES:    OBJ_ACTIVE (+0) and OBJ_X (+3) are imported from names.js; OBJ_ARRAY_67 names the array
 *           those records belong to and is used by the gate rather than here, since this routine
 *           reaches its record only through the caller's pointer and holds no address of its own.
 *           ROM 0x21BA is still frozen and is reached with m.call — it belongs to the same
 *           mutually-recursive object-walk cluster as this routine and is being decompiled
 *           alongside it, so dissolving that call is a later coordinated step.
 */

import { OBJ_ACTIVE, OBJ_X } from "./names.js";

/**
 * @param {object} m  the machine.
 * @param {number} recordBase  the object record to retire, which arrives in the machine's record
 *   pointer. It must equal that pointer: the shared sprite tail re-reads the pointer from the
 *   machine to copy the record's remaining fields, and the walk advances it to the next record.
 * @returns {*} whatever the shared tail's chain returns — undefined on every observed dispatch;
 *   propagated so a skip further down the walk cannot be swallowed here.
 */
export function loc_2079(m, recordBase = m.regs.ix /* oracle-boundary default: caller 0x2053 still frozen */) {
  const { mem8 } = m;

  // Take the record out of the walk, and park it at the left edge for this frame's sprite.
  mem8[recordBase + OBJ_ACTIVE] = 0;
  mem8[recordBase + OBJ_X] = 0;

  // On into the shared object-sprite tail (still the frozen oracle).
  return m.call(0x21ba);
}
