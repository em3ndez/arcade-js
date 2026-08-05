// SPDX-License-Identifier: GPL-3.0-only

// loc_5bd7  (ROM 0x5BD7-0x5BFF)
export function loc_5bd7(m) {
  const { regs, mem } = m;

  m.push16(0x5bda);
  m.step(0x07d2, 17); // call 0x07d2
  m.call(0x07d2);

  m.push16(0x5bdd);
  m.step(0x0201, 17); // call 0x0201
  m.call(0x0201);

  if (regs.fNZ) {
    m.ret(11); // ret nz (taken) -- 0x0201 reports the new X integer is nonzero
    return;
  }
  m.step(0x5bde, 5); // ret nz (not taken)

  regs.hl = 0x0bdd;
  m.step(0x5be1, 10); // ld hl,0x0bdd
  regs.sub(regs.a);
  m.step(0x5be2, 4); // sub a -- A = 0, Z set
  regs.b = regs.a;
  m.step(0x5be3, 4); // ld b,a -- B = 0, so djnz runs 256 times

  do {
    regs.xor(mem.read8(regs.hl));
    m.step(0x5be4, 7); // xor (hl)
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x5be5, 6); // inc hl
    regs.djnz(); // djnz -- no flags, so the xor's F survives the loop
    m.step(regs.b !== 0 ? 0x5be3 : 0x5be7, regs.b !== 0 ? 13 : 8); // djnz 0x5be3
  } while (regs.b !== 0);

  regs.add(0xe4);
  m.step(0x5be9, 7); // add a,0xe4 -- zero iff the block checksums to 0x1C

  if (regs.fNZ) {
    m.push16(0x5bec);
    m.step(0x0f11, 17); // call nz,0x0f11 (taken) -- the block did not checksum to 0x1C
    m.call(0x0f11);
  } else {
    m.step(0x5bec, 10); // call nz,0x0f11 (not taken)
  }

  regs.a = mem.read8(0xa9ab);
  m.step(0x5bef, 13); // ld a,(0xa9ab)
  regs.hl = 0x1734;
  m.step(0x5bf2, 10); // ld hl,0x1734
  regs.b = 0x14;
  m.step(0x5bf4, 7); // ld b,0x14

  do {
    regs.add(mem.read8(regs.hl));
    m.step(0x5bf5, 7); // add a,(hl)
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x5bf6, 6); // inc hl
    regs.djnz(); // djnz -- no flags
    m.step(regs.b !== 0 ? 0x5bf4 : 0x5bf8, regs.b !== 0 ? 13 : 8); // djnz 0x5bf4
  } while (regs.b !== 0);

  regs.add(0x77);
  m.step(0x5bfa, 7); // add a,0x77 -- 0x89 + 0x77 = 0, so A is back to (0xa9ab)
  mem.write8(0xa9ab, regs.a);
  m.step(0x5bfd, 13); // ld (0xa9ab),a

  m.step(0x0f1a, 10); // jp 0x0f1a -- TAIL, nothing pushed
  return m.call(0x0f1a);
}
