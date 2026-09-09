// SPDX-License-Identifier: GPL-3.0-only
import { loc_91, loc_92, loc_ef, loc_f3 } from "./names.js";

/**
 * writeMaskedByteAndAdvancePointer — store one byte through a 16-bit cursor, then step the cursor down.
 *
 * ROLE: this is the single store primitive underneath the whole text/number-plotting subsystem. Every glyph,
 * digit and border tile that the screen-layout code lays into video RAM goes out through here. Callers seed
 * the 16-bit output cursor (low byte loc_91 == $91, high byte loc_92 == $92) once, then call this repeatedly;
 * each call emits one tile and walks the cursor to the next cell, so a loop of calls paints a whole column
 * down the screen. writePointerTableRow's emit loop is the primary caller.
 *
 * MECHANISM: a nonzero byte is XOR'd with the mask cell loc_ef == $ef; a zero byte is stored unmasked so a
 * blank stays blank whatever the mask holds. $ef is the flipped-cabinet orientation mask that threads through
 * this whole game — folding it into the tile and into the stride is how one body of code paints both the
 * upright and the mirrored screen without a second copy. After the store the cursor advances: the low half
 * steps by the flip-aware stride 0x20 ^ mask (0x20 == one tile row), and any carry out of that add rolls into
 * the high half together with a per-column high adjust taken from loc_f3 == $f3.
 *
 * ROM 0x-region: video RAM tile store (the $91/$92 cursor addresses the $04xx-$07xx video/object pages).
 * GROUNDING: [code] (behaviour-derived; the cursor cells $91/$92/$ef/$f3 are working RAM).
 * LIVE-OUT: register carry (m.regs.fC) — the high-byte advance carry-out. The row-drawing loop above reads
 *   this carry to thread digit/leading-zero state from one plotted byte to the next, so it is load-bearing.
 */
export function writeMaskedByteAndAdvancePointer(m, a = m.regs.a) {
  const { mem8, mem16 } = m;
  // Fetch the orientation mask and clamp the incoming byte to 8 bits. The mask is XORed into every real tile
  // to mirror it for a flipped cabinet; the one exception is a zero byte, which must stay a literal blank.
  const mask = mem8[loc_ef];
  const av = a & 0xff;
  const byte = av === 0 ? 0 : av ^ mask; // a zero byte is stored unmasked

  // Store through the CURRENT cursor (read the pointer before advancing it).
  // mem16[loc_91] composes the low/high cursor bytes ($91/$92) into the destination video-RAM address, and
  // the masked tile is written there — this is the actual on-screen paint of one cell.
  const target = mem16[loc_91];
  mem8[target] = byte;

  // Advance the low byte by the (flip-aware) stride, carrying into the high byte.
  // Stride 0x20 ^ mask moves the cursor exactly one tile-row down (0x20 cells), mirrored by the mask so the
  // walk runs the correct direction for the current orientation. JS keeps the full sum so we can test >0xff.
  const lowSum = mem8[loc_91] + (0x20 ^ mask);
  mem8[loc_91] = lowSum;
  // Any overflow past 0xff is the carry into the high byte; the high byte also picks up loc_f3, the per-column
  // high adjust, so successive columns land on the right video page. This mirrors a 6502 low-add-then-ADC pair.
  const carry = lowSum > 0xff ? 1 : 0;
  const highSum = mem8[loc_f3] + mem8[loc_92] + carry;
  mem8[loc_92] = highSum;
  // The high-byte add's own overflow becomes the routine's exit carry — the caller's loop threads it forward.
  return (m.regs.fC = highSum > 0xff); // exit carry (register-out): the high-byte advance carry-out
}
