// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";

/**
 * fetchNextDrawRecord — pull the next four-byte draw record through the BC cursor.
 *
 * WHAT IT IS
 *   A feeder for the draw-script walkers. A draw script is a table of four-byte records; each record is
 *   two little-endian 16-bit words — a screen (video-RAM) address and a graphics-source pointer — and the
 *   table ends with a lone 0xff byte. This routine reads the record BC currently points at: if it is the
 *   0xff terminator it reports "end" and leaves BC parked; otherwise it unpacks the two words into HL and
 *   DE, steps BC past all four bytes, and reports "more".
 *
 * ROLE IN THE MACHINE
 *   Callers pair it with a column blitter: drawScoreAdvanceTable and typeDrawScript pull record after
 *   record, blitting each (drawSpriteColumn16 / a typed run) until the terminator stops the loop
 *   (mechanisms.md, sprite drawing). It communicates through the 8080 flags and registers — carry is the
 *   more/done signal (set = terminator reached), HL = screen address, DE = graphics pointer, BC = the
 *   advanced cursor, A = the last byte read. BC defaults to the Z80 BC register.
 *
 * ROM 0x1856-....  Grounding: [seen].
 *
 * LIVE-OUT: terminator path -> A = 0xff, carry set, BC unchanged. Record path -> HL/DE = the two words,
 * BC advanced by 4, A = the record's high-address byte (D), carry clear.
 */
export function fetchNextDrawRecord(m, bc = m.regs.bc) {
  // Peek the record's first byte. A lone 0xff is the table terminator.
  const first = m.mem8[bc];
  if (first === 0xff) {
    // End of script: leave BC parked on the terminator and flag it with carry set.
    return [(m.regs.a = first), (m.regs.fC = true)];
  }
  // Not a terminator: unpack the two little-endian words. Bytes 0/1 -> HL (screen address, low = first),
  // bytes 2/3 -> DE (graphics pointer, low = e).
  const h = m.mem8[u16(bc + 1)];
  const e = m.mem8[u16(bc + 2)];
  const d = m.mem8[u16(bc + 3)];
  // Publish HL/DE, step BC past the whole four-byte record, leave A = D, and clear carry ("more records").
  return [(m.regs.hl = (h << 8) | first), (m.regs.de = (d << 8) | e), (m.regs.bc = u16(bc + 4)), (m.regs.a = d), (m.regs.fC = false)];
}
