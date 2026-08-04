// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_33c3 — on 25m only, advance one object-record coordinate by a single girder step.
 * ROM 0x33C3.
 *
 * A short tail shared with the field-adjust routine at 0x33AD, which has no return of its
 * own and FALLS THROUGH into this body: guarded on the board selector being 25m, it
 * re-steps one coordinate of the object the caller pointed at. It reads the companion
 * coordinate (record +0x0E), the coordinate to step (record +0x0F) and the per-object
 * state/direction byte (record +0x0D = OBJ_STATE), hands them to snapYToGirder — the
 * girder-slope single-step — and stores the stepped result back into +0x0F. On any board
 * other than 25m it does nothing (the 0x33AD field work still happens, but this step is
 * gated).
 *
 * The object-record pointer arrives from the caller at the oracle boundary (both callers,
 * 0x32AB and the fall-through from 0x33AD, are still frozen oracles and hand the record
 * over in a register), so this reads that pointer from the machine rather than as a
 * promoted parameter; that dissolves once those callers are decompiled.
 *
 * NAME: kept the neutral loc_ — the step mechanism is pinned to the oracle, but which
 * object this services and the meaning of record fields +0x0E/+0x0F are not established to
 * the routine-name bar. Promote once corroborated.
 *
 * Memory-equivalent to the frozen oracle — equivalence-33c3.test.js.
 * GATE:     crafted dispatches on a real attract-base machine — the board-guard skip on
 *           every non-25m selector, and the 25m step path swept across snapYToGirder's arms
 *           (boundary hold vs step, both sentinel coordinates, both slope directions, both
 *           travel directions), cross-checked against snapYToGirder itself. 0x33C3 has no natural
 *           attract dispatch (it is reached only from the still-oracle 0x32AB / 0x33AD), so
 *           there is nothing to capture. The RAM diff excludes the dead STACK_SCRATCH the
 *           oracle's push16/ret churn writes. Teeth: a twin that drops the board guard and a
 *           twin that swaps snapYToGirder's two coordinates.
 * LIVE-OUT: memory-only — the single stored coordinate at record +0x0F. The oracle's
 *           residual registers/flags and its terminal return are dead ABI; the board-guard
 *           early-out replaces its `ret nz`.
 * NAMES:    BOARD (0x6227), OBJ_STATE (record +0x0D) — from names.js; snapYToGirder (ROM 0x2333),
 *           direct-called with the two coordinates + the state byte. Record fields +0x0E and
 *           +0x0F have no names.js offset name yet and stay local consts here.
 */

import { BOARD, OBJ_STATE } from "./names.js";
import { snapYToGirder } from "./snapYToGirder.js"; // ROM 0x2333 — girder-slope single-step (pure)

// Object-record fields addressed off the record pointer; neither has a shared OBJ_* offset
// name in names.js. Per snapYToGirder's contract, +0x0E is the companion coordinate (its low nibble
// is the sub-cell position) and +0x0F is the coordinate stepped, then stored back.
const OBJ_COMPANION_COORD = 0x0e;
const OBJ_STEPPED_COORD = 0x0f;

const BOARD_25M = 0x01; // this tail runs only on the 25m board

export function loc_33c3(m) {
  const { regs, mem } = m;

  // 25m only — on any other board the oracle's `cp 1 / ret nz` returns without touching RAM.
  if (mem.read8(BOARD) !== BOARD_25M) return;

  // The object-record pointer the caller supplied (oracle boundary).
  const objBase = regs.ix;

  const companion = mem.read8((objBase + OBJ_COMPANION_COORD) & 0xffff);
  const coord = mem.read8((objBase + OBJ_STEPPED_COORD) & 0xffff);
  const state = mem.read8((objBase + OBJ_STATE) & 0xffff);

  // Advance the coordinate by one girder step (or hold on a non-boundary frame), then store
  // the result back into the same field.
  mem.write8((objBase + OBJ_STEPPED_COORD) & 0xffff, snapYToGirder(companion, coord, state));
}
