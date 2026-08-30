// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
/**
 * copyObjectRecordsToDisplayList — gather four attribute bytes from each object record into the
 * hardware sprite display list.
 *
 * ROM 0x032a — [seen]. Objects (players, enemies, projectiles) live in wide game-logic records,
 * but the sprite display list the video hardware scans wants exactly four bytes per sprite. This
 * is the harvester: for each of `count` records it picks the four attribute fields out of the
 * record and packs them, in display order, into the next four slots of the list. The record
 * fields live at offsets +0x06, +0x10, +0x04 and +0x0f, and they are emitted in THAT order — the
 * record's internal layout differs from the four-byte sprite-entry layout the hardware expects,
 * so the copy reorders as it goes rather than doing a straight block move. After each record the
 * source pointer steps by `stride` (the record size), so records can be spaced apart in a larger
 * table.
 *
 * The destination is addressed as a 256-byte page: only the low byte of the list pointer is
 * incremented, so writes wrap within the current page and never spill into the next — the sprite
 * list is a single hardware page and this keeps the harvest inside it.
 *
 * Reads the records, writes the list; calls nothing.
 *
 * LIVE-OUT: the advanced list pointer (page unchanged, low byte += 4*count). The caller chains
 * its next harvest straight on from here without reloading, so the wiring must write the pointer
 * back.
 */
export function copyObjectRecordsToDisplayList(m, list = m.regs.hl, rec = m.regs.ix, stride = m.regs.de, count = m.regs.b) {
  const { mem8 } = m;

  // Split the destination into a fixed page (high byte) and a moving low byte. The hardware
  // sprite list is one 256-byte page; advancing only the low byte keeps every write inside it,
  // wrapping 0xff->0x00 rather than crossing into the next page.
  const page = list - u8(list); // fixed high byte: the low byte advances alone (wraps in page)
  let lo = u8(list);

  do {
    // Pack one sprite entry: pull the record's four attribute fields and lay them into four
    // consecutive list slots in the hardware's display order (+0x06, then +0x10, +0x04, +0x0f).
    // The order is the record->sprite-entry remap; each slot advance wraps within the page.
    mem8[page + lo] = mem8[rec + 0x06]; lo = u8(lo + 1);
    mem8[page + lo] = mem8[rec + 0x10]; lo = u8(lo + 1);
    mem8[page + lo] = mem8[rec + 0x04]; lo = u8(lo + 1);
    mem8[page + lo] = mem8[rec + 0x0f]; lo = u8(lo + 1);

    // Step to the next record. `stride` is the record size, so records may be spread through a
    // wider table; the source pointer wraps at the full 16-bit boundary.
    rec = u16(rec + stride);
    count = u8(count - 1);
  } while (count !== 0);

  // Hand the advanced list pointer back so the next harvest continues where this one stopped.
  return (m.regs.hl = u16(page + lo)); // HL live-out: the caller chains its next copy from here
}
