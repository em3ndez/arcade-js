// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
/**
 * loc_0343 — build sprite display-list entries from moving-object records, with coordinate math.
 *
 * For each of `count` records it emits four bytes into successive list slots: a screen coordinate
 * derived from the (rec+5:rec+6) sub-pixel pair, the raw (rec+0x10) byte, a second coordinate from
 * the (rec+3:rec+4) pair, and the raw (rec+0x0f) byte; then it steps the record pointer by `stride`.
 * A sub-pixel pair is a 16-bit fixed-point value scaled down (>>5) and biased by -8 to a pixel
 * coordinate. The list's low byte advances alone, so the writes wrap within its 256-byte page.
 *
 * LIVE-OUT: the advanced list pointer (HL, page unchanged, low byte += 4*count). The caller chains
 * its next display-list copy from here without reloading HL, so the bridge must write it back.
 */

const COORD_BIAS = 0x08; // sub-pixel-to-pixel bias applied to each derived coordinate

/** A 16-bit sub-pixel pair (hi:lo) reduced to an 8-bit screen coordinate: (pair >> 5) - 8. */
function subPixelToScreen(hi, lo) {
  return u8(((hi << 3) | (lo >> 5)) - COORD_BIAS);
}

export function loc_0343(m, list = m.regs.hl, rec = m.regs.ix, stride = m.regs.de, count = m.regs.b) {
  const { mem8 } = m;
  const page = list - u8(list); // fixed high byte: only the low byte advances (wraps in page)
  let lo = u8(list);

  do {
    mem8[page + lo] = subPixelToScreen(mem8[rec + 0x06], mem8[rec + 0x05]); lo = u8(lo + 1);
    mem8[page + lo] = mem8[rec + 0x10];                                     lo = u8(lo + 1);
    mem8[page + lo] = subPixelToScreen(mem8[rec + 0x04], mem8[rec + 0x03]); lo = u8(lo + 1);
    mem8[page + lo] = mem8[rec + 0x0f];                                     lo = u8(lo + 1);
    rec = u16(rec + stride);
    count = u8(count - 1);
  } while (count !== 0);

  return (m.regs.hl = u16(page + lo)); // HL live-out: the caller chains the next copy from here
}
