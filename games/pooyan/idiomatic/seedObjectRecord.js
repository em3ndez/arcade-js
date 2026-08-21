// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
/**
 * seedObjectRecord — seed one object record from a 2-byte descriptor stream (DE, -> rec+0x06 /
 * rec+0x04) and a 2-byte little-endian coordinate stream (HL, -> rec+0x0c / rec+0x0d), then
 * clear the timer at rec+0x0e. A leaf: reads only its two streams.
 *
 * LIVE-OUT: [descPtr, coordPtr] — both source pointers advanced by 2 and consumed by the
 * caller's build loop (descriptor sentinel + next coordinate), so the bridge writes both back to
 * DE (descPtr) and HL (coordPtr) while returning the tuple. The record base is untouched (the
 * caller steps it itself).
 */
export function seedObjectRecord(m, record = m.regs.ix, descPtr = m.regs.de, coordPtr = m.regs.hl) {
  const { mem8 } = m;

  mem8[record + 0x06] = mem8[descPtr];
  mem8[record + 0x04] = mem8[descPtr + 0x01];
  mem8[record + 0x0c] = mem8[coordPtr];
  mem8[record + 0x0d] = mem8[coordPtr + 0x01];
  mem8[record + 0x0e] = 0x00;

  return [m.regs.de = u16(descPtr + 0x02), m.regs.hl = u16(coordPtr + 0x02)];
}
