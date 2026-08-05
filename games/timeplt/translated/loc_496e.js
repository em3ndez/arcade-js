// SPDX-License-Identifier: GPL-3.0-only

// loc_496e  (ROM 0x496E-0x49A7, Time Pilot)
export function loc_496e(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xa9c0);
  m.step(0x4971, 13); // ld a,(0xa9c0)
  regs.and(regs.a);
  m.step(0x4972, 4); // and a

  if (regs.fNZ) {
    m.step(0x4984, 12); // jr nz,0x4984 taken -- skip the accumulate
  } else {
    m.step(0x4974, 7); // jr nz NOT taken
    regs.a = regs.c;
    m.step(0x4975, 4); // ld a,c
    regs.and(0x0f);
    m.step(0x4977, 7); // and 0x0f
    regs.hl = 0xa986;
    m.step(0x497a, 10); // ld hl,0xa986
    regs.add(mem.read8(regs.hl));
    m.step(0x497b, 7); // add a,(hl)
    regs.daa();
    m.step(0x497c, 4); // daa -- BCD, so carry means it went past 0x99
    mem.write8(regs.hl, regs.a);
    m.step(0x497d, 7); // ld (hl),a

    if (regs.fNC) {
      m.step(0x4981, 12); // jr nc,0x4981 taken
    } else {
      m.step(0x497f, 7); // jr nc NOT taken
      mem.write8(regs.hl, 0x99);
      m.step(0x4981, 10); // ld (hl),0x99 -- clamp
    }

    m.push16(0x4984);
    m.step(0x4afb, 17); // call 0x4afb
    m.call(0x4afb);
  }

  regs.a = mem.read8(0xa981);
  m.step(0x4987, 13); // ld a,(0xa981) -- repetitions left
  regs.and(regs.a);
  m.step(0x4988, 4); // and a
  if (regs.fZ) {
    m.ret(11); // ret z taken -- nothing running
    return;
  }
  m.step(0x4989, 5); // ret z NOT taken

  regs.hl = 0xa984;
  m.step(0x498c, 10); // ld hl,0xa984 -- the phase counter
  regs.a = mem.read8(regs.hl);
  m.step(0x498d, 7); // ld a,(hl)
  regs.and(regs.a);
  m.step(0x498e, 4); // and a

  if (regs.fNZ) {
    m.step(0x4997, 12); // jr nz,0x4997 taken -- mid-repetition
  } else {
    m.step(0x4990, 7); // jr nz NOT taken -- start a repetition
    mem.write8(regs.hl, 0x30);
    m.step(0x4992, 10); // ld (hl),0x30
    regs.a = regs.inc8(regs.a); // A was 0, so this makes 1
    m.step(0x4993, 4); // inc a
    mem.write8(0xc30a, regs.a, 10);
    m.step(0x4996, 13); // ld (0xc30a),a -- raise the latch line
    m.ret(10); // ret
    return;
  }

  regs.decMem8(mem, regs.hl);
  m.step(0x4998, 11); // dec (hl)
  if (regs.fZ) {
    m.step(0x49a3, 12); // jr z,0x49a3 taken -- repetition finished

    regs.hl = 0xa981;
    m.step(0x49a6, 10); // ld hl,0xa981
    regs.decMem8(mem, regs.hl);
    m.step(0x49a7, 11); // dec (hl)
    m.ret(10); // ret
    return;
  }
  m.step(0x499a, 7); // jr z NOT taken

  regs.a = mem.read8(regs.hl);
  m.step(0x499b, 7); // ld a,(hl)
  regs.cp(0x18);
  m.step(0x499d, 7); // cp 0x18 -- the halfway point of the 0x30 phase
  if (regs.fNZ) {
    m.ret(11); // ret nz taken
    return;
  }
  m.step(0x499e, 5); // ret nz NOT taken

  regs.xor(regs.a);
  m.step(0x499f, 4); // xor a
  mem.write8(0xc30a, regs.a, 10);
  m.step(0x49a2, 13); // ld (0xc30a),a -- lower the latch line
  m.ret(10); // ret
}
