// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatch50mObjectState — the 50m board-object state-machine dispatcher: gate on the 50m board,
 * pick one of two object records by frame parity, and run the arm for its state.  ROM 0x2207.
 *
 * Dispatched every board-object pass from the in-game cascade (`call 0x2207` @0x199B).
 * A single `rst 0x30` board gate with mask 0x02 (bit1 -> the 50m board) opens the body
 * ONLY on the 50m board; on any other board the gate is closed and the whole body is
 * skipped — which is why in 25m attract this routine is dispatched constantly but its
 * body never runs. When it does run:
 *
 *   1. Frame parity picks which object to service: on an odd frame the first record
 *      (BOARD_OBJ_SCRATCH), on an even frame the second (BOARD_OBJ_SCRATCH + 8). These are
 *      the two 8-byte object records the 50m state machine alternates between.
 *   2. The record's state byte (its +0 field, held in 0..3) selects one of four arms and
 *      tail-calls it. Each arm services this object for one tick and steps its own state.
 *      The positions below are the record's +3 counter, which IS a screen Y — LARGER IS LOWER
 *      on screen, so 0x68 (its minimum) is the object's HIGHEST point and 0x78 (its maximum) its
 *      LOWEST. That convention is grounded in raise50mObjectAndPark.js's VERTICAL CONVENTION block.
 *        state 0 -> hold50mObjectParked           parked at 0x68 (highest); 256-frame dwell, then
 *                                                 advance. On a Mario hit it stamps a shared flag.
 *        state 1 -> slide50mObjectDown            steps the counter UP 0x68 -> 0x78, moving the
 *                                                 object DOWN the screen; advances at 0x78, the
 *                                                 bottom of travel.
 *        state 2 -> advance50mObjectStateOnRandomGate randomised dwell at 0x78 (the lowest point), then
 *                                                 advance.
 *        state 3 -> raise50mObjectAndPark         steps the counter DOWN 0x78 -> 0x68, which moves
 *                                                 the object UP the screen; at 0x68 (the top of
 *                                                 travel) it resets the record back to state 0.
 *
 * ORACLE BOUNDARY — the record base is handed to the arm on the stack. The oracle pushes
 * the record base once and each arm pops it. Three of the four arms have already dissolved
 * that pop into an honest parameter (slide50mObjectDown, advance50mObjectStateOnRandomGate and
 * raise50mObjectAndPark take the record base as an argument), so they are called directly
 * with it. hold50mObjectParked is still oracle-shaped — it takes its base with a stack pop —
 * so the base is pushed right before it for that pop. That one push is genuine stack-ABI
 * marshalling; it dissolves once hold50mObjectParked takes a parameter.
 *
 * NAME: promoted from loc_2207 in understanding pass 15 (proposer != confirmer; both derivations
 * landed on the same meaning — dispatch the 50m board-object state machine). The corroboration is
 * entirely OUTSIDE this routine (R5): both its inputs are named cells in ram.js — BOARD_OBJ_SCRATCH
 * (0x6280) and FRAME (0x601A) — and boardBitGate's mask 0x02 resolves to BOARD (0x6227) `[seen]`
 * == 2 == the 50m board. The pass-14 grounding then measured both halves of the name directly.
 * The figures below come from THREE DIFFERENT RUNS and are labelled, because the board gate at
 * ROM 0x2209 skips everything after it — so a run's head-dispatch count and its body count are
 * only equal on a run that stays on board 2:
 *   - RUN-E (pure attract, 24,243 frames, zero pokes): 9,843 head dispatches, ZERO bodies.
 *   - RUN-N/N2 (natural play across all four boards): 1,957 head dispatches — 966 on board 1,
 *     294 on board 2, 694 on board 3, 3 on board 4 — and exactly 294 bodies, EVERY one on board 2.
 *   - Pooled across those two runs, 11,506 head dispatches on boards 1/3/4 produced ZERO bodies.
 *     (The 9,843 above is part of that 11,506, not a separate tally.)
 *   - RUN-P2 (a POKED board-2 run, 6,810 board-2 frames): 5,811 heads, all 5,811 reaching the body.
 * The record select was measured on RUN-P2: record A's state byte read 5,811 times (pc 0x2212, ROM
 * 0x2211) and record B's 2,906 times (pc 0x2219, ROM 0x2218), the read PCs landing exactly on the
 * two ROM instructions. That 2:1 is the STRUCTURAL signature of an unconditional pre-read plus a
 * parity re-read, NOT a 1:1 alternation: ROM 0x220E-0x2218 loads record A's pointer and reads its
 * state byte unconditionally at 0x2211, then `jp c,0x2219` keeps it on odd frames while even frames
 * fall through and re-read record B at 0x2218 — so 2:1 (5,811/2,906 = 1.9997) is what the code
 * predicts either way. What the ratio DOES evidence is that the `jp c` is taken on half the passes,
 * and the 1:1 alternation is in which record is SERVICED: 5,811 − 2,906 = 2,905 record-A services
 * against 2,906 record-B services.
 *
 * WHAT THE NAME DOES NOT CLAIM: "object" is deliberate. The records' sprite has been isolated
 * against pixels and reads as a ladder graphic, and pass 15's blind confirmer named this
 * cluster for a moving ladder. What the four arms produce — park at the top, slide down,
 * dwell, slide back up — fits that, and mechanisms.md lists retracting ladders in the 50m
 * cast. "object" stays because reading a picture is not the same as establishing WHICH member
 * of that cast this is, or whether the travel is a retraction at all.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2207.test.js.
 * GATE:     captured + crafted. 0x2207 is dispatched every board-object pass, so real attract
 *           dispatches (all on the 25m board) cover the gate-CLOSED arm — the body skipped, no
 *           object RAM touched. The gate-OPEN 50m body is unreachable in attract, so it is
 *           crafted on a real base with BOARD poked to 2 and swept over FRAME (record parity) x
 *           state byte (0..3), so every arm runs against both records. The arms are each proven
 *           exhaustively in their own gates; this gate proves only the gate + record select +
 *           dispatch routing. The dropped push16/ret bracket's dead STACK_SCRATCH is excluded.
 * LIVE-OUT: memory-only. The caller's next act is another cascade `call`, reading no register
 *           or flag this routine leaves; the board-gate skip is the caller-skip idiom modelled
 *           as the boolean early return, and the dispatch is a tail call whose result the
 *           cascade discards.
 * NAMES:    BOARD_OBJ_SCRATCH (0x6280), FRAME (0x601A) from ram.js; boardBitGate (ROM 0x0030,
 *           reads BOARD 0x6227 + the mask in regs.a). The four arms own every record cell they
 *           touch, so this routine names none of its own.
 */

