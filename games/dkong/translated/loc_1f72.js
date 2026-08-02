// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1f72  (ROM 0x1F72–0x1F81) — <-> loc_21ba SCC -- OBJECT DISPATCH + the shared object-sprite tail.
 * ROM 0x1F72-0x2117 (1f72) + 0x2118-0x216A + 0x21BA-0x21D0 (the 0x21xx cluster).
 * Integrated TOGETHER (mutual recursion: loc_21ba's `jp 0x1f8d` re-enters 1f72's
 * loop; 1f72's branches `jp 0x21ba` reach the shared tail).
 *
 * Not yet wired into the live dispatcher: called from loc_197a @0x1983 (handler_1977
 * cascade, untranslated); nothing in translated src invokes loc_1f72 / the 21xx
 * cluster. Goes live at the finale (step 4).
 *
 * loc_1f72 scans 10 object slots @0x6700 (stride 0x20), and for each state-1 slot
 * dispatches on (ix+1)/(ix+2) bits to one of FIVE `exx` handlers. Runs only on
 * (0x6227)==1. The loop is modelled as FUNCTIONS (loc_1f83 slot-check / loc_1f8d
 * advance) -- NOT a do-while -- precisely so loc_21ba can re-enter at 0x1f8d.
 *
 * ** exx IS A PROJECT-FIRST ** (first executable use of the shadow register file).
 * regs.exx() swaps EXACTLY BC/DE/HL, leaves AF/IX/IY/SP untouched -- so after exx
 * `(ix+d)` still uses the MAIN ix. The five branches exx into the shadow to do
 * their work and `jp 0x21ba` WITHOUT unswapping; loc_21ba's LEADING exx
 * is the downstream unswap that restores the loop's main set (HL/IX/DE/B) for
 * 0x1f8d -- a register-state contract on all 13 entries, modelled
 * LITERALLY, never special-cased per caller. loc_1f8d / loc_1fce are shared entry
 * points tail-reached from 0x21CE / 0x210B -- their layout is load-bearing.
 * Object fields not interpreted.
 */
export function loc_1f72(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x6227);
  m.step(0x1f75, 13); // ld a,(0x6227)
  regs.a = regs.dec8(regs.a);
  m.step(0x1f76, 4); // dec a
  if (regs.fNZ) { m.ret(11); return; } // ret nz -- not phase 1
  m.step(0x1f77, 5);
  regs.ix = 0x6700;
  m.step(0x1f7b, 14); // ld ix,0x6700
  regs.hl = 0x6980;
  m.step(0x1f7e, 10); // ld hl,0x6980
  regs.de = 0x0020; // slot stride (LOCAL, not live-in)
  m.step(0x1f81, 10); // ld de,0x0020
  regs.b = 0x0a; // 10 slots
  m.step(0x1f83, 7); // ld b,0x0a
  return m.call(0x1f83);
}
