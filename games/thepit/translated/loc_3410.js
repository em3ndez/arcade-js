// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_3410  (ROM 0x3410-0x3424) — table search: scan a 32-byte row of the
 * 0x35fe table for a key byte. The row is selected by the index at 0x808d
 * (row base = 0x35fe + that index); the key searched for is the byte at
 * (word@0x8089)+1. Leaves the Z flag set iff the key was found, with HL =
 * matched address + 1 (cpir POST-increments). The caller branches on Z.
 *
 *   3410  3a 8d 80     ld   a,(0x808d)
 *   3413  5f           ld   e,a
 *   3414  16 00        ld   d,0x00
 *   3416  2a 89 80     ld   hl,(0x8089)
 *   3419  23           inc  hl
 *   341a  7e           ld   a,(hl)
 *   341b  21 fe 35     ld   hl,0x35fe
 *   341e  19           add  hl,de
 *   341f  01 20 00     ld   bc,0x0020
 *   3422  ed b1        cpir
 *   3424  c9           ret
 *
 * DE = the 0x808d index zero-extended to 16 bits (d:=0, e:=a). The key comes
 * from (word@0x8089)+1, so the `inc hl` is load-bearing — dropping it reads the
 * wrong byte. `add hl,de` sets H/N/C but no code here reads them; the ONLY
 * result the caller consumes is the Z flag (and HL) that cpir leaves. cpir cost
 * is 21 T per iteration except the terminating one (16 T) => 21*(n-1) + 16, NOT
 * a constant; regs.cpir(mem) returns n exactly so this can be charged.
 */
export function loc_3410(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x808d);
  m.step(0x3413, 13); // ld a,(0x808d)
  regs.e = regs.a;
  m.step(0x3414, 4); // ld e,a
  regs.d = 0x00;
  m.step(0x3416, 7); // ld d,0x00 -- DE = the row index, zero-extended
  regs.hl = mem.read16(0x8089);
  m.step(0x3419, 16); // ld hl,(0x8089)
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x341a, 6); // inc hl -- 16-bit inc, affects no flags
  regs.a = mem.read8(regs.hl);
  m.step(0x341b, 7); // ld a,(hl) -- the search key = byte at (word@0x8089)+1
  regs.hl = 0x35fe;
  m.step(0x341e, 10); // ld hl,0x35fe -- table base
  regs.addHl(regs.de); // HL = 0x35fe + DE; sets H/N/C (unread here)
  m.step(0x341f, 11); // add hl,de
  regs.bc = 0x0020;
  m.step(0x3422, 10); // ld bc,0x0020 -- 32-byte row
  const n = regs.cpir(mem); // scan; Z set iff A matched, HL = M+1, BC = 0x20 - n
  m.step(0x3424, 21 * (n - 1) + 16); // cpir -- NOT a constant (see header)
  m.ret(); // ret
}
