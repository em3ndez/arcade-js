// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_3425  (ROM 0x3425-0x3457) — two-stage 0x34fe/0x35fe table lookup keyed on
 * the index at 0x808d. Saves the pointer (word@0x8089)+0x20 to 0x8134, reads the
 * byte it points at, and scans the row (0x34fe + ((0x808d)+0x20)) of 32 bytes for
 * it with `cpir`. If that key is NOT found -> return (ret nz). If (0x808d) == 0 ->
 * return (ret z). Otherwise read the FOLLOWING byte (via ix = the saved pointer,
 * ix+1) and scan the row (0x35fe + ((0x808d)-0x20)) of 32 bytes for it, then ret.
 * Both `add hl,de/bc` set H/N/C but no code reads them; the consumed results are
 * the Z flag and HL that each cpir leaves. D is set to 0 once and feeds both DE
 * builds (e is reloaded via `sub 0x20`), so DE is always the zero-extended index.
 *
 *   3425  3a 8d 80     ld   a,(0x808d)
 *   3428  c6 20        add  a,0x20
 *   342a  5f           ld   e,a
 *   342b  16 00        ld   d,0x00
 *   342d  2a 89 80     ld   hl,(0x8089)
 *   3430  01 20 00     ld   bc,0x0020
 *   3433  09           add  hl,bc
 *   3434  22 34 81     ld   (0x8134),hl
 *   3437  7e           ld   a,(hl)
 *   3438  21 fe 34     ld   hl,0x34fe
 *   343b  19           add  hl,de
 *   343c  ed b1        cpir
 *   343e  c0           ret  nz              ; key not found in the 0x34fe row -> done
 *   343f  3a 8d 80     ld   a,(0x808d)
 *   3442  a7           and  a
 *   3443  c8           ret  z               ; index 0 -> done
 *   3444  d6 20        sub  0x20
 *   3446  5f           ld   e,a
 *   3447  dd 2a 34 81  ld   ix,(0x8134)
 *   344b  dd 7e 01     ld   a,(ix+0x01)
 *   344e  21 fe 35     ld   hl,0x35fe
 *   3451  19           add  hl,de
 *   3452  01 20 00     ld   bc,0x0020
 *   3455  ed b1        cpir
 *   3457  c9           ret
 */
export function sub_3425(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x808d);
  m.step(0x3428, 13); // ld a,(0x808d)
  regs.add(0x20);
  m.step(0x342a, 7); // add a,0x20 -- 0x34fe row index = (0x808d)+0x20
  regs.e = regs.a;
  m.step(0x342b, 4); // ld e,a
  regs.d = 0x00;
  m.step(0x342d, 7); // ld d,0x00 -- DE = index, zero-extended
  regs.hl = mem.read16(0x8089);
  m.step(0x3430, 16); // ld hl,(0x8089)
  regs.bc = 0x0020;
  m.step(0x3433, 10); // ld bc,0x0020
  regs.addHl(regs.bc); // HL = (word@0x8089) + 0x20; sets H/N/C (unread here)
  m.step(0x3434, 11); // add hl,bc
  mem.write16(0x8134, regs.hl);
  m.step(0x3437, 16); // ld (0x8134),hl -- save the pointer for the ix reload below
  regs.a = mem.read8(regs.hl);
  m.step(0x3438, 7); // ld a,(hl) -- first search key = byte at the pointer
  regs.hl = 0x34fe;
  m.step(0x343b, 10); // ld hl,0x34fe -- table 1 base
  regs.addHl(regs.de); // HL = 0x34fe + DE; sets H/N/C (unread here)
  m.step(0x343c, 11); // add hl,de
  const n1 = regs.cpir(mem); // scan; Z set iff A matched, HL = M+1, BC = 0x20 - n1
  m.step(0x343e, 21 * (n1 - 1) + 16); // cpir -- NOT a constant (first-use cost)

  if (regs.fNZ) {
    m.ret(11); // ret nz -- key not in the 0x34fe row, done
    return;
  }
  m.step(0x343f, 5); // ret nz NOT taken

  regs.a = mem.read8(0x808d);
  m.step(0x3442, 13); // ld a,(0x808d)
  regs.and(regs.a);
  m.step(0x3443, 4); // and a -- test the index for zero
  if (regs.fZ) {
    m.ret(11); // ret z -- index 0, done
    return;
  }
  m.step(0x3444, 5); // ret z NOT taken

  regs.sub(0x20);
  m.step(0x3446, 7); // sub 0x20 -- 0x35fe row index = (0x808d)-0x20
  regs.e = regs.a;
  m.step(0x3447, 4); // ld e,a -- DE rebuilt (d still 0)
  regs.ix = mem.read16(0x8134);
  m.step(0x344b, 20); // ld ix,(0x8134) -- reload the saved pointer
  regs.a = mem.read8((regs.ix + 0x01) & 0xffff);
  m.step(0x344e, 19); // ld a,(ix+0x01) -- second search key = the FOLLOWING byte
  regs.hl = 0x35fe;
  m.step(0x3451, 10); // ld hl,0x35fe -- table 2 base
  regs.addHl(regs.de); // HL = 0x35fe + DE; sets H/N/C (unread here)
  m.step(0x3452, 11); // add hl,de
  regs.bc = 0x0020;
  m.step(0x3455, 10); // ld bc,0x0020 -- 32-byte row
  const n2 = regs.cpir(mem); // scan; Z set iff A matched, HL = M+1, BC = 0x20 - n2
  m.step(0x3457, 21 * (n2 - 1) + 16); // cpir -- NOT a constant (first-use cost)
  m.ret(); // ret
}
