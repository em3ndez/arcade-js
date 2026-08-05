// SPDX-License-Identifier: GPL-3.0-only

// loc_0774  (ROM 0x0774-0x07AC, Time Pilot)
export function loc_0774(m) {
  const { regs, mem } = m;

  regs.b = 0x00;
  m.step(0x0776, 7); // ld b,0x00 -- 256 iterations
  regs.hl = 0x4c99;
  m.step(0x0779, 10); // ld hl,0x4c99
  regs.sub(regs.a);
  m.step(0x077a, 4); // sub a -- running XOR = 0

  for (;;) {
    regs.xor(mem.read8(regs.hl));
    m.step(0x077b, 7); // xor (hl)
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x077c, 6); // inc hl
    if (regs.djnz() !== 0) {
      m.step(0x077a, 13); // djnz 0x077a taken
      continue;
    }
    m.step(0x077e, 8); // djnz NOT taken
    break;
  }

  regs.add(0x95);
  m.step(0x0780, 7); // add a,0x95 -- Z iff the XOR came out 0x6B

  if (regs.fNZ) {
    m.push16(0x0783);
    m.step(0x0f11, 17); // call nz,0x0f11 taken -- checksum FAILED, skip a state
    m.call(0x0f11);
  } else {
    m.step(0x0783, 10); // call nz,0x0f11 NOT taken
  }

  regs.a = mem.read8(0xad30);
  m.step(0x0786, 13); // ld a,(0xad30)
  regs.and(regs.a);
  m.step(0x0787, 4); // and a

  let atL07a0 = true;
  variant: {
    if (regs.fZ) {
      m.step(0x07a0, 12); // jr z,0x07a0 taken
      break variant;
    }
    m.step(0x0789, 7); // jr z (not taken)

    regs.de = mem.read8(0x125b) | (mem.read8(0x125c) << 8);
    m.step(0x078d, 20); // ld de,(0x125b)
    regs.a = mem.read8(0xad32);
    m.step(0x0790, 13); // ld a,(0xad32)
    regs.and(regs.a);
    m.step(0x0791, 4); // and a

    if (regs.fZ) {
      m.step(0x0794, 12); // jr z,0x0794 taken
    } else {
      m.step(0x0793, 7); // jr z (not taken)
      regs.e = regs.inc8(regs.e);
      m.step(0x0794, 4); // inc e -- the next command in the pair
    }

    m.push16(0x0795);
    m.step(0x0038, 11); // rst 0x38 -- queue (D,E)
    m.call(0x0038);

    regs.a = mem.read8(0xad0e);
    m.step(0x0798, 13); // ld a,(0xad0e)
    regs.and(regs.a);
    m.step(0x0799, 4); // and a

    if (regs.fZ) {
      m.step(0x07a0, 12); // jr z,0x07a0 taken
      break variant;
    }
    m.step(0x079b, 7); // jr z (not taken)

    regs.d = 0x07;
    m.step(0x079d, 7); // ld d,0x07
    m.push16(0x079e);
    m.step(0x0038, 11); // rst 0x38 -- queue it again under command 7
    m.call(0x0038);

    m.step(0x07a4, 12); // jr 0x07a4 -- skip the 0x0202 default
    atL07a0 = false;
  }

  if (atL07a0) {
    regs.de = 0x0202;
    m.step(0x07a3, 10); // ld de,0x0202
    m.push16(0x07a4);
    m.step(0x0038, 11); // rst 0x38
    m.call(0x0038);
  }

  m.push16(0x07a7);
  m.step(0x0809, 17); // call 0x0809
  m.call(0x0809);

  m.push16(0x07aa);
  m.step(0x19f0, 17); // call 0x19f0
  m.call(0x19f0);

  m.step(0x0f1a, 10); // jp 0x0f1a
  return m.call(0x0f1a);
}
