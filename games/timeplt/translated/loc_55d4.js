// SPDX-License-Identifier: GPL-3.0-only

// loc_55d4  (ROM 0x55D4–0x55EC)
export function loc_55d4(m) {
  const { regs, mem } = m;

  regs.hl = 0xac43;
  m.step(0x55d7, 10); // ld hl,0xac43
  regs.a = mem.read8(regs.hl);
  m.step(0x55d8, 7); // ld a,(hl)
  regs.and(regs.a);
  m.step(0x55d9, 4); // and a
  if (regs.fZ) {
    m.ret(11); // ret z -- queue empty
    return;
  }
  m.step(0x55da, 5); // ret z NOT taken

  regs.decMem8(mem, regs.hl); // dec (hl) -- SETS the Z read at 0x55E2
  m.step(0x55db, 11); // dec (hl)
  m.push16(regs.af); // push af -- carries that Z (and the pre-dec A) over the call
  m.step(0x55dc, 11); // push af
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x55dd, 6); // inc hl
  regs.a = mem.read8(regs.hl);
  m.step(0x55de, 7); // ld a,(hl)

  m.push16(0x55e1);
  m.step(0x55f8, 17); // call 0x55f8
  m.call(0x55f8);

  regs.af = m.pop16(); // pop af -- the pre-dec A, and F from the dec (hl) at 0x55DA
  m.step(0x55e2, 10); // pop af
  if (regs.fZ) {
    m.ret(11); // ret z -- that was the last entry
    return;
  }
  m.step(0x55e3, 5); // ret z NOT taken

  regs.a = regs.dec8(regs.a);
  m.step(0x55e4, 4); // dec a
  regs.b = 0x00;
  m.step(0x55e6, 7); // ld b,0x00
  regs.c = regs.a;
  m.step(0x55e7, 4); // ld c,a -- BC = entries remaining
  regs.e = regs.l;
  m.step(0x55e8, 4); // ld e,l
  regs.d = regs.h;
  m.step(0x55e9, 4); // ld d,h -- DE = the consumed slot
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x55ea, 6); // inc hl -- HL = the next slot

  m.ldirAt(0x55ea, 0x55ec); // ldir -- slide the queue down one

  m.ret(); // 55ec
}
