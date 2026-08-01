// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_281d — test the active special-object record against the board's hazards and,
 * on an overlap, record where it was found.  ROM 0x281D.
 *
 * Scans the two-record special-object pair for the first ACTIVE record (bit0 of the
 * record's +1 flag byte set), stepping 16 bytes between the two. If neither is active
 * it does nothing. When one is active, its position (record +9/+10 as the low/high
 * position bytes, record +5 as the sweep-compare coordinate, and the record itself as
 * the base the handler reads +3 from) is handed to the current board's collision
 * handler, which sweeps that board's hazard object arrays for one overlapping the
 * record.
 *
 * The handler reports a byte: 0 for no overlap (this routine then does nothing), or
 * nonzero for a hit. On a hit it records four things about the collided hazard:
 *   - the nonzero hit marker itself,
 *   - the index of the hit object within the sweep array that found it — the array's
 *     initial count (OBJ_SEARCH_COUNT, stamped by the handler) minus the count still
 *     left when the hit fired,
 *   - the low byte of that array's record stride,
 *   - the base address of that array.
 *
 * NAME: kept the neutral loc_ — the scan/dispatch/record mechanism is pinned to the
 * oracle, but the four destination cells are unnamed shared engine scratch and which
 * game event consumes them is not confirmed to the routine-name bar. Promote once
 * corroborated.
 *
 * Memory-equivalent to the frozen oracle — equivalence-281d.test.js.
 * GATE:     captured — 0x281D is dispatched every frame by the object-update cascade
 *           (loc_197a, ROM 0x19B9). Real attract dispatches span all three arms: the
 *           no-active-record early-out, found-but-no-overlap, and the found+overlap
 *           record-writing path (all reached in attract). The full oracle board handler
 *           runs on BOTH sides, so a wrong marshalled field or a live register the folded
 *           call would have supplied surfaces as divergent RAM. The RAM diff excludes the
 *           dead STACK_SCRATCH the folded rst-0x28 trampoline (inside dispatchBoardCollision)
 *           leaves its table-base word in. Teeth: a twin that drops the hit-index subtraction
 *           and a twin that stores the wrong array base.
 * LIVE-OUT: memory-only. The caller (loc_197a) issues its next call without reading any
 *           register this leaves behind, so the residual registers/flags and the terminal
 *           return are dead ABI. pc/SP net from the handler's own return plus the routine's
 *           terminal return, so both are checked too.
 * NAMES:    OBJ_PAIR_6680 (0x6680) and OBJ_SEARCH_COUNT (0x63B9) from ram.js. The four
 *           destination cells (0x6350/0x6354/0x6353/0x6351) are unnamed shared scratch and
 *           stay hex. The 0x283E return marker is a ROM code address, not work RAM, so hex.
 */

import { OBJ_PAIR_6680, OBJ_SEARCH_COUNT } from "./ram.js";
import { dispatchBoardCollision } from "./dispatchBoardCollision.js"; // ROM 0x286F

// Stride between the two records of the special-object pair.
const RECORD_STRIDE = 0x10;

// Return marker the board collision handler unwinds to. dispatchBoardCollision is
// idiomatic in form but routes to the still-TRANSLATED per-board handlers, whose object
// search returns by popping the stack — on a hit via an inc-sp/inc-sp/ret caller-skip,
// on a miss via a normal ret. So this is a genuine oracle boundary: the handler needs a
// return address on the stack, and this routine must supply it exactly as the oracle
// call site does (its own push16). It is NOT a dissolvable call-return bracket — dropping
// it makes the handler pop the wrong word and unwind two bytes off. It dissolves only once
// those handlers (sub_2880/28b0/28e0/2901, entry_2913) are decompiled bottom-up. A ROM
// code address, kept hex.
const HANDLER_RETURN = 0x283e;

export function loc_281d(m) {
  const { regs, mem } = m;

  // Find the first active record of the pair (bit0 of its +1 flag byte set).
  let recordPtr = OBJ_PAIR_6680;
  let active = false;
  for (let i = 0; i < 2; i++) {
    if ((mem.read8(recordPtr + 1) & 0x01) !== 0) { active = true; break; }
    recordPtr += RECORD_STRIDE;
  }
  if (!active) { m.ret(); return; }

  // Marshal the active record's position into the registers the still-oracle board
  // handler reads: the compare coordinate, the pushed position, and the record base it
  // reads +3 from.
  regs.iy = recordPtr;
  regs.c = mem.read8(recordPtr + 5);
  regs.h = mem.read8(recordPtr + 9);
  regs.l = mem.read8(recordPtr + 10);

  // Dispatch to the current board's collision handler. It leaves the hit/miss byte in A,
  // the sweep counter in B, the hit array's stride low byte in E, and the hit array's
  // base in IX.
  m.push16(HANDLER_RETURN);
  dispatchBoardCollision(m);

  // No overlap: nothing to record.
  const overlap = regs.a;
  if (overlap === 0) { m.ret(); return; }

  // Record the collided hazard: the marker, the hit's index within its sweep array
  // (array count minus the count still left when it fired), the array's stride low byte,
  // and the array's base.
  mem.write8(0x6350, overlap);
  mem.write8(0x6354, mem.read8(OBJ_SEARCH_COUNT) - regs.b);
  mem.write8(0x6353, regs.e);
  mem.write16(0x6351, regs.ix);
  m.ret();
}
