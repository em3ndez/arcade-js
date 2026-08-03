// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1f72 — the board gate in front of the per-frame object walk: on 25m only, aim the walk at
 * the ten OBJ_ARRAY_67 records and hand it the sprite cursor that runs alongside them.  ROM 0x1F72.
 *
 * Read: BOARD (0x6227) — the only cell this routine touches. Written: none of its own; every write
 * the dispatch produces is made by the still-frozen walk it falls into.
 *
 * WHAT IT DOES. One caller reaches it — the shared per-frame update cascade at ROM 0x197A, which
 * calls it once a frame and discards its result. If BOARD is not 1 it returns at once, so 50m, 75m
 * and 100m never run the walk at all. On 25m it seeds the walk's four working values and falls
 * through into it at ROM 0x1F83: the record it starts on, the sprite cursor, the distance from one
 * record to the next, and how many records are left.
 *
 * The two strides pair one object record with one 4-byte sprite record, which is what makes the
 * cursor's start address meaningful rather than incidental: across the ten iterations the frozen
 * walk advances the record pointer by 32 (ROM 0x1F8E) and the cursor by 4 (four single-byte
 * increments at ROM 0x1F8A-0x1F8D), so the cursor sweeps exactly 0x6980-0x69A7 — the ten stride-4
 * records ram.js names ACTOR_SPRITES. Only the low byte is incremented, so the sweep cannot leave
 * that page: the gate measures the cursor ending at 0xA8 low, one past the tenth record.
 *
 * OPEN QUESTION, deliberately left open: ram.js's ACTOR_SPRITES entry names one routine (ROM
 * 0x2E04) against that block, and this routine also starts its cursor there. Which of them owns
 * which bytes, and whether they write disjoint records, the same records, or in some order that
 * matters, was NOT determined here — nothing in this file should be read as settling it.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1f72.test.js.
 * GATE:     ATTRACT, plus a poke on top of attract state. Attract runs the 25m arm ONLY: MEASURED
 *           616 dispatches in 1200 frames and 1532 in 4000, every one of them at BOARD == 1, so
 *           the early return is never taken naturally and attract is not evidence about it. Every
 *           one of the 616 is replayed inline (no sampling), oracle against rewrite on independent
 *           clones. The other arm is covered two ways: crafted entries built on real captures with
 *           BOARD poked identically on both sides to 0, 2, 3 and 4, and a whole-run live check with
 *           BOARD held at 2 from frame 400, which turns all 616 dispatches into early returns.
 *           No credited game, no second player, no board this routine would actually run on other
 *           than 25m — 50m/75m/100m are reached here only by poking BOARD, which is itself the
 *           byte under test.
 *           The unit diff is the FULL state dump INCLUDING STACK_SCRATCH. That is deliberate and
 *           it is what the choice buys: this rewrite keeps the oracle's boundary call into the
 *           frozen walk, so both sides push and pop identically and a dropped bracket has nowhere
 *           to hide. pc and SP are compared for the same reason, and so are all 19 CPU register
 *           fields on the 25m arm — the frozen walk owns every one of them from the hand-off on,
 *           so they must agree exactly.
 * LIVE-OUT: nothing in the registers, and no return value: MEASURED across all 616 attract
 *           dispatches the oracle returns `undefined` every time, and its one caller (ROM 0x197A)
 *           ignores the result. Derived from that caller's continuation at ROM 0x1986, which is a
 *           call to loc_2c8f: its first act is to load the accumulator with a constant and its
 *           second is a gate that takes the accumulator as its argument, so neither the
 *           accumulator this routine's compare leaves behind nor the flags that compare set are
 *           read anywhere downstream. On the 25m arm the question does not arise — the frozen walk
 *           overwrites both before its own first branch. The control-flow boundary IS part of the
 *           contract: the oracle nets exactly one caller-return pop on BOTH arms (MEASURED: SP
 *           +2 on all 616 dispatches, always landing at ROM 0x1986). On the 25m arm the frozen
 *           walk performs that pop for this routine, on both sides. On the early return the
 *           oracle performs it itself and the rewrite models it as a plain JS return, so the seam
 *           closes the bracket at go-live and the gate models that with one m.ret() on the
 *           candidate. MEASURED as well as derived: wired live at ROM 0x1F72 for a 1200-frame
 *           attract run, and again for a 1200-frame run with BOARD held at 2, the per-frame state
 *           trace is byte-identical to the all-oracle baseline once the oracle's cycle cost is
 *           restored. That cost is path-dependent (MEASURED 275 distinct per-dispatch costs over
 *           616 attract dispatches), so it is priced per dispatch rather than assumed constant.
 *           WHAT THAT SECOND RUN IS NOT: it confirms the trace, but it is not the teeth on the
 *           early-return arm. On the poked state the walk finds nothing to render, so a rewrite
 *           that wrongly ran it there would leave the trace byte-identical too — the gate asserts
 *           that blindness rather than implying coverage, and the crafted entries are what catch a
 *           missing board gate.
 * NAMES:    BOARD (0x6227), OBJ_ARRAY_67 (0x6700) and ACTOR_SPRITES (0x6980) from ram.js. The walk
 *           this falls into (ROM 0x1F83) is not wired into ram.js's ROUTINES, so it resolves to the
 *           frozen oracle and is reached through the registry; the register loads above exist only
 *           to feed it and dissolve into arguments once it is. The board number 1, the ten records
 *           and the 32-byte stride are file-local constants: ram.js documents the meaning of
 *           BOARD's values and OBJ_ARRAY_67's extent in those entries' own comments, so nothing
 *           here re-registers them.
 *
 * NAME: kept loc_ — an English name is earned in a confirmed understanding pass, not here.
 */

import { BOARD, OBJ_ARRAY_67, ACTOR_SPRITES } from "./ram.js";

const GIRDER_BOARD = 1; // the BOARD value that runs the walk (25m); ram.js's BOARD entry has the rest
const OBJECT_SLOTS = 10; // records in OBJ_ARRAY_67
const RECORD_STRIDE = 32; // bytes from one OBJ_ARRAY_67 record to the next

export function loc_1f72(m) {
  const { regs, mem8 } = m;

  // Only 25m walks the objects; the other three boards leave them alone entirely.
  if (mem8[BOARD] !== GIRDER_BOARD) return;

  // REGISTER-ABI MARSHALLING, and it dissolves the moment ROM 0x1F83 is decompiled: that walk is
  // still the frozen oracle and reads its four working values straight out of the register file.
  regs.ix = OBJ_ARRAY_67; // the record it starts on
  regs.hl = ACTOR_SPRITES; // the sprite cursor that advances 4 bytes per record
  regs.de = RECORD_STRIDE; // how far the record pointer moves each iteration
  regs.b = OBJECT_SLOTS; // how many records it has left to visit
  return m.call(0x1f83);
}