import { NotImplemented } from "../../../boards/dkong/io.js";
import { BOARD_OBJ_SCRATCH, FRAME } from "./ram.js";
import { boardBitGate } from "./boardBitGate.js"; // ROM 0x0030 (rst 0x30) — per-board skip gate
import { hold50mObjectParked } from "./hold50mObjectParked.js"; // ROM 0x2227 — state 0 arm (still pops its base off the stack)
import { slide50mObjectDown } from "./slide50mObjectDown.js"; // ROM 0x2259 — state 1 arm
import { advance50mObjectStateOnRandomGate } from "./advance50mObjectStateOnRandomGate.js"; // ROM 0x2299 — state 2 arm
import { raise50mObjectAndPark } from "./raise50mObjectAndPark.js"; // ROM 0x22A2 — state 3 arm

// rst-0x30 board mask: bit1 -> the 50m board, the only board this dispatcher runs on.
const BOARD_MASK = 0x02;

export function dispatch50mObjectState(m) {
  const { regs, mem } = m;

  // Board gate: run the object update only on the 50m board. boardBitGate reads the mask from
  // regs.a; on any other board it closes and the whole body is skipped.
  regs.a = BOARD_MASK;
  if (!boardBitGate(m)) return;

  // Frame parity picks the object record: odd frame -> the first record, even -> the second.
  const recordBase =
    (mem.read8(FRAME) & 1) === 1 ? BOARD_OBJ_SCRATCH : BOARD_OBJ_SCRATCH + 8;

  // Dispatch on the object's state byte (its +0 field) to that state's arm.
  const state = mem.read8(recordBase);
  switch (state) {
    case 0:
      // hold50mObjectParked still takes its record base with a stack pop, so hand it the
      // base on the stack — the genuine stack-ABI marshalling that dissolves once
      // hold50mObjectParked takes a parameter.
      m.push16(recordBase);
      return hold50mObjectParked(m);
    case 1:
      return slide50mObjectDown(m, recordBase);
    case 2:
      return advance50mObjectStateOnRandomGate(m, recordBase);
    case 3:
      return raise50mObjectAndPark(m, recordBase);
    default:
      // The state table has exactly four entries (states 0..3); the oracle's computed jump
      // would land off the table for any other value.
      throw new NotImplemented(
        `dispatch50mObjectState: object-state dispatch on unexpected state ${state}`,
      );
  }
}
