// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_33da  (ROM 0x33DA-0x340F) — two cpir table-searches keyed on (0x808D),
 * over the cell one row (0x20) ABOVE the tilemap pointer at (0x8089).
 *
 *   33da  3a 8d 80     ld   a,(0x808d)
 *   33dd  c6 20        add  a,0x20
 *   33df  5f           ld   e,a
 *   33e0  16 00        ld   d,0x00              ; de = (0x808d)+0x20
 *   33e2  2a 89 80     ld   hl,(0x8089)
 *   33e5  01 e0 ff     ld   bc,0xffe0
 *   33e8  09           add  hl,bc               ; hl = (0x8089) - 0x20
 *   33e9  22 34 81     ld   (0x8134),hl         ; save that pointer
 *   33ec  7e           ld   a,(hl)              ; key1 = byte one row up
 *   33ed  21 fe 34     ld   hl,0x34fe
 *   33f0  19           add  hl,de               ; hl = 0x34fe + de
 *   33f1  01 20 00     ld   bc,0x0020
 *   33f4  ed b1        cpir                     ; search 32 entries for key1
 *   33f6  c0           ret  nz                  ; not found -> done
 *   33f7  3a 8d 80     ld   a,(0x808d)
 *   33fa  a7           and  a
 *   33fb  c8           ret  z                   ; (0x808d) == 0 -> done
 *   33fc  d6 20        sub  0x20
 *   33fe  5f           ld   e,a                 ; de = (0x808d)-0x20 (d still 0)
 *   33ff  dd 2a 34 81  ld   ix,(0x8134)         ; the saved pointer
 *   3403  dd 7e 01     ld   a,(ix+0x01)         ; key2 = adjacent byte
 *   3406  21 fe 35     ld   hl,0x35fe
 *   3409  19           add  hl,de               ; hl = 0x35fe + de
 *   340a  01 20 00     ld   bc,0x0020
 *   340d  ed b1        cpir                     ; search a second 32-entry table
 *   340f  c9           ret
 *
 * Two searches, both via cpir over BC=0x20 entries into ROM tables based at
 * 0x34FE / 0x35FE. The first is keyed on the tile one row above the write
 * pointer (0x8089)-0x20 (also stashed at 0x8134 and reloaded into IX); on a hit,
 * and only when (0x808D) != 0, a second search runs over the 0x35xx table from
 * the adjacent cell. cpir POST-increments HL, and its found/not-found signal is
 * the Z FLAG (not the return value) -- so `ret nz` at 0x33F6 is the miss exit.
 * cpir(mem) returns the iteration count n, so the (21*(n-1)+16) T-state cost of
 * each cpir is charged exactly rather than as a constant.
 *
 * D is set to 0 once (0x33E0) and never touched again, so the second `add hl,de`
 * at 0x3409 also runs with D = 0.
 */
export function loc_33da(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x808d);
  m.step(0x33dd, 13); // ld a,(0x808d)
  regs.add(0x20);
  m.step(0x33df, 7); // add a,0x20
  regs.e = regs.a;
  m.step(0x33e0, 4); // ld e,a
  regs.d = 0x00;
  m.step(0x33e2, 7); // ld d,0x00
  regs.hl = mem.read16(0x8089);
  m.step(0x33e5, 16); // ld hl,(0x8089)
  regs.bc = 0xffe0;
  m.step(0x33e8, 10); // ld bc,0xffe0
  regs.addHl(regs.bc); // hl = (0x8089) - 0x20
  m.step(0x33e9, 11); // add hl,bc
  mem.write16(0x8134, regs.hl);
  m.step(0x33ec, 16); // ld (0x8134),hl
  regs.a = mem.read8(regs.hl); // key1
  m.step(0x33ed, 7); // ld a,(hl)
  regs.hl = 0x34fe;
  m.step(0x33f0, 10); // ld hl,0x34fe
  regs.addHl(regs.de); // hl = 0x34fe + de
  m.step(0x33f1, 11); // add hl,de
  regs.bc = 0x0020;
  m.step(0x33f4, 10); // ld bc,0x0020

  const n1 = regs.cpir(mem); // A vs (HL); HL post-inc; BC--; Z set iff matched
  m.step(0x33f6, 21 * (n1 - 1) + 16); // cpir -- NOT a constant (per-iteration cost)

  if (regs.fNZ) {
    m.ret(11); // ret nz -- key1 not present in the 0x34xx table
    return;
  }
  m.step(0x33f7, 5); // ret nz NOT taken

  regs.a = mem.read8(0x808d);
  m.step(0x33fa, 13); // ld a,(0x808d)
  regs.and(regs.a);
  m.step(0x33fb, 4); // and a

  if (regs.fZ) {
    m.ret(11); // ret z -- (0x808d) == 0, skip the second search
    return;
  }
  m.step(0x33fc, 5); // ret z NOT taken

  regs.sub(0x20);
  m.step(0x33fe, 7); // sub 0x20
  regs.e = regs.a; // de = (0x808d)-0x20 -- D untouched since 0x33E0, still 0
  m.step(0x33ff, 4); // ld e,a
  regs.ix = mem.read16(0x8134);
  m.step(0x3403, 20); // ld ix,(0x8134)
  regs.a = mem.read8((regs.ix + 0x01) & 0xffff); // key2
  m.step(0x3406, 19); // ld a,(ix+0x01)
  regs.hl = 0x35fe;
  m.step(0x3409, 10); // ld hl,0x35fe
  regs.addHl(regs.de); // hl = 0x35fe + de
  m.step(0x340a, 11); // add hl,de
  regs.bc = 0x0020;
  m.step(0x340d, 10); // ld bc,0x0020

  const n2 = regs.cpir(mem);
  m.step(0x340f, 21 * (n2 - 1) + 16); // cpir

  m.ret(10); // ret (0x340F)
}
