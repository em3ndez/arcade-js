// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearSpriteAndAttributeRam — wipe the sprites and per-column scroll for a clean
 * screen at setup.  ROM 0x4c11.
 *
 * Part of the screen/board setup that the multi-door entry family runs (it is the
 * first of that sequence's three fill/clear steps, followed by the video-RAM fill
 * and the colour fill). It zeroes the low half of the display's 0x9800 block:
 *   - the attribute / column-scroll RAM (0x9800-0x983F) — one byte per column,
 *     read as that column's vertical scroll, so zeroing it un-scrolls every column;
 *   - the eight sprite slots (0x9840-0x985F, four bytes each) — zeroing them clears
 *     every sprite off the screen; and
 *   - the spare bytes just above (0x9860-0x987F).
 * The upper half of the block (0x9880-0x98FF) is deliberately left untouched.
 *
 * It takes no inputs and reads no memory — the base and the 128-byte length are
 * fixed — so it always leaves the same 128 bytes zeroed no matter what state it is
 * entered from.
 *
 * Memory-equivalent to the frozen oracle — equivalence-4c11.test.js.
 * GATE:     crafted-entry — the real dispatch (where the block is already all-zero,
 *           so it proves ONLY these 128 bytes are touched, no stray write), plus a
 *           DIRTIED entry (all 128 bytes pre-filled with distinct garbage on both
 *           sides, proving it actually clears rather than re-reading zeros). Teeth: a
 *           short-count twin that leaves the block's last byte — invisible on the
 *           already-zero real entry, caught on the dirtied one. Reached from the
 *           multi-door entry family (loc_4b44 / loc_4b46) during the attract demo.
 * LIVE-OUT: memory-only — the 128 cleared bytes, plus the return to the caller. The
 *           loop counter and walk pointer the oracle leaves behind are dead: every
 *           caller's next act is another setup call that reloads them before use. No
 *           flags are read end to end.
 * NAMES:    none from ram.js — that file names the work RAM (0x8000-0x87FF); this
 *           clears display-side RAM. The region roles come from the board memory map
 *           and are corroborated by the pixel-exact renderer: attribute/column-scroll
 *           (0x9800-0x983F), sprite RAM (0x9840-0x985F), spare (0x9860-0x98FF).
 */
export function clearSpriteAndAttributeRam(m) {
  const { mem } = m;

  // Zero the attribute/column-scroll RAM, the eight sprite slots, and the spare
  // bytes above them — the low half of the 0x9800 block (0x9800-0x987F).
  for (let i = 0; i < 128; i++) mem.write8(0x9800 + i, 0);

  return m.ret();
}
