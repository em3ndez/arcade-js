// SPDX-License-Identifier: GPL-3.0-only

// loc_1f01  (ROM 0x1F01-0x1F75, Time Pilot)
export function loc_1f01(m) {
  const { regs, mem } = m;

  regs.hl = 0x1f2e;
  m.step(0x1f04, 10); // ld hl,0x1f2e -- the direction table

  m.push16(0x1f05);
  m.step(0x0008, 11); // rst 0x08 -- A = (0x1f2e + A)
  m.call(0x0008);

  regs.b = regs.a;
  m.step(0x1f06, 4); // ld b,a -- B = the target direction
  regs.a = mem.read8(0xa802);
  m.step(0x1f09, 13); // ld a,(0xa802) -- the current direction
  regs.sub(regs.b);
  m.step(0x1f0a, 4); // sub b -- Z iff already on target

  if (regs.fZ) {
    m.step(0x1f42, 10); // jp z,0x1f42 taken
  } else {
    m.step(0x1f0d, 10); // jp z NOT taken

    regs.c = regs.a;
    m.step(0x1f0e, 4); // ld c,a -- C = current - target
    regs.a = mem.read8(0xad04);
    m.step(0x1f11, 13); // ld a,(0xad04)
    regs.and(0x0f);
    m.step(0x1f13, 7); // and 0x0f
    regs.cp(0x03);
    m.step(0x1f15, 7); // cp 0x03

    if (regs.fNC) {
      m.step(0x1f1b, 12); // jr nc,0x1f1b taken
      regs.d = 0x04;
      m.step(0x1f1d, 7); // ld d,0x04 -- the faster turn rate
    } else {
      m.step(0x1f17, 7); // jr nc NOT taken
      regs.d = 0x03;
      m.step(0x1f19, 7); // ld d,0x03 -- the slower turn rate
      m.step(0x1f1d, 12); // jr 0x1f1d
    }

    regs.a = regs.c;
    m.step(0x1f1e, 4); // ld a,c
    regs.add(0x01);
    m.step(0x1f20, 7); // add a,0x01
    regs.cp(0x03);
    m.step(0x1f22, 7); // cp 0x03 -- difference+1 < 3, i.e. within one step either side

    if (regs.fC) {
      m.step(0x1f3e, 10); // jp c,0x1f3e taken

      regs.a = regs.b;
      m.step(0x1f3f, 4); // ld a,b
      mem.write8(0xa802, regs.a);
      m.step(0x1f42, 13); // ld (0xa802),a
    } else {
      m.step(0x1f25, 10); // jp c NOT taken

      regs.a = regs.c;
      m.step(0x1f26, 4); // ld a,c
      regs.cp(0x80);
      m.step(0x1f28, 7); // cp 0x80 -- which way round the compass is shorter

      if (regs.fNC) {
        m.step(0x1f6f, 10); // jp nc,0x1f6f taken

        regs.add(regs.d);
        m.step(0x1f70, 4); // add a,d
        regs.add(regs.b);
        m.step(0x1f71, 4); // add a,b
        mem.write8(0xa802, regs.a);
        m.step(0x1f74, 13); // ld (0xa802),a
        m.step(0x1f42, 12); // jr 0x1f42
      } else {
        m.step(0x1f2b, 10); // jp nc NOT taken
        m.step(0x1f68, 10); // jp 0x1f68

        regs.sub(regs.d);
        m.step(0x1f69, 4); // sub d
        regs.add(regs.b);
        m.step(0x1f6a, 4); // add a,b
        mem.write8(0xa802, regs.a);
        m.step(0x1f6d, 13); // ld (0xa802),a
        m.step(0x1f42, 12); // jr 0x1f42
      }
    }
  }

  regs.hl = 0x1f55;
  m.step(0x1f45, 10); // ld hl,0x1f55
  m.push16(regs.hl);
  m.step(0x1f46, 11); // push hl -- the return address the trampoline's ret will pop
  regs.a = mem.read8(0xad04);
  m.step(0x1f49, 13); // ld a,(0xad04)
  regs.and(regs.a);
  m.step(0x1f4a, 4); // and a

  if (regs.fZ) {
    m.step(0x594e, 10); // jp z,0x594e taken -- CALL, 0x1F55 is on the stack
    m.call(0x594e);
  } else {
    m.step(0x1f4d, 10); // jp z NOT taken
    regs.cp(0x03);
    m.step(0x1f4f, 7); // cp 0x03
    if (regs.fC) {
      m.step(0x5965, 10); // jp c,0x5965 taken -- CALL
      m.call(0x5965);
    } else {
      m.step(0x1f52, 10); // jp c NOT taken
      m.step(0x596b, 10); // jp 0x596b -- CALL
      m.call(0x596b);
    }
  }

  return m.call(0x1f55);
}
