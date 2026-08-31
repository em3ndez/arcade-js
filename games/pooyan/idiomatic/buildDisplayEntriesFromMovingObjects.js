// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
/**
 * buildDisplayEntriesFromMovingObjects — build the sprite display list from a run of moving-object records, deriving each
 * on-screen coordinate from the object's sub-pixel position. ROM 0x0343. Grounding: [seen].
 *
 * WHAT IT IS: one of the routines that translate the game's internal object records into the
 * flat sprite display list the video hardware scans. Each moving object (a Pooyan, an arrow, a
 * balloon, a stone) is tracked at high precision as a 16-bit sub-pixel position; the screen,
 * however, addresses whole pixels. This routine walks `count` object records and, for each,
 * writes a four-byte sprite entry: a coordinate, an attribute byte, a second coordinate, and a
 * second attribute byte.
 *
 * THE COORDINATE MATH: an object's position on one axis is a 16-bit fixed-point pair — a whole
 * part and a fractional (sub-pixel) part packed as hi:lo. The screen coordinate is that pair
 * scaled down by 32 (>> 5) and then biased by -8 (COORD_BIAS). The -8 accounts for the sprite
 * hardware's fixed origin offset, so an object at logical 0 lands at the correct edge. The two
 * axes for one sprite come from two different record fields: the (rec+6:rec+5) pair and the
 * (rec+4:rec+3) pair. Between the two coordinates sit two raw bytes copied verbatim — the
 * (rec+0x10) and (rec+0x0f) fields — which carry the sprite's tile/colour attributes.
 *
 * THE RECORDS: records are spaced `stride` bytes apart; the routine steps the record pointer by
 * `stride` after each object. The display-list pointer, by contrast, advances only in its LOW
 * byte, so the four-byte writes stay within a single 256-byte page and wrap inside it — the
 * list occupies one hardware page.
 *
 * LIVE-OUT: the advanced list pointer (HL) — page unchanged, low byte += 4*count. The caller
 * chains its next display-list copy straight from this pointer without reloading it, so the
 * final value must be handed back.
 */

const COORD_BIAS = 0x08; // sub-pixel-to-pixel bias applied to each derived coordinate

/**
 * A 16-bit sub-pixel pair (hi:lo) reduced to an 8-bit screen coordinate: (pair >> 5) - 8.
 * (hi << 3) | (lo >> 5) is exactly the top 11 bits of the 16-bit pair taken as an 8-bit result,
 * i.e. the pair shifted right by 5; the fixed COORD_BIAS then shifts it to the sprite origin.
 */
function subPixelToScreen(hi, lo) {
  return u8(((hi << 3) | (lo >> 5)) - COORD_BIAS);
}

export function buildDisplayEntriesFromMovingObjects(m, list = m.regs.hl, rec = m.regs.ix, stride = m.regs.de, count = m.regs.b) {
  const { mem8 } = m;

  // The display list lives in a single 256-byte page: hold the page (high byte) fixed and step
  // only the low byte, so the run of writes wraps inside the page rather than crossing it.
  const page = list - u8(list); // fixed high byte: only the low byte advances (wraps in page)
  let lo = u8(list);

  // Emit one four-byte sprite entry per object record. The loop is tested AFTER each pass (a
  // do-while), matching the hardware down-counter: a count of 0 on entry would run a full 256
  // objects, never zero.
  do {
    // Byte 0: first screen coordinate, derived from the (rec+6:rec+5) sub-pixel pair.
    mem8[page + lo] = subPixelToScreen(mem8[rec + 0x06], mem8[rec + 0x05]); lo = u8(lo + 1);
    // Byte 1: the (rec+0x10) attribute byte, copied raw.
    mem8[page + lo] = mem8[rec + 0x10];                                     lo = u8(lo + 1);
    // Byte 2: second screen coordinate, derived from the (rec+4:rec+3) sub-pixel pair.
    mem8[page + lo] = subPixelToScreen(mem8[rec + 0x04], mem8[rec + 0x03]); lo = u8(lo + 1);
    // Byte 3: the (rec+0x0f) attribute byte, copied raw.
    mem8[page + lo] = mem8[rec + 0x0f];                                     lo = u8(lo + 1);

    // Step to the next object record (records are `stride` bytes apart) and count it down.
    rec = u16(rec + stride);
    count = u8(count - 1);
  } while (count !== 0);

  return (m.regs.hl = u16(page + lo)); // HL live-out: the caller chains the next copy from here
}
