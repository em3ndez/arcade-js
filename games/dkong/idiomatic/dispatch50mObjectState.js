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
 *      tail-calls it. Each arm services this object for one tick and steps its own state:
 *        state 0 -> hold50mObjectParked  (dwell timer; on a Mario hit stamp the shared flag)
 *        state 1 -> slide50mObjectDown  (step the position counter UP, advance state at the top)
 *        state 2 -> advance50mObjectStateOnRandomGate  (randomised dwell, then advance to the next state)
 *        state 3 -> raise50mObjectAndPark  (step the counter DOWN, reset the object at the bottom)
 *
 * ORACLE BOUNDARY — the record base is handed to the arm on the stack. The oracle pushes
 * the record base once and each arm pops it. Three of the four arms have already dissolved
 * that pop into an honest parameter (slide50mObjectDown / advance50mObjectStateOnRandomGate / raise50mObjectAndPark take the record base as
 * an argument), so they are called directly with it. hold50mObjectParked is still oracle-shaped — it
 * takes its base with a stack pop — so the base is pushed right before it for that pop. That
 * one push is genuine stack-ABI marshalling; it dissolves once hold50mObjectParked takes a parameter.
 *
 * NAME: kept the neutral loc_ — the dispatch mechanism (board gate, frame-parity record
 * select, state-byte dispatch) is pinned to the oracle, but which on-screen 50m object these
 * records drive is not corroborated to the routine-name bar, matching its arms hold50mObjectParked /
 * slide50mObjectDown / advance50mObjectStateOnRandomGate / raise50mObjectAndPark, which all keep loc_ under the same caution.
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
      // hold50mObjectParked still takes its record base with a stack pop, so hand it the base on the
      // stack — the genuine stack-ABI marshalling that dissolves once hold50mObjectParked takes a param.
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
