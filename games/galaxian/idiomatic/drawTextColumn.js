// SPDX-License-Identifier: GPL-3.0-only
//
// drawTextColumn -- the inner static-text painter: draw a run of characters into the tilemap.
//
// WHAT IT IS
//   The bottom of the non-scrolling ("static") text path. For `count` characters it reads a source byte,
//   maps it to a font tile by subtracting the '0' character code (0x30), stores that tile into the
//   destination cell, then steps the source forward one byte and the destination by a signed `stride`.
//   A negative stride (the descriptor path passes -32) walks the write pointer up one tilemap row per
//   character, so text is laid out a column at a time.
//
// ROLE IN THE MACHINE
//   This is the shared leaf of the static-text kit. drawTextColumnFromDescriptor (ROM 0x1cdc) unpacks a
//   five-byte descriptor and calls in here with source/dest/count/stride filled; drawTextColumnByIndex
//   (ROM 0x1ccf) picks which descriptor first. It is distinct from the scrolling message path
//   (renderMessageColumn / advanceMessageScroller), which reveals one glyph per frame.
//
//   ROM 0x1ceb.  Grounding: [seen].
//
// LIVE-OUT: `count` tile codes written into VRAM starting at `dest`, stepping by `stride` each character.

// The '0' character code; subtracting it maps a character code to its tile code.
const CHAR_ZERO = 48;

export function drawTextColumn(m, count = m.regs.b, src = (m.regs.d_ << 8) | m.regs.e_, dest = (m.regs.h_ << 8) | m.regs.l_, stride = (m.regs.b_ << 8) | m.regs.c_) {
  const { mem8 } = m;

  // A count of 0 means a full 256 passes (the pre-decrement counter wraps).
  const passes = count === 0 ? 256 : count;

  // Address writes mask to 16 bits, so the wrap-around stride reproduces the up-a-column walk.
  // readPtr walks the ROM/RAM source text forward; writePtr walks the tilemap by the signed stride.
  let readPtr = src;
  let writePtr = dest;
  for (let i = 0; i < passes; i++) {
    // Map source char -> font tile (subtract '0') and stamp it; the byte-wide store keeps only 8 bits.
    mem8[writePtr] = mem8[readPtr] - CHAR_ZERO; // byte-wide write wraps mod 256
    // Advance the source one byte and the destination by the (possibly negative) column stride.
    readPtr += 1;
    writePtr += stride;
  }
}
