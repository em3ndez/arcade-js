// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearStridedBytes — zero B bytes at stride 4, walking the LOW address byte only.
 *
 * A tiny memory-clear primitive. Starting at the pointer HL, it stores the constant 0x00 to
 * B bytes spaced four apart, stepping the pointer by +4 between stores. The step is applied
 * to the LOW byte alone, never as a 16-bit add, so an overflow WRAPS within the current
 * 256-byte page and never carries into the high byte — the clear is confined to one page.
 * That in-page confinement is the routine's defining property and the thing a careless
 * 16-bit rewrite would break.
 *
 *   - do-while: the count is decremented THEN tested, so the body always runs at least once
 *     and B == 0 on entry means 256 passes, not zero. No caller passes 0; the loop mirrors
 *     the hardware semantics anyway.
 *   - the stored value is always 0x00; the stride is always 4.
 *
 * Every target the game hands it lies inside the sprite shadow buffer, so in practice this
 * blanks a stride-4 column — one field of each 4-byte sprite record — across a run of
 * records, during board and cutscene setup and again when the player dies. The routine
 * itself is generic, though: HL and B are caller-supplied and it names no fixed cell.
 *
 * A LEAF: it calls nothing.
 *
 * LIVE-OUT: memory (the B bytes, each set to 0x00) + A / HL / B. A = the final low byte,
 * (L + 4*B) & 0xFF; HL = the page carrying that low byte, the high byte preserved because
 * nothing here writes it; B = 0. Those three are reproduced faithfully because one exit path
 * returns into a caller whose register use is not accounted for here. Flags are not
 * reproduced: the loop sets none, and the final add's carry/zero is consumed by no caller.
 */
export function clearStridedBytes(m) {
  const { regs, mem } = m;

  const page = regs.hl & 0xff00; // the page; never written, so it is preserved
  let lo = regs.hl & 0xff; // the low byte; the +4 walk stays 8-bit (in-page)
  // The count is decremented THEN tested, so B == 0 means 256 passes, not zero.
  const count = regs.b === 0 ? 256 : regs.b;

  for (let i = 0; i < count; i++) {
    mem.write8(page | lo, 0x00); // the constant clear
    lo = (lo + 4) & 0xff; // low byte only, wraps within the page
  }

  // Live-out registers: A is the final low byte (= L + 4*B mod 256), HL is the page
  // carrying it (high byte preserved), B has counted down to 0.
  regs.a = lo;
  regs.hl = page | lo;
  regs.b = 0;
}
