// SPDX-License-Identifier: GPL-3.0-only

// loc_29f7  (ROM 0x29F7-0x2A2A)
export function loc_29f7(m) {
  const { regs, mem } = m;
  const IY = (d) => (regs.iy + d) & 0xffff;

  regs.a = 0x78;
  m.step(0x29f9, 7); // ld a,0x78
  regs.sub(mem.read8(IY(0x31)));
  m.step(0x29fc, 19); // sub (iy+0x31)
  regs.add(0x48);
  m.step(0x29fe, 7); // add a,0x48
  regs.cp(0x90);
  m.step(0x2a00, 7); // cp 0x90

  let toA1c = regs.fC;

  if (toA1c) {
    m.step(0x2a1c, 12); // jr c,0x2a1c taken
  } else {
    m.step(0x2a02, 7); // jr c not taken

    regs.a = 0x84;
    m.step(0x2a04, 7); // ld a,0x84
    regs.sub(mem.read8(IY(0x31)));
    m.step(0x2a07, 19); // sub (iy+0x31)
    regs.add(0x48);
    m.step(0x2a09, 7); // add a,0x48
    regs.cp(0x90);
    m.step(0x2a0b, 7); // cp 0x90

    toA1c = regs.fC;
    if (toA1c) {
      m.step(0x2a1c, 12); // jr c,0x2a1c taken
    } else {
      m.step(0x2a0d, 7); // jr c not taken
    }
  }

  if (toA1c) {
    regs.xor(regs.a);
    m.step(0x2a1d, 4); // xor a
    mem.write8(0xad04, regs.a);
    m.step(0x2a20, 13); // ld (0xad04),a

    m.push16(0x2a23);
    m.step(0x2bef, 17); // call 0x2bef
    m.call(0x2bef);

    regs.a = 0x04;
    m.step(0x2a25, 7); // ld a,0x04
    mem.write8(0xad04, regs.a);
    m.step(0x2a28, 13); // ld (0xad04),a
    m.step(0x2a10, 12); // jr 0x2a10
  } else {
    m.push16(0x2a10);
    m.step(0x2bef, 17); // call 0x2bef
    m.call(0x2bef);
  }

  regs.a = mem.read8(0xa980);
  m.step(0x2a13, 13); // ld a,(0xa980)
  regs.rrca();
  m.step(0x2a14, 4); // rrca
  regs.and(0x01);
  m.step(0x2a16, 7); // and 0x01 -- bit 1 of the counter, rotated down

  if (regs.fZ) {
    m.step(0x58aa, 10); // jp z,0x58aa taken -- TAIL transfer, nothing pushed
    return m.call(0x58aa);
  }
  m.step(0x2a19, 10); // jp z not taken

  m.step(0x5860, 10); // jp 0x5860 -- TAIL transfer
  return m.call(0x5860);
}
