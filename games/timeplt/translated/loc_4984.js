// SPDX-License-Identifier: GPL-3.0-only

// loc_4984  (ROM 0x4984–0x49A7)
export function loc_4984(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xa981);
  m.step(0x4987, 13); // ld a,(0xa981)
  regs.and(regs.a);
  m.step(0x4988, 4); // and a
  if (regs.fZ) {
    m.step(m.pop16(), 11); // ret z
    return;
  }
  m.step(0x4989, 5);

  regs.hl = 0xa984;
  m.step(0x498c, 10); // ld hl,0xa984
  regs.a = mem.read8(regs.hl);
  m.step(0x498d, 7); // ld a,(hl)
  regs.and(regs.a);
  m.step(0x498e, 4); // and a
  if (regs.fZ) {
    m.step(0x4990, 7); // jr nz not taken -- timer idle, start it

    mem.write8(regs.hl, 0x30);
    m.step(0x4992, 10); // ld (hl),0x30
    regs.a = regs.inc8(regs.a); // A was 0 here, so this writes 1
    m.step(0x4993, 4); // inc a
    mem.write8(0xc30a, regs.a, 10); // LS259 latch line 5
    m.step(0x4996, 13); // ld (0xc30a),a

    m.ret(); // 4996
    return;
  }
  m.step(0x4997, 12); // jr nz,0x4997

  regs.decMem8(mem, regs.hl);
  m.step(0x4998, 11); // dec (hl)
  if (regs.fZ) {
    m.step(0x49a3, 12); // jr z,0x49a3

    regs.hl = 0xa981;
    m.step(0x49a6, 10); // ld hl,0xa981
    regs.decMem8(mem, regs.hl);
    m.step(0x49a7, 11); // dec (hl)

    m.ret(); // 49a7
    return;
  }
  m.step(0x499a, 7);

  regs.a = mem.read8(regs.hl);
  m.step(0x499b, 7); // ld a,(hl)
  regs.cp(0x18); // exactly half way
  m.step(0x499d, 7); // cp 0x18
  if (regs.fNZ) {
    m.step(m.pop16(), 11); // ret nz
    return;
  }
  m.step(0x499e, 5);

  regs.xor(regs.a);
  m.step(0x499f, 4); // xor a
  mem.write8(0xc30a, regs.a, 10); // LS259 latch line 5
  m.step(0x49a2, 13); // ld (0xc30a),a

  m.ret(); // 49a2
}
