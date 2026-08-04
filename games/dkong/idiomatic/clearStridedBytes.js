// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearStridedBytes — zero B bytes at stride 4, walking the LOW address byte only.  ROM 0x30e4.
 *
 * A tiny memory-clear primitive. Starting at the pointer HL, it stores the constant
 * 0x00 to B bytes spaced four apart, stepping the pointer by +4 between stores. The
 * step is applied to the LOW byte alone (`ld l,a`, never a 16-bit `add hl,4`), so an
 * L overflow WRAPS within the current 256-byte page and never carries into H — the
 * clear is confined to one page. That in-page confinement is the routine's defining
 * property and the thing a careless 16-bit rewrite would break.
 *
 *   - do-while: the loop is a `djnz`, which decrements B THEN tests, so the body
 *     always runs at least once and B == 0 on entry means 256 passes, not zero. No
 *     caller passes 0; the loop mirrors the hardware semantics anyway.
 *   - the stored value is always the literal 0x00; the stride is always 4.
 *
 * The five entry paths all funnel through the same body, and attract exercises every
 * one of them — four from sub_30bd (clearing 2 / 10 / 11 / 5 bytes at 0x6950 / 0x6980
 * / 0x69b8 / 0x6a0c) and one from entry_30db's fallthrough (6 bytes at 0x6958). Every
 * target lies inside the 0x6900 sprite shadow buffer, so in practice this blanks a
 * stride-4 column (one field of each 4-byte sprite record) across a run of records
 * during board/cutscene setup — but the routine itself is generic: HL and B are
 * caller-supplied and it names no fixed address. It also feeds the handler_1977 finale.
 *
 * A LEAF: it calls nothing.
 *
 * Memory-equivalent to the frozen oracle — equivalence-30e4.test.js.
 * GATE:     crafted-entry — real captured attract dispatches covering all five caller
 *           shapes (B = 2/5/6/10/11), plus crafted entries for the arms attract never
 *           reaches: the B = 0 → 256-pass djnz edge, and the in-page L-wrap (0x69f8 →
 *           0x6900, NOT 0x6a00) that pins the low-byte-only walk. Not exhaustive (the
 *           input is page contents × HL × B). Teeth: a wrong-stride twin and a
 *           16-bit-pointer twin that carries into H on the wrap.
 * LIVE-OUT: memory (the B bytes, each set to 0x00) + regs A / HL / B — A = the final
 *           low byte = (L + 4*B) & 0xFF; HL = the page with that low byte (H preserved,
 *           since nothing here writes it); B = 0. A/HL/B are dead at the traced return
 *           sites (sub_30bd reloads L and B between runs and does a full HL reload
 *           before the tail jump; loc_12de reloads HL and A right after the fallthrough),
 *           but the tail-jump path rets into untranslated callers (0x12A3 / 0x1615) and
 *           handler_1977's cascade, so A/HL/B are kept faithful to the oracle rather
 *           than dropped. FLAGS are dropped as dead: `djnz` sets none, and the final
 *           `add a,4` carry/zero is consumed by no traced caller.
 * NAMES:    none from names.js — HL and B are caller-supplied. The targets fall inside
 *           SPRITE_BUFFER (0x6900), noted for context, but the routine references no
 *           fixed game RAM address. 0x30e4/0x30e5 stay hex, in this header only.
 */
export function clearStridedBytes(m) {
  const { regs, mem } = m;

  const page = regs.hl & 0xff00; // H — the page; never written, so it is preserved
  let lo = regs.hl & 0xff; // L — the low byte; the +4 walk stays 8-bit (in-page)
  // `djnz` decrements THEN tests, so B == 0 means 256 passes, not zero.
  const count = regs.b === 0 ? 256 : regs.b;

  for (let i = 0; i < count; i++) {
    mem.write8(page | lo, 0x00); // ld (hl),0x00 — the constant clear
    lo = (lo + 4) & 0xff; // add a,4 / ld l,a — L only, wraps within the page
  }

  // Live-out registers, matching the oracle: A is the final low byte (= L + 4*B mod
  // 256), HL is the page carrying it (H preserved), B has counted down to 0.
  regs.a = lo;
  regs.hl = page | lo;
  regs.b = 0;
}
