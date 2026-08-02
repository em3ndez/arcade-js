// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_31dd  (ROM 0x31DD–0x31F5) — 25 bytes, 13 instructions.
 *
 *   31dd  3a 80 63     ld   a,(0x6380)
 *   31e0  fe 03        cp   0x03
 *   31e2  f8           ret  m             ; SIGNED return (A-3 negative), NOT ret c
 *   31e3  cd f6 31     call 0x31f6        ; callee returns a value in A
 *   31e6  fe 01        cp   0x01
 *   31e8  c0           ret  nz
 *   31e9  21 39 64     ld   hl,0x6439
 *   31ec  3e 02        ld   a,0x02
 *   31ee  77           ld   (hl),a
 *   31ef  21 79 64     ld   hl,0x6479
 *   31f2  3e 02        ld   a,0x02
 *   31f4  77           ld   (hl),a
 *   31f5  c9           ret
 *
 * Translated for completeness; not yet wired into the live dispatcher.
 * Not yet wired into the live dispatcher: only caller is 0x31B1 (entry_31b1, the object
 * processor, untranslated), and nothing in translated src invokes loc_31dd.
 *
 * A three-part gated write: writes 2 to 0x6439 AND 0x6479 only when 0x6380 >= 3
 * (signed) AND sub_31f6() == 1 (i.e. (0x6018&3)==1 AND 0x601a==1). Now unblocked
 * -- its callee sub_31f6 landed in drain #10.
 *
 * `ret m` (0x31E2) is the FIRST translated use of the SIGN flag in control flow.
 * It returns on fM (F_S = bit 7 of A-3), NOT carry: for A >= 0x83 it diverges
 * from `ret c` (A=0x83 -> A-3=0x80, sign set -> ret m returns, carry clear -> ret
 * c would not). Latent on real tapes (sub_30fa clamps 0x6380 < 6), but the
 * instruction is signed -- pinned by a SYNTHETIC 0x83 test. fM reads F_S,
 * which `cp` sets correctly (already tested); no cpu.js change needed. Both
 * conditional rets FALL THROUGH; 0x6380/0x6439/0x6479 not interpreted.
 */
export function loc_31dd(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x6380);
  m.step(0x31e0, 13); // ld a,(0x6380)
  regs.cp(0x03);
  m.step(0x31e2, 7); // cp 0x03
  if (regs.fM) {
    m.ret(11); // ret m -- SIGNED (fM = sign of A-3), NOT fC
    return;
  }
  m.step(0x31e3, 5); // ret m NOT taken -- fall through

  m.push16(0x31e6);
  m.step(0x31f6, 17); // call 0x31f6
  m.call(0x31f6); // returns a value in A; cp 0x01 below re-sets the flags

  regs.cp(0x01);
  m.step(0x31e8, 7); // cp 0x01
  if (regs.fNZ) {
    m.ret(11); // ret nz -- A != 1
    return;
  }
  m.step(0x31e9, 5); // ret nz NOT taken -- fall through

  regs.hl = 0x6439;
  m.step(0x31ec, 10); // ld hl,0x6439
  regs.a = 0x02;
  m.step(0x31ee, 7); // ld a,0x02
  mem.write8(regs.hl, regs.a);
  m.step(0x31ef, 7); // ld (hl),a
  regs.hl = 0x6479;
  m.step(0x31f2, 10); // ld hl,0x6479
  regs.a = 0x02;
  m.step(0x31f4, 7); // ld a,0x02
  mem.write8(regs.hl, regs.a);
  m.step(0x31f5, 7); // ld (hl),a

  m.ret(); // 31f5
}
