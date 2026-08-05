// SPDX-License-Identifier: GPL-3.0-only

// loc_4dde  (ROM 0x4DDE-0x4E1A, Time Pilot)
export function loc_4dde(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xad30);
  m.step(0x4de1, 13); // ld a,(0xad30)
  regs.and(regs.a);
  m.step(0x4de2, 4); // and a
  if (regs.fZ) {
    m.ret(11); // ret z taken -- feature disabled
    return;
  }
  m.step(0x4de3, 5); // ret z NOT taken

  regs.a = mem.read8(0xa9c3);
  m.step(0x4de6, 13); // ld a,(0xa9c3)
  regs.and(0x01);
  m.step(0x4de8, 7); // and 0x01
  regs.hl = 0x4e1b;
  m.step(0x4deb, 10); // ld hl,0x4e1b -- default table
  if (regs.fZ) {
    m.step(0x4df0, 12); // jr z,0x4df0 taken -- keep 0x4E1B
  } else {
    m.step(0x4ded, 7); // jr z NOT taken
    regs.hl = 0x4e30;
    m.step(0x4df0, 10); // ld hl,0x4e30 -- the other table
  }

  regs.c = mem.read8(regs.hl);
  m.step(0x4df1, 7); // ld c,(hl) -- the table's length byte
  regs.b = 0x00;
  m.step(0x4df3, 7); // ld b,0x00 -- BC = the cpir count
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x4df4, 6); // inc hl -- first entry
  regs.a = mem.read8(0xad32);
  m.step(0x4df7, 13); // ld a,(0xad32)
  regs.and(regs.a);
  m.step(0x4df8, 4); // and a -- Z iff (0xAD32) == 0
  regs.a = mem.read8(0xad35); // `ld a,(nn)` sets NO flags: the Z above survives
  m.step(0x4dfb, 13); // ld a,(0xad35)
  if (regs.fZ) {
    m.step(0x4e00, 12); // jr z,0x4e00 taken -- key stays (0xAD35)
  } else {
    m.step(0x4dfd, 7); // jr z NOT taken
    regs.a = mem.read8(0xad38);
    m.step(0x4e00, 13); // ld a,(0xad38) -- the other key
  }

  const n = regs.cpir(mem); // 21 T per repeat, 16 T for the last
  m.step(0x4e02, 21 * (n - 1) + 16); // cpir -- Z set iff the key was found
  regs.hl = 0xad03; // the search address is discarded; only Z matters
  m.step(0x4e05, 10); // ld hl,0xad03

  if (regs.fNZ) {
    m.step(0x4e18, 12); // jr nz,0x4e18 taken -- MISS

    mem.write8(regs.hl, regs.res(0, mem.read8(regs.hl)));
    m.step(0x4e1a, 15); // res 0,(hl) -- rearm the one-shot
    m.ret(10); // ret
    return;
  }
  m.step(0x4e07, 7); // jr nz NOT taken -- HIT

  regs.bit(0, mem.read8(regs.hl));
  m.step(0x4e09, 12); // bit 0,(hl)
  if (regs.fNZ) {
    m.ret(11); // ret nz taken -- already fired
    return;
  }
  m.step(0x4e0a, 5); // ret nz NOT taken

  mem.write8(regs.hl, regs.set(0, mem.read8(regs.hl)));
  m.step(0x4e0c, 15); // set 0,(hl) -- latch the one-shot
  regs.hl = 0xad00;
  m.step(0x4e0f, 10); // ld hl,0xad00
  regs.a = mem.read8(regs.hl);
  m.step(0x4e10, 7); // ld a,(hl) -- the pre-increment value
  regs.incMem8(mem, regs.hl);
  m.step(0x4e11, 11); // inc (hl)
  regs.d = 0x05;
  m.step(0x4e13, 7); // ld d,0x05
  regs.e = regs.a;
  m.step(0x4e14, 4); // ld e,a

  m.push16(0x4e15);
  m.step(0x0038, 11); // rst 0x38 -- queue the (D,E) pair
  m.call(0x0038);

  m.step(0x5805, 10); // jp 0x5805 -- tail-jump; its ret returns to OUR caller
  return m.call(0x5805);
}
