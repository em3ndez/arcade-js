// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_333d — one frame of a 0x6400-array object's vertical excursion: while the object is on
 * foot, decide whether to set off for the other of the two heights its X is keyed to; while it
 * is travelling, watch for arrival.  ROM 0x333D.
 *
 * The record is the one loc_3202 points at, and its OBJ_STATE byte picks which half runs. What
 * those state values MEAN is fixed from OUTSIDE this routine — loc_3202 routes the same byte to
 * two other routines, and their bodies are what make the reading falsifiable:
 *
 *   0, 1, 2  -> loc_33ad, which steps the record's +0x0e one pixel and flips the sprite to match
 *               (names.js's role for 0x33AD calls +0x0e the object's working X)
 *   4, 8     -> loc_33e7, which instead moves the record's +0x0f Y base: one pixel DOWN the
 *               screen per frame in state 4, one pixel UP every third frame in state 8
 *
 * So 4 is a descent, 8 an ascent, and 0 is back on foot — and this routine is the switch between
 * them. It never moves the object itself; it only chooses a destination and a direction.
 *
 * SETTING OFF (the on-foot half). loc_33a1 guards it, and the one thing that stops this routine is
 * its height line: on 25m, 50m and 75m an object that has risen above that line abandons loc_333d
 * outright, while on 100m the height test does not apply at all and the routine always proceeds.
 * Past the guard the object's X is looked up in the type-0 object table by findOppositeLadderEnd, whose entries
 * pair each key with TWO bytes; the discriminator handed to it is the object's own Y base, so the
 * pair is a pair of heights and
 * findOppositeLadderEnd returns whichever one the object is NOT standing on. That byte becomes the destination
 * (+0x1f) and the tag becomes the direction: from the far slot the object goes up, from the near
 * slot it goes down — which is what makes the near slot of a pair the higher of the two. The
 * descent is conditional where the ascent is not: it is taken only while the object's Y base is
 * ABOVE Mario's row (smaller Y is higher on screen, per MARIO_Y), so an object already level with
 * Mario or below him never sets off downward.
 *
 * ARRIVING (the travelling half). Both travel states poll the same way — the Y base, biased by 8,
 * against the stored destination — and both drop back to 0 on the nose. They differ in exactly one
 * thing: the ASCENT alone, and only when the record's +0x19 holds 2, raises +0x1d. That single
 * asymmetry is the whole difference between the oracle's two near-identical arms.
 *
 * OPEN, and deliberately not guessed at: what the +8 bias measures from (it is applied identically
 * when forming the discriminator and when testing for arrival, so it cancels between them), and
 * what +0x19 and +0x1d select — loc_3202 also dispatches on +0x19 holding 2 (ROM 0x3219), so 2 is
 * a distinguished value of that byte, but nothing here says what it distinguishes.
 *
 * Memory-equivalent to the frozen oracle — equivalence-333d.test.js.
 * GATE:     captured + crafted + live. 0x333D IS naturally reached — 148 dispatches in a
 *           4000-frame attract run, every one on the 0x6400 record — and ALL of them are replayed.
 *           But attract only ever enters with the state byte 1 or 8, so on its own it reaches four
 *           arms: the ascent's not-yet-arrived poll, one unmarked ascent arrival, the table miss,
 *           and a single far-slot start. The whole descent side, the +0x1d mark, the guard's skip
 *           and the Mario test are NOT reached there and are carried by crafted entries planted on
 *           a real machine state; the gate asserts both lists, so neither can drift. A
 *           whole-attract LIVE run (this routine wired at 0x333D for 4000 frames) is the live-out
 *           measurement below. Teeth: eight broken twins, including the one that gives the descent
 *           the ascent's mark.
 * LIVE-OUT: memory only — the three record bytes it can write, +0x0d, +0x1d and +0x1f. No register
 *           and no flag survives, and the record pointer is left alone (its caller re-indexes the
 *           record through it at once).
 *           DERIVED: 0x333D has exactly ONE caller in the whole lift — loc_3202, at ROM 0x3230 —
 *           and all three of this routine's exits (its own, plus the two its callees unwind
 *           through) land on that caller's SAME continuation at 0x3233, which reloads the
 *           accumulator from the record and re-derives the flags before reading either; every path
 *           on from there (loc_33e7 through 0x3291, loc_33ad and loc_298c through 0x323B, and the
 *           shared tail at 0x3257) writes each remaining register before it reads it.
 *           MEASURED: the gate's LIVE test wires this routine at 0x333D for a 4000-frame attract
 *           run — 148 real dispatches — and the frame trace is byte-identical to the all-oracle
 *           baseline on every live cell outside STACK_SCRATCH; it stays byte-identical when every
 *           register EXCEPT the record pointer is deliberately clobbered on the way out, which is
 *           what makes the "no register live-out" half a measurement. Both runs restore the
 *           oracle's measured cycle cost — its own teeth case shows that without the charge the
 *           trace diverges at frame 1080, at 0x6019, on the NMI shift alone.
 * NAMES:    MARIO_Y and OBJ_STATE from names.js. The record's other fields (+0x0e, +0x0f, +0x19,
 *           +0x1d, +0x1f) have no names.js name and stay raw in-record offsets, as +0x0f does in
 *           loc_33a1. BOARD is read inside loc_33a1 and OBJ_PARAM_TABLE0 inside findOppositeLadderEnd; neither
 *           is touched here.
 */

