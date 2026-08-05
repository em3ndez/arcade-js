// SPDX-License-Identifier: GPL-3.0-only

// loc_4d3a  (ROM 0x4D3A-0x4D66, Time Pilot)
export function loc_4d3a(m) {
  const { regs, mem } = m;

  regs.hl = 0xad05;
  m.step(0x4d3d, 10); // ld hl,0xad05

  m.push16(0x4d40);
  m.step(0x4d67, 17); // call 0x4d67
  m.call(0x4d67);

  if (regs.fC) {
    m.ret(11); // ret c taken
    return;
  }
  m.step(0x4d41, 5); // ret c NOT taken

  regs.l = regs.inc8(regs.l);
  m.step(0x4d42, 4); // inc l -- 0xAD06

  m.push16(0x4d45);
  m.step(0x4d67, 17); // call 0x4d67
  m.call(0x4d67);

  if (regs.fC) {
    m.step(0x4d4b, 12); // jr c,0x4d4b taken -- skip the third
  } else {
    m.step(0x4d47, 7); // jr c NOT taken
    regs.l = regs.inc8(regs.l);
    m.step(0x4d48, 4); // inc l -- 0xAD07

    m.push16(0x4d4b);
    m.step(0x4d67, 17); // call 0x4d67
    m.call(0x4d67);
  }

  regs.hl = 0xa9d7;
  m.step(0x4d4e, 10); // ld hl,0xa9d7 -- the reload timer
  regs.a = mem.read8(regs.hl);
  m.step(0x4d4f, 7); // ld a,(hl)
  regs.and(regs.a);
  m.step(0x4d50, 4); // and a
  if (regs.fZ) {
    m.ret(11); // ret z taken -- timer disabled
    return;
  }
  m.step(0x4d51, 5); // ret z NOT taken

  regs.decMem8(mem, regs.hl);
  m.step(0x4d52, 11); // dec (hl)
  if (regs.fNZ) {
    m.ret(11); // ret nz taken -- still counting
    return;
  }
  m.step(0x4d53, 5); // ret nz NOT taken

  regs.a = mem.read8(0xa9d6);
  m.step(0x4d56, 13); // ld a,(0xa9d6) -- the reload value
  mem.write8(regs.hl, regs.a);
  m.step(0x4d57, 7); // ld (hl),a
  regs.a = mem.read8(0xacc0);
  m.step(0x4d5a, 13); // ld a,(0xacc0)
  regs.a = regs.inc8(regs.a);
  m.step(0x4d5b, 4); // inc a
  regs.cp(0x10);
  m.step(0x4d5d, 7); // cp 0x10
  if (regs.fC) {
    m.step(0x4d61, 12); // jr c,0x4d61 taken -- below the ceiling
  } else {
    m.step(0x4d5f, 7); // jr c NOT taken
    regs.a = 0x0f;
    m.step(0x4d61, 7); // ld a,0x0f -- clamp
  }

  mem.write8(0xacc0, regs.a);
  m.step(0x4d64, 13); // ld (0xacc0),a

  m.step(0x1a9a, 10); // jp 0x1a9a -- tail-jump; its ret returns to OUR caller
  return m.call(0x1a9a);
}
