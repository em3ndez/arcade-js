// SPDX-License-Identifier: GPL-3.0-only

/**
 * entry_33c3  (ROM 0x33C3–0x33D8) — 22 bytes, 8 instructions.
 *
 *   33c3  3a 27 62     ld   a,(0x6227)
 *   33c6  fe 01        cp   0x01
 *   33c8  c0           ret  nz            ; 0x6227 != 1 -> return
 *   33c9  dd 66 0e     ld   h,(ix+0x0e)
 *   33cc  dd 6e 0f     ld   l,(ix+0x0f)   ; HL = (ix+0x0e):(ix+0x0f)
 *   33cf  dd 46 0d     ld   b,(ix+0x0d)
 *  33d2 cd 33 23 call 0x2333 ; entry_2333 (< 0x3000) -> modified L
 *   33d5  dd 75 0f     ld   (ix+0x0f),l
 *   33d8  c9           ret
 *
 * Translated for completeness; not yet wired into the live dispatcher.
 * Not yet wired into the live dispatcher: called from 0x32AB (entry_3202, untranslated)
 * AND reached by fall-through from entry_33ad; nothing in translated src invokes
 * entry_33c3. IX live-in. One callee edge: entry_2333 (< 0x3000), which
 * takes HL/B and returns a modified L -- that register contract is load-bearing.
 *
 * SHARED TAIL WITH entry_33ad. entry_33ad has no ret of its own:
 * after its own field adjustments + call 0x3409 it FALLS THROUGH into this body
 * at 0x33C3, and this routine's ret ends both. The `0x6227 != 1` early-out means
 * entry_33ad's field work still happens, but the entry_2333 call stays gated on
 * 0x6227 == 1. 0x6227 / the object fields not interpreted.
 */
export function entry_33c3(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;

  regs.a = mem.read8(0x6227);
  m.step(0x33c6, 13); // ld a,(0x6227)
  regs.cp(0x01);
  m.step(0x33c8, 7); // cp 0x01
  if (regs.fNZ) {
    m.ret(11); // ret nz -- 0x6227 != 1
    return;
  }
  m.step(0x33c9, 5); // ret nz NOT taken

  regs.h = mem.read8(R(0x0e));
  m.step(0x33cc, 19); // ld h,(ix+0x0e)
  regs.l = mem.read8(R(0x0f));
  m.step(0x33cf, 19); // ld l,(ix+0x0f) -- HL = (ix+0x0e):(ix+0x0f)
  regs.b = mem.read8(R(0x0d));
  m.step(0x33d2, 19); // ld b,(ix+0x0d)

  m.push16(0x33d5);
  m.step(0x2333, 17); // call 0x2333
  m.call(0x2333); // entry_2333 (< 0x3000) -- returns a modified L

  mem.write8(R(0x0f), regs.l); // store the returned L
  m.step(0x33d8, 19); // ld (ix+0x0f),l
  m.ret(); // 33d8
}
