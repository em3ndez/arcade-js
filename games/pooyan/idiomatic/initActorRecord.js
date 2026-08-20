// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
/**
 * initActorRecord — stamp the fixed opening state into a fresh 0x18-byte actor record.
 *
 * Seeds the spawn constants (+0x00=0x00, +0x01=0x01, +0x02=0x08), the +0x12 marker (0xff),
 * and the 16-bit datum little-endian at +0x16:+0x17 (E low, D high). Other bytes untouched.
 * A leaf — writes only into the handed record, calls nothing.
 *
 * LIVE-OUT: the advanced pointer (rec+0x17, 16-bit), returned and consumed by the caller's scan
 * continuation (it does not reload it), plus the six record bytes. Wiring must write HL back.
 */
export function initActorRecord(m, rec = m.regs.hl, value = m.regs.de) {
  const { mem8 } = m;

  mem8[rec + 0x00] = 0x00;
  mem8[rec + 0x01] = 0x01;
  mem8[rec + 0x02] = 0x08;

  mem8[rec + 0x12] = 0xff;

  mem8[rec + 0x16] = value;
  mem8[rec + 0x17] = value >> 8;

  return u16(rec + 0x17); // HL live-out: the caller's scan continuation reads from here
}
