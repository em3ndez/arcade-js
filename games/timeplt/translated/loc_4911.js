// SPDX-License-Identifier: GPL-3.0-only

// loc_4911  (ROM 0x4911–0x4940)
export function loc_4911(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xa9ae);
  m.step(0x4914, 13); // ld a,(0xa9ae)
  regs.hl = 0xa9ca;
  m.step(0x4917, 10); // ld hl,0xa9ca
  regs.rrca();
  m.step(0x4918, 4); // rrca
  regs.rrca();
  m.step(0x4919, 4); // rrca
  mem.write8(regs.hl, regs.rl(mem.read8(regs.hl)));
  m.step(0x491b, 15); // rl (hl)
  regs.a = mem.read8(regs.hl);
  m.step(0x491c, 7); // ld a,(hl)
  regs.and(0x07);
  m.step(0x491e, 7); // and 0x07
  regs.cp(0x01);
  m.step(0x4920, 7); // cp 0x01
  if (regs.fNZ) {
    m.ret(11); // 0x4920 ret nz -- taken
    return;
  }
  m.step(0x4921, 5); // ret nz not taken

  regs.exDeHl();
  m.step(0x4922, 4); // ex de,hl
  m.push16(0x4925);
  m.step(0x57f1, 17); // call 0x57f1
  m.call(0x57f1);

  regs.hl = 0xa982;
  m.step(0x4928, 10); // ld hl,0xa982
  regs.incMem8(mem, regs.hl);
  m.step(0x4929, 11); // inc (hl)
  regs.exDeHl();
  m.step(0x492a, 4); // ex de,hl
  regs.hl = (regs.hl + 1) & 0xffff; // inc hl -- 16-bit, no flags
  m.step(0x492b, 6); // inc hl
  regs.a = mem.read8(regs.hl);
  m.step(0x492c, 7); // ld a,(hl)
  regs.add(0x10);
  m.step(0x492e, 7); // add a,0x10
  mem.write8(regs.hl, regs.a);
  m.step(0x492f, 7); // ld (hl),a
  regs.b = regs.a;
  m.step(0x4930, 4); // ld b,a
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x4931, 6); // inc hl
  regs.a = mem.read8(regs.hl);
  m.step(0x4932, 7); // ld a,(hl)
  regs.sub(regs.b);
  m.step(0x4933, 4); // sub b
  if (regs.fNC) {
    m.ret(11); // 0x4933 ret nc -- taken
    return;
  }
  m.step(0x4934, 5); // ret nc not taken

  regs.a = mem.read8(regs.hl);
  m.step(0x4935, 7); // ld a,(hl)
  regs.c = regs.a;
  m.step(0x4936, 4); // ld c,a
  regs.and(0xf0);
  m.step(0x4938, 7); // and 0xf0
  regs.add(0x10);
  m.step(0x493a, 7); // add a,0x10
  regs.hl = (regs.hl - 1) & 0xffff; // dec hl -- 16-bit, no flags
  m.step(0x493b, 6); // dec hl
  regs.neg();
  m.step(0x493d, 8); // neg
  regs.add(mem.read8(regs.hl));
  m.step(0x493e, 7); // add a,(hl)
  mem.write8(regs.hl, regs.a);
  m.step(0x493f, 7); // ld (hl),a

  m.step(0x496e, 12); // jr 0x496e -- TAIL transfer into loc_4941's shared tail
  return m.call(0x496e);
}
