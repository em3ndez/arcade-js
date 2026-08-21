// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
/**
 * copyObjectRecordsToDisplayList — copy four raw bytes of each object record into the
 * display list.
 *
 * For each of `count` records, emits record bytes +0x06, +0x10, +0x04, +0x0f into four
 * successive display-list slots, then steps the record pointer by `stride`. The list's
 * low byte advances alone, so the writes wrap within the list's 256-byte page. Reads the
 * records, writes the list; calls nothing.
 *
 * LIVE-OUT: the advanced list pointer (page unchanged, low byte += 4*count) — the caller
 * chains its next copy from here without reloading, so wiring must write HL back.
 */
export function copyObjectRecordsToDisplayList(m, list = m.regs.hl, rec = m.regs.ix, stride = m.regs.de, count = m.regs.b) {
  const { mem8 } = m;
  const page = list - u8(list); // fixed high byte: the low byte advances alone (wraps in page)
  let lo = u8(list);

  do {
    mem8[page + lo] = mem8[rec + 0x06]; lo = u8(lo + 1);
    mem8[page + lo] = mem8[rec + 0x10]; lo = u8(lo + 1);
    mem8[page + lo] = mem8[rec + 0x04]; lo = u8(lo + 1);
    mem8[page + lo] = mem8[rec + 0x0f]; lo = u8(lo + 1);
    rec = u16(rec + stride);
    count = u8(count - 1);
  } while (count !== 0);

  return (m.regs.hl = u16(page + lo)); // HL live-out: the caller chains its next copy from here
}
