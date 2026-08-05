// SPDX-License-Identifier: GPL-3.0-only

// loc_4941  (ROM 0x4941-0x4983, Time Pilot)
export function loc_4941(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xa9ae);
  m.step(0x4944, 13); // ld a,(0xa9ae)

  regs.hl = 0xa9c7;
  m.step(0x4947, 10); // ld hl,0xa9c7

  regs.rrca();
  m.step(0x4948, 4); // rrca -- carry = bit 0 of the pattern byte

  mem.write8(regs.hl, regs.rl(mem.read8(regs.hl)));
  m.step(0x494a, 15); // rl (hl) -- carry in at bit 0

  regs.a = mem.read8(regs.hl);
  m.step(0x494b, 7); // ld a,(hl)

  regs.and(0x07);
  m.step(0x494d, 7); // and 0x07

  regs.cp(0x01);
  m.step(0x494f, 7); // cp 0x01

  if (regs.fNZ) {
    m.ret(11); // ret nz taken -- not the rising edge
    return;
  }
  m.step(0x4950, 5); // ret nz not taken

  regs.exDeHl();
  m.step(0x4951, 4); // ex de,hl -- DE = 0xa9c7

  m.push16(0x4954);
  m.step(0x57f1, 17); // call 0x57f1
  m.call(0x57f1);

  regs.hl = 0xa981;
  m.step(0x4957, 10); // ld hl,0xa981

  regs.incMem8(mem, regs.hl);
  m.step(0x4958, 11); // inc (hl) -- bump 0xa981

  regs.exDeHl();
  m.step(0x4959, 4); // ex de,hl -- HL = 0xa9c7, DE = 0xa981

  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x495a, 6); // inc hl -- HL = 0xa9c8

  regs.a = mem.read8(regs.hl);
  m.step(0x495b, 7); // ld a,(hl)

  regs.add(0x10);
  m.step(0x495d, 7); // add a,0x10

  mem.write8(regs.hl, regs.a);
  m.step(0x495e, 7); // ld (hl),a

  regs.b = regs.a;
  m.step(0x495f, 4); // ld b,a

  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x4960, 6); // inc hl -- HL = 0xa9c9

  regs.a = mem.read8(regs.hl);
  m.step(0x4961, 7); // ld a,(hl) -- the limit

  regs.sub(regs.b);
  m.step(0x4962, 4); // sub b

  if (regs.fNC) {
    m.ret(11); // ret nc taken -- still under the limit
    return;
  }
  m.step(0x4963, 5); // ret nc not taken -- overshot

  regs.a = mem.read8(regs.hl);
  m.step(0x4964, 7); // ld a,(hl)

  regs.c = regs.a;
  m.step(0x4965, 4); // ld c,a -- keep the whole limit byte

  regs.and(0xf0);
  m.step(0x4967, 7); // and 0xf0

  regs.add(0x10);
  m.step(0x4969, 7); // add a,0x10

  regs.hl = (regs.hl - 1) & 0xffff;
  m.step(0x496a, 6); // dec hl -- HL = 0xa9c8

  regs.neg();
  m.step(0x496c, 8); // neg

  regs.add(mem.read8(regs.hl));
  m.step(0x496d, 7); // add a,(hl)

  mem.write8(regs.hl, regs.a);
  m.step(0x496e, 7); // ld (hl),a

  regs.a = mem.read8(0xa9c0);
  m.step(0x4971, 13); // ld a,(0xa9c0)

  regs.and(regs.a);
  m.step(0x4972, 4); // and a -- zero test

  if (regs.fNZ) {
    m.step(0x4984, 12);
    return m.call(0x4984);
  }
  m.step(0x4974, 7); // jr nz not taken

  regs.a = regs.c;
  m.step(0x4975, 4); // ld a,c

  regs.and(0x0f);
  m.step(0x4977, 7); // and 0x0f -- the limit's low nibble

  regs.hl = 0xa986;
  m.step(0x497a, 10); // ld hl,0xa986

  regs.add(mem.read8(regs.hl));
  m.step(0x497b, 7); // add a,(hl)

  regs.daa();
  m.step(0x497c, 4); // daa -- BCD correction; carry = BCD overflow

  mem.write8(regs.hl, regs.a);
  m.step(0x497d, 7); // ld (hl),a -- flag-neutral

  if (regs.fNC) {
    m.step(0x4981, 12); // jr nc,0x4981 taken -- no BCD overflow
  } else {
    m.step(0x497f, 7); // jr nc not taken
    mem.write8(regs.hl, 0x99);
    m.step(0x4981, 10); // ld (hl),0x99 -- saturate
  }

  m.push16(0x4984);
  m.step(0x4afb, 17); // call 0x4afb
  m.call(0x4afb);

  return m.call(0x4984);
}
