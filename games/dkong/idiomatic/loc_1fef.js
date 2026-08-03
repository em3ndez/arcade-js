// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1fef — the object-sweep arm that decrements one object's X and hands the shared
 * tail the two direction constants that go with a decrement.  ROM 0x1FEF.
 *
 * ROM 0x1F72 sweeps the ten records of OBJ_ARRAY_67 and, for each record whose OBJ_ACTIVE
 * field is 1, dispatches on two other record fields to one of five arms (ROM 0x1F93).
 * This is the arm selected by bit 2 of record field +2. It does three things and then
 * falls straight through into the shared tail at ROM 0x1FF6, which is where all the work
 * downstream of it happens:
 *
 *   • swaps the register file to its alternate bank. The sweep keeps its loop state —
 *     sprite-buffer pointer, record pointer, stride and remaining count — in the main
 *     bank, so every arm works in the alternate one; all five open with this swap, and
 *     the shared object-sprite tail at ROM 0x21BA swaps back before it hands control to
 *     the sweep's advance step.
 *   • loads the two direction constants the tail passes on.
 *   • decrements the record's X field (OBJ_X).
 *
 * WHY 255 AND 4 GO WITH A DECREMENT. The tail hands the first constant to
 * snapYToGirder (ROM 0x2333) as its `step` selector, along with the X this routine just
 * wrote and the record's Y. snapYToGirder moves Y one pixel along the girder slope only
 * on the frame X lands on a 16-pixel cell boundary, and WHICH edge counts is what
 * `step` picks: `step == 1` fires at cell offset 0, any other value fires at cell offset
 * 15. An object walking X downwards enters a new cell when its X reaches offset 15, one
 * walking X upwards when it reaches offset 0 — so the not-1 selector is the one that
 * belongs with a decrement. The twin arm at ROM 0x1FE5 is the confirmation: it is this
 * routine with the increment and the other pair of constants (1 and 0), and 1 is
 * exactly the selector snapYToGirder fires at offset 0. The second constant is a
 * direction code loc_23de (ROM 0x23DE) folds into its orientation-lookup selector as
 * `3 | code`; this arm's 4 and the twin's 0 select different halves of that table.
 *
 * NOT CLAIMED: which way an object visibly moves under this arm. "Decrementing X" is
 * the record field, and the screen is rotated; nothing here establishes whether that
 * reads as left, right, up or down, and the direction code's 4-vs-0 was traced only as
 * far as the lookup selector, not to a sprite orientation.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1fef.test.js.
 * GATE:     captured + crafted + live, all ATTRACT; gameplay is not covered by any case
 *           here. A 3000-frame attract run dispatches this routine 1967 times, over the
 *           7 records attract makes live and 22 distinct entry shapes (record base × the
 *           branch class the decremented X puts the tail into) — ALL 1967 are replayed
 *           against the oracle with the real tail in place, so there is no sampling and
 *           no shape left out. Because that end-to-end effect is produced by the frozen
 *           tail rather than by this routine, a crafted case pins the handoff itself:
 *           with ROM 0x1FF6 replaced by a recording stub and both register banks poisoned
 *           to distinct values, all 256 X values are swept on a real captured base and
 *           the twelve bank registers, A, IX, SP and the written X byte are compared
 *           field by field. The rewrite is then wired live at 0x1FEF for a 3000-frame
 *           attract run, byte-identical per frame against the all-oracle baseline.
 *           Teeth: a dropped bank swap, an increment instead of a decrement, the twin
 *           arm's constant pair, and a dropped X write.
 * LIVE-OUT: the bank swap, the two constants in the alternate bank, the decremented
 *           OBJ_X byte, and whatever the shared tail returns — propagated unchanged
 *           rather than assumed, since the tail's own arms forward the return of four
 *           further frozen routines. Over 3000 attract frames all 1967 dispatches
 *           returned `undefined`, and the gate compares the value on every one. The
 *           ONLY thing this rewrite drops is the condition flags the memory decrement
 *           defines. DERIVED: control falls into ROM 0x1FF6, which masks the X field to
 *           its low three bits before its first conditional — that redefines every flag,
 *           so none this routine sets is ever read. This does not depend on who called:
 *           0x1FEF has exactly one caller (ROM 0x1F93, a tail jump) and it is the tail,
 *           not the caller, that consumes the flags. MEASURED: the gate scrambles the
 *           flags at the ROM 0x1FF6 handoff on every dispatch across a 3000-frame
 *           attract run and the trace stays byte-identical. That measurement is a
 *           superset — it also scrambles the twin arm's flags — and is reported as such.
 * NAMES:    OBJ_X (record +3) is the one ram.js name imported. OBJ_ARRAY_67 and
 *           OBJ_ACTIVE appear in the prose above but are not referenced in code: this
 *           routine reaches its record through the pointer the sweep supplies and never
 *           forms the array base or reads the active flag itself. ROM 0x1FF6 is still
 *           the frozen oracle and is reached through m.call — this routine falls INTO it
 *           rather than calling it, so there is no return address to push beside it, and
 *           the m.call dissolves into a direct call once 0x1FF6 is decompiled.
 */

import { OBJ_X } from "./ram.js";

// The shared tail this arm falls into. Still the frozen oracle.
const SHARED_TAIL = 0x1ff6;

// The slope-step selector the tail hands to snapYToGirder. Only "is it 1" reaches
// snapYToGirder, which fires at cell offset 15 for every other value; the twin arm at
// ROM 0x1FE5 passes 1.
const SLOPE_STEP_SELECTOR = 255;

// The direction code the tail hands to loc_23de, which uses it as `3 | code` to pick a
// half of its orientation lookup. The twin arm passes 0.
const ORIENTATION_DIRECTION = 4;

/**
 * @param {object} m  the machine (memory and the register file the frozen tail reads).
 * @param {number} objBase  base address of the object record being stepped.
 * @returns whatever the shared tail returns, unchanged.
 */
export function loc_1fef(
  m,
  objBase = m.regs.ix /* oracle-boundary default: caller 0x1F93 still frozen */,
) {
  const { mem8, regs } = m;

  // Work in the alternate bank so the sweep's loop state survives; ROM 0x21BA swaps back.
  regs.exx();

  regs.b = SLOPE_STEP_SELECTOR;
  regs.c = ORIENTATION_DIRECTION;

  mem8[objBase + OBJ_X] = mem8[objBase + OBJ_X] - 1;

  return m.call(SHARED_TAIL);
}
