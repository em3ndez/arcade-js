// SPDX-License-Identifier: GPL-3.0-only

// loc_4d72  (ROM 0x4D72-0x4DAE, Time Pilot) -- slot 5 of the word table at 0x0BBC
export function loc_4d72(m) {
  const { regs, mem } = m;

  regs.c = regs.a;
  m.step(0x4d73, 4); // ld c,a

  regs.a = mem.read8(0xad30);
  m.step(0x4d76, 13); // ld a,(0xad30)
  regs.and(regs.a);
  m.step(0x4d77, 4); // and a
  if (regs.fZ) {
    m.ret(11); // ret z taken
    return;
  }
  m.step(0x4d78, 5); // ret z NOT taken

  regs.de = 0xa783;
  m.step(0x4d7b, 10); // ld de,0xa783
  regs.a = regs.c;
  m.step(0x4d7c, 4); // ld a,c
  regs.cp(0x07);
  m.step(0x4d7e, 7); // cp 0x07
  if (regs.fC) {
    m.step(0x4d82, 12); // jr c,0x4d82 taken -- A below 0x07
  } else {
    m.step(0x4d80, 7); // jr c NOT taken
    regs.a = 0x06;
    m.step(0x4d82, 7); // ld a,0x06 -- A was 0x07 or above
  }

  regs.and(regs.a);
  m.step(0x4d83, 4); // and a
  if (regs.fZ) {
    m.step(0x4d91, 12); // jr z,0x4d91 taken -- A == 0
  } else {
    m.step(0x4d85, 7); // jr z NOT taken
    regs.b = 0x09;
    m.step(0x4d87, 7); // ld b,0x09
    regs.c = 0x18;
    m.step(0x4d89, 7); // ld c,0x18

    for (;;) {
      regs.exAf();
      m.step(0x4d8a, 4); // ex af,af' -- A parked in A' across the call
      m.push16(0x4d8d);
      m.step(0x4daf, 17); // call 0x4daf
      m.call(0x4daf);
      regs.exAf();
      m.step(0x4d8e, 4); // ex af,af' -- A back
      regs.a = regs.dec8(regs.a);
      m.step(0x4d8f, 4); // dec a
      const again = regs.fNZ;
      m.step(again ? 0x4d89 : 0x4d91, again ? 12 : 7); // jr nz,0x4d89
      if (!again) break;
    }
  }

  regs.bc = 0xf110;
  m.step(0x4d94, 10); // ld bc,0xf110

  for (;;) {
    regs.hl = 0x59dd;
    m.step(0x4d97, 10); // ld hl,0x59dd
    regs.addHl(regs.de);
    m.step(0x4d98, 11); // add hl,de -- carry iff DE >= 0xA623
    const done = regs.fNC;
    if (done) {
      m.step(0x4d9f, 12); // jr nc,0x4d9f taken
      break;
    }
    m.step(0x4d9a, 7); // jr nc NOT taken
    m.push16(0x4d9d);
    m.step(0x4dcf, 17); // call 0x4dcf
    m.call(0x4dcf);
    m.step(0x4d94, 12); // jr 0x4d94
  }

  regs.b = 0x00;
  m.step(0x4da1, 7); // ld b,0x00 -- djnz wraps 0x00 -> 0xFF: 256 iterations
  regs.hl = 0x0711;
  m.step(0x4da4, 10); // ld hl,0x0711
  regs.sub(regs.a);
  m.step(0x4da5, 4); // sub a -- A = 0

  for (;;) {
    regs.xor(mem.read8(regs.hl));
    m.step(0x4da6, 7); // xor (hl)
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x4da7, 6); // inc hl
    const again = regs.djnz() !== 0;
    m.step(again ? 0x4da5 : 0x4da9, again ? 13 : 8); // djnz 0x4da5
    if (!again) break;
  }

  regs.add(0x19);
  m.step(0x4dab, 7); // add a,0x19 -- must wrap to 0x00
  if (regs.fNZ) {
    m.step(0x4bb1, 10); // jp nz,0x4bb1 taken
    throw new Error(
      "Time Pilot: `jp nz,0x4bb1` at 0x4DAB taken -- the XOR over 0x0711-0x0810 plus " +
        "0x19 did not come to zero. 0x4BB1 is the 0x28-byte block loc_4ba5 copies to " +
        "0xAB08, not code. ROM 0x0711-0x0810 does not match the dump this was derived from.",
    );
  }
  m.step(0x4dae, 10); // jp nz NOT taken

  m.ret(); // 4dae  ret
}
