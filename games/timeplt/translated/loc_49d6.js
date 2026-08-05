// SPDX-License-Identifier: GPL-3.0-only

// loc_49d6  (ROM 0x49d6-0x49f9, Time Pilot)
export function loc_49d6(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xa982);
  m.step(0x49d9, 13); // 49d6  ld a,(0xa982)
  regs.and(regs.a);
  m.step(0x49da, 4); // 49d9  and a

  if (regs.fZ) {
    m.ret(11); // ret z taken
    return;
  }
  m.step(0x49db, 5); // ret z not taken

  regs.hl = 0xa985;
  m.step(0x49de, 10); // 49db  ld hl,0xa985
  regs.a = mem.read8(regs.hl);
  m.step(0x49df, 7); // 49de  ld a,(hl)
  regs.and(regs.a);
  m.step(0x49e0, 4); // 49df  and a

  if (regs.fNZ) {
    m.step(0x49e9, 12); // jr nz taken
  } else {
    m.step(0x49e2, 7); // jr nz not taken

    mem.write8(regs.hl, 0x30);
    m.step(0x49e4, 10); // 49e2  ld (hl),0x30 -- arm the countdown
    regs.a = regs.inc8(regs.a); // A was 0 here -> 1
    m.step(0x49e5, 4); // 49e4  inc a
    mem.write8(0xc30c, regs.a, 10);
    m.step(0x49e8, 13); // 49e5  ld (0xc30c),a -- LS259 line set

    m.ret(); // 49e8  ret
    return;
  }

  regs.decMem8(mem, regs.hl);
  m.step(0x49ea, 11); // 49e9  dec (hl)

  if (regs.fZ) {
    m.step(0x49f5, 12); // jr z taken

    regs.hl = 0xa982;
    m.step(0x49f8, 10); // 49f5  ld hl,0xa982
    regs.decMem8(mem, regs.hl);
    m.step(0x49f9, 11); // 49f8  dec (hl)

    m.ret(); // 49f9  ret
    return;
  }
  m.step(0x49ec, 7); // jr z not taken

  regs.a = mem.read8(regs.hl);
  m.step(0x49ed, 7); // 49ec  ld a,(hl)
  regs.cp(0x18);
  m.step(0x49ef, 7); // 49ed  cp 0x18 -- halfway through the 0x30 count

  if (regs.fNZ) {
    m.ret(11); // ret nz taken
    return;
  }
  m.step(0x49f0, 5); // ret nz not taken

  regs.xor(regs.a);
  m.step(0x49f1, 4); // 49f0  xor a
  mem.write8(0xc30c, regs.a, 10);
  m.step(0x49f4, 13); // 49f1  ld (0xc30c),a -- LS259 line cleared

  m.ret(); // 49f4  ret
}
