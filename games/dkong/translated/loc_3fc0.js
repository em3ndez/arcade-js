// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_3fc0  (ROM 0x3FC0–0x3FC7) — 8 bytes, 5 instructions.
 *
 *   3fc0  21 4d 69     ld   hl,0x694d
 *   3fc3  36 03        ld   (hl),0x03
 *   3fc5  2c           inc  l             ; HL -> 0x694E (no write)
 *   3fc6  2c           inc  l             ; HL -> 0x694F (no write)
 *   3fc7  c9           ret
 *
 * Translated for completeness; not yet wired into the live dispatcher.
 * Not yet wired into the live dispatcher: only caller is 0x2285 (untranslated), and
 * nothing in translated src invokes loc_3fc0. Leaf, calls nothing.
 *
 * Writes mem[0x694D] = 3, then advances HL to 0x694F (skipping 0x694E, unwritten)
 * via two `inc l`. HL is LIVE-OUT at 0x694F -- the two write-free `inc l` are the
 * routine's only product besides the store, so the caller consumes HL.
 *
 * `inc l` is a REGISTER inc (L only, not `inc hl`): regs.inc8(regs.l), which sets
 * S/Z/H/PV (carry preserved) -- flags the ret leaves live. inc8, NOT incMem8:
 * this is a register inc, not a memory RMW. A plain `regs.l+1` would drop the
 * flags (the sub_0593 lesson); `inc hl` would carry into H at a page wrap (latent
 * here -- L runs 0x4D->0x4F, no wrap; the routine hardcodes HL so no input can
 * reach the boundary, so the inc-l-vs-inc-hl divergence is untestable as written).
 */
export function loc_3fc0(m) {
  const { regs, mem } = m;

  regs.hl = 0x694d;
  m.step(0x3fc3, 10); // ld hl,0x694d
  mem.write8(regs.hl, 0x03);
  m.step(0x3fc5, 10); // ld (hl),0x03
  regs.l = regs.inc8(regs.l); // inc l -- L only, sets flags; HL -> 0x694E
  m.step(0x3fc6, 4); // inc l
  regs.l = regs.inc8(regs.l); // inc l -- HL -> 0x694F
  m.step(0x3fc7, 4); // inc l

  m.ret(); // 3fc7 -- HL = 0x694F live-out, flags = last inc l
}