import { u8 } from "../../../core/int.js";
import { MARIO_Y, OBJ_STATE } from "./names.js";
import { loc_33a1 } from "./loc_33a1.js"; // ROM 0x33A1 — the board gate + height guard
import { findOppositeLadderEnd } from "./findOppositeLadderEnd.js"; // ROM 0x236E — the keyed lookup that returns the other of a pair

// Record fields names.js does not name. +0x0e and +0x0f are the object's two axes (loc_33ad steps
// +0x0e as its working X; loc_33a1 tests +0x0f as its Y base).
const RECORD_X = 0x0e;
const RECORD_Y_BASE = 0x0f;
const RECORD_MODE = 0x19; // meaning open; only the value 2 is distinguished here
const RECORD_ARRIVAL_MARK = 0x1d; // raised on an ascent's arrival when +0x19 holds 2
const RECORD_DESTINATION = 0x1f; // the biased height this excursion ends at

// The OBJ_STATE values this routine reads and writes. 0/1/2 all walk; it writes only 0.
const STATE_ON_FOOT = 0;
const STATE_DESCEND = 4;
const STATE_ASCEND = 8;

// The Y base is offset by this much everywhere it is compared against a table height, both when
// asking which height to head for and when asking whether the object has got there.
const Y_BASE_BIAS = 8;

// How far into the type-0 object table the key may be looked for.
const TABLE_ENTRIES = 21;

/**
 * @param {object} m  the machine.
 * @param {number} recordBase  the object record to run, which arrives in the machine's record
 *   pointer. It must equal that pointer: loc_33a1 re-reads the pointer from the machine to run
 *   its own height test on the same record, and findOppositeLadderEnd takes its inputs in registers.
 */
export function loc_333d(m, recordBase = m.regs.ix /* oracle-boundary default: caller 0x3202 still frozen */) {
  const { regs, mem8 } = m;
  const at = (offset) => (recordBase + offset) & 0xffff;

  const state = mem8[at(OBJ_STATE)];

  // -- travelling: there is nothing to do until the Y base lands exactly on the destination --
  if (state === STATE_ASCEND || state === STATE_DESCEND) {
    if (u8(mem8[at(RECORD_Y_BASE)] + Y_BASE_BIAS) !== mem8[at(RECORD_DESTINATION)]) return;
    mem8[at(OBJ_STATE)] = STATE_ON_FOOT;
    // The one thing that separates the two travel states: only an ascent marks its arrival.
    if (state === STATE_ASCEND && mem8[at(RECORD_MODE)] === 2) mem8[at(RECORD_ARRIVAL_MARK)] = 1;
    return;
  }

  // -- on foot: an object that has risen above the guard's height line abandons this routine --
  if (!loc_33a1(m)) return;

  regs.d = u8(mem8[at(RECORD_Y_BASE)] + Y_BASE_BIAS); // the height the object is standing at
  regs.a = mem8[at(RECORD_X)]; // which pair of heights to look up
  regs.bc = TABLE_ENTRIES;
  if (!findOppositeLadderEnd(m)) return; // this X is paired with no heights — nothing to set off for

  const standingOnFarSlot = regs.a === 0; // the tag: which of the pair the object was on
  mem8[at(RECORD_DESTINATION)] = regs.b; // and the byte handed back is always the other one

  if (standingOnFarSlot) {
    mem8[at(OBJ_STATE)] = STATE_ASCEND;
    return;
  }
  // Setting off downward is conditional: only from above Mario, never from level with him or below.
  if (mem8[at(RECORD_Y_BASE)] >= mem8[MARIO_Y]) return;
  mem8[at(OBJ_STATE)] = STATE_DESCEND;
}
