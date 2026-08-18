// SPDX-License-Identifier: GPL-3.0-only
/**
 * computeVramColumnIndex  —  ROM 0x1198  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   A pure-register leaf that turns a VRAM *address* into the on-screen *column* (0..31) that the
 *   address lives in. Frogger runs on Konami/Galaxian-class video hardware whose tilemap is stored
 *   ROTATED — the picture is physically turned 90°, so the address bits that select a cell are
 *   permuted, and a plain linear VRAM offset does NOT map linearly to (column, row). This routine
 *   undoes that permutation for the column half: given a destination pointer it reconstructs the
 *   logical screen column by isolating the address bits that carry column identity and re-assembling
 *   them, in the right order, with a rotate-and-fold bit-shuffle. It reads and writes no memory.
 *
 * WHERE IT SITS
 *   Called once per column by the shared tile-column render loop renderFrogAnimTileColumns (ROM
 *   0x0ff1), which walks each frog-animation arm's VRAM destination. The loop feeds this routine the
 *   destination pointer; the column index that comes back is then NEGATED and stored as the hardware
 *   sprite X for that column (the `[count, x0, x1, …]` lane object list the move resolver reads). So
 *   this is the address→screen-column bridge that lets the render loop tell the sprite engine where,
 *   horizontally, each stamped tile column sits.
 *
 * LIVE-IN
 *   HL = the current VRAM destination pointer, and the carry flag = the incoming BORROW. The render
 *   loop advances the destination by a column stride and holds only the destination to 16 bits; the
 *   16-bit overflow of that add rides in here as the borrow so the column index stays consistent
 *   across the address wrap (this mirrors the Z80 `sbc hl,de` the oracle uses).
 *
 * LIVE-OUT
 *   Register C alone — the reconstructed column index. No RAM is touched; every other register the
 *   oracle clobbers (HL/DE/B/A/F) is dead and unread by the caller.
 */
import { VRAM_BASE } from "./names.js";

// Six fold passes then three bare rotates — the exact pass counts the ROM at 0x1198 uses to seat the
// scrambled column bits into their final positions in the accumulator.
const PASSES = 6;
const FINAL_ROTATES = 3;

// Mask for the top three bits (5,6,7) of the offset's low byte. In the rotated VRAM address these
// three bits carry part of the column identity; masking with 0xE0 discards the row bits.
const COLUMN_BITS = 0xe0;

// The single high-byte bit probed each pass (bit 2). As `highByte` is shifted left pass after pass,
// the offset's meaningful low bits climb into this position one at a time and get folded into the
// accumulator — the mechanism that walks the column bits out of the high byte in reverse order.
const H_PROBE_BIT = 0x04;

// 8-bit rotate-left (Z80 RLC): bit 7 wraps around into bit 0.
const rotateLeft = (v) => ((v << 1) | (v >> 7)) & 0xff;

export function computeVramColumnIndex(m, hl = m.regs.hl, borrow = m.regs.fC ? 1 : 0) {
  // ── Step 1: VRAM address → tilemap offset ────────────────────────────────────────────
  // Subtract the tilemap base VRAM_BASE (0xA800) to turn the absolute destination pointer into a
  // 0..0x3FF offset into the 32×32 (1024-cell) tilemap, less the incoming borrow described in LIVE-IN.
  const offset = hl - VRAM_BASE - borrow;

  // ── Step 2: isolate the two groups of column-bearing address bits ─────────────────────
  // columnBits = the top three bits of the offset's low byte (0xE0). highByte = the offset's high
  // byte (0..3 for a 1024-cell map to begin with). Between them these hold every address bit that
  // encodes the column; the shuffle below reads them out in the order the hardware scrambled them.
  let columnBits = offset & COLUMN_BITS;
  let highByte = (offset >> 8) & 0xff;

  // ── Step 3: six rotate-and-fold passes reassemble the column into the accumulator ─────
  // Per pass: rotate the accumulator left one bit (making room in bit 0); if the probed high bit
  // (0x04) is set, fold a 1 into bit 0 — that deposits one scrambled address bit into the result.
  // Then rotate columnBits left (RLC, its exiting top bit is the `carry`), and shift that same carry
  // into highByte's bit 0. So columnBits cycles its bits through the top while streaming its exiting
  // bit into the high byte's low end, and the high byte streams its probed bit into the accumulator —
  // a small bit-permutation network that inverts the address rotation one bit per pass.
  let acc = 0;
  for (let pass = 0; pass < PASSES; pass++) {
    acc = rotateLeft(acc);
    if (highByte & H_PROBE_BIT) acc = (acc + 1) & 0xff; // fold the probed high-byte bit into bit 0
    const carry = (columnBits >> 7) & 1;
    columnBits = ((columnBits << 1) | carry) & 0xff; // RLC columnBits: exiting top bit wraps to bit 0
    highByte = ((highByte << 1) | carry) & 0xff;      // shift highByte left, feeding in that same bit
  }

  // ── Step 4: three final rotates seat the result, then return it in C ──────────────────
  // Three more RLCs with no fold rotate the assembled bits into their final positions so the
  // accumulator reads as the logical 0..31 column index. Writing it to register C is the LIVE-OUT.
  for (let i = 0; i < FINAL_ROTATES; i++) acc = rotateLeft(acc);
  return (m.regs.c = acc);
}
