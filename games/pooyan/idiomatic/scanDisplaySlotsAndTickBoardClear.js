// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { tickHunterReturnCounterAndCheckBoardClear } from "./tickHunterReturnCounterAndCheckBoardClear.js";
/**
 * scanDisplaySlotsAndTickBoardClear — scan display-list slots for the board-clear tag. Walks the record at IX in two-byte
 * steps (count preset in B); each slot whose tag byte (slot+1) is 0x8c runs the slot-clear handler,
 * then decrements until the counter reaches zero.
 *
 * The counter walks in a local: on the board-clear-full path the slot-clear handler runs the tile-sum
 * check, which resumes its own scan counter into this djnz (the handler returns it), cutting the scan
 * short exactly as the djnz does; a captured-at-entry counter would over-scan the later slots.
 *
 * LIVE-OUT: none — the stopping slot and drained counter are unconsumed; every caller discards the
 * return, and the shared formation epilogue reads no register back.
 */

const TAG_BOARD_CLEAR = 0x8c; // slot tag that triggers the slot-clear handler
const SLOT_STRIDE = 0x02; //    display-list slots are two bytes apart

export function scanDisplaySlotsAndTickBoardClear(m, rec = m.regs.ix, count = m.regs.b) {
  const { mem8 } = m;

  let b = count & 0xff;
  let slot = rec;
  do {
    if (mem8[slot + 0x01] === TAG_BOARD_CLEAR) {
      const resumed = tickHunterReturnCounterAndCheckBoardClear(m, slot); // the tile-sum check resumes its counter into the djnz
      if (resumed !== undefined) b = resumed;
    }
    slot = u16(slot + SLOT_STRIDE);
    b = (b - 1) & 0xff;
  } while (b !== 0);
}
