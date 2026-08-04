// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatch50mObjectState — the 50m board-object state-machine dispatcher: gate on the 50m
 * board, pick one of two object records by frame parity, and run the arm for its state.
 *
 * Dispatched every board-object pass. A single board gate opens the body ONLY on the 50m
 * board; on any other board the gate is closed and the whole body is skipped — which is why
 * during a 25m attract this routine runs constantly and its body never does. When it does run:
 *
 *   1. Frame parity picks which object to service: on an odd frame the first record, on an
 *      even frame the second. These are the two 8-byte object records the 50m state machine
 *      alternates between.
 *   2. The record's state byte (its first field, held in 0..3) selects one of four arms and
 *      tail-calls it. Each arm services this object for one tick and steps its own state. The
 *      positions below are the record's travel counter, which IS a screen Y — LARGER IS LOWER
 *      on screen, so its minimum of 0x68 is the object's HIGHEST point and its maximum of 0x78
 *      the LOWEST:
 *        state 0 -> parked at the top; a 256-frame dwell, then advance. On a Mario hit it also
 *                   stamps a shared flag.
 *        state 1 -> steps the counter UP, moving the object DOWN the screen; advances when it
 *                   reaches the bottom of travel.
 *        state 2 -> a randomised dwell at the lowest point, then advance.
 *        state 3 -> steps the counter DOWN, moving the object UP the screen; at the top of
 *                   travel it resets the record back to state 0.
 *
 * HOW THE RECORD BASE REACHES THE ARM. Three of the four arms take it as an argument. The
 * parked arm instead takes it off the stack, so the base is pushed right before that one call.
 *
 * WHAT THIS DOES NOT CLAIM: "object" is deliberate. The records' sprite reads as a ladder
 * graphic, and what the four arms produce — park at the top, slide down, dwell, slide back up
 * — fits a moving ladder. It stays "object" because reading a picture is not the same as
 * establishing which member of the 50m cast this is, or whether the travel is a retraction at
 * all.
 *
 * LIVE-OUT: memory-only, all of it written by the dispatched arm. The board-gate skip is the
 * caller-skip idiom, modelled here as an early return, and the dispatch is a tail call whose
 * result the caller discards.
 */

import { NotImplemented } from "../../../boards/dkong/io.js";
import { BOARD_OBJ_SCRATCH, FRAME } from "./names.js";
import { boardBitGate } from "./boardBitGate.js";
import { hold50mObjectParked } from "./hold50mObjectParked.js"; // state 0 — takes its base off the stack
import { slide50mObjectDown } from "./slide50mObjectDown.js"; // state 1
import { advance50mObjectStateOnRandomGate } from "./advance50mObjectStateOnRandomGate.js"; // state 2
import { raise50mObjectAndPark } from "./raise50mObjectAndPark.js"; // state 3

// Board mask: bit 1 -> the 50m board, the only board this dispatcher runs on.
const BOARD_MASK = 0x02;

export function dispatch50mObjectState(m) {
  const { regs, mem } = m;

  // Board gate: run the object update only on the 50m board. The gate reads the mask out of
  // the accumulator; on any other board it closes and the whole body is skipped.
  regs.a = BOARD_MASK;
  if (!boardBitGate(m)) return;

  // Frame parity picks the object record: odd frame -> the first record, even -> the second.
  const recordBase =
    (mem.read8(FRAME) & 1) === 1 ? BOARD_OBJ_SCRATCH : BOARD_OBJ_SCRATCH + 8;

  // Dispatch on the object's state byte (its first field) to that state's arm.
  const state = mem.read8(recordBase);
  switch (state) {
    case 0:
      // The parked arm takes its record base off the stack, so hand it over that way.
      m.push16(recordBase);
      return hold50mObjectParked(m);
    case 1:
      return slide50mObjectDown(m, recordBase);
    case 2:
      return advance50mObjectStateOnRandomGate(m, recordBase);
    case 3:
      return raise50mObjectAndPark(m, recordBase);
    default:
      // The state table has exactly four entries (states 0..3); any other value would index
      // off the end of it.
      throw new NotImplemented(
        `dispatch50mObjectState: object-state dispatch on unexpected state ${state}`,
      );
  }
}
