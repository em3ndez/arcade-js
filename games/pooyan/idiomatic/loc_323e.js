// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_324d } from "./loc_324d.js";
/**
 * loc_323e — scan display-list slots for the board-clear tag. Walks the record at IX in two-byte
 * steps (count preset in B); each slot whose tag byte (slot+1) is 0x8c runs the slot-clear handler,
 * then decrements until the counter reaches zero.
 *
 * The counter is the LIVE B register: on the board-clear-full path the slot-clear handler clobbers B
 * (its tilemap checksum resumes into this djnz), cutting the scan short exactly as the djnz does; a
 * captured-at-entry counter would over-scan the later slots.
 *
 * LIVE-OUT: IX (stopping slot) and B (0 at exit), both defensive — neither verified caller consumes them.
 */

const TAG_BOARD_CLEAR = 0x8c; // slot tag that triggers the slot-clear handler
const SLOT_STRIDE = 0x02; //    display-list slots are two bytes apart

export function loc_323e(m, rec = m.regs.ix, count = m.regs.b) {
  const { mem8 } = m;

  m.regs.b = count & 0xff;
  let slot = rec;
  do {
    if (mem8[slot + 0x01] === TAG_BOARD_CLEAR) loc_324d(m, slot);
    slot = u16(slot + SLOT_STRIDE);
    m.regs.b = (m.regs.b - 1) & 0xff; // the handler may have clobbered B; decrement the live value
  } while (m.regs.b !== 0);

  return [(m.regs.ix = slot), m.regs.b];
}
