// SPDX-License-Identifier: GPL-3.0-only

// loc_6df9  (ROM 0x6df9-0x6e56) -- ANTI-TAMPER CLONE of loc_0ac8: a byte-for-byte duplicate of the
// attract sub-state-5 handler, reached by `jp nz,0x6df9` at 0x6f8f (the state-3 handler's guard,
// which mismatches when 0x7071 has been patched). The clone is a verbatim byte-for-byte copy of
// loc_0ac8 (absolute operands unchanged, so no local address is relocated; only the entry address
// differs). The absolute call/jump targets (0x0a28/0x09f8/0x7442/0x76ea) are unchanged. The 0x8e54
// script pointer is pulled, stored via 0x8e56, and every 0x8e52 ticks a 14-row 0x20-strided checksum
// is verified against the (0x8f48) pointer; a mismatch takes the 0x7442/0x76ea tamper jumps.

export function loc_6df9(m) {
  const { regs, mem } = m;

  regs.hl = 0x8d41;
  m.step(0x6dfc, 10); // 6df9  ld hl,0x8d41
  regs.decMem8(mem, regs.hl);
  m.step(0x6dfd, 11); // 6dfc  dec (hl)
  if (regs.fNZ) {
    m.step(0x6e02, 12); // 6dfd  jr nz,0x6e02
  } else {
    m.step(0x6dff, 7);
    m.push16(0x6e02);
    m.step(0x0a28, 17); // 6dff  call 0x0a28
    m.call(0x0a28);
  }
  m.push16(0x6e05);
  m.step(0x09f8, 17); // 6e02  call 0x09f8
  m.call(0x09f8);

  regs.hl = 0x8e50;
  m.step(0x6e08, 10); // 6e05  ld hl,0x8e50
  regs.decMem8(mem, regs.hl);
  m.step(0x6e09, 11); // 6e08  dec (hl)
  if (regs.fNZ) { m.ret(11); return; } // 6e09  ret nz
  m.step(0x6e0a, 5);

  mem.write8(regs.hl, 0x02);
  m.step(0x6e0c, 10); // 6e0a  ld (hl),0x02
  regs.hl = mem.read16(0x8e54);
  m.step(0x6e0f, 16); // 6e0c  ld hl,(0x8e54)
  regs.a = mem.read8(regs.hl);
  m.step(0x6e10, 7); // 6e0f  ld a,(hl)
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x6e11, 6); // 6e10  inc hl
  mem.write16(0x8e54, regs.hl);
  m.step(0x6e14, 16); // 6e11  ld (0x8e54),hl
  regs.hl = mem.read16(0x8e56);
  m.step(0x6e17, 16); // 6e14  ld hl,(0x8e56)
  mem.write8(regs.hl, regs.a);
  m.step(0x6e18, 7); // 6e17  ld (hl),a
  regs.de = 0xffe0;
  m.step(0x6e1b, 10); // 6e18  ld de,0xffe0
  regs.addHl(regs.de);
  m.step(0x6e1c, 11); // 6e1b  add hl,de
  mem.write16(0x8e56, regs.hl);
  m.step(0x6e1f, 16); // 6e1c  ld (0x8e56),hl
  regs.hl = 0x8e52;
  m.step(0x6e22, 10); // 6e1f  ld hl,0x8e52
  regs.decMem8(mem, regs.hl);
  m.step(0x6e23, 11); // 6e22  dec (hl)
  if (regs.fNZ) { m.ret(11); return; } // 6e23  ret nz
  m.step(0x6e24, 5);

  mem.write8(regs.hl, 0x0d);
  m.step(0x6e26, 10); // 6e24  ld (hl),0x0d
  regs.hl = 0x8e50;
  m.step(0x6e29, 10); // 6e26  ld hl,0x8e50
  mem.write8(regs.hl, 0x14);
  m.step(0x6e2b, 10); // 6e29  ld (hl),0x14
  regs.l = regs.inc8(regs.l);
  m.step(0x6e2c, 4); // 6e2b  inc l
  regs.incMem8(mem, regs.hl);
  m.step(0x6e2d, 11); // 6e2c  inc (hl)
  regs.hl = mem.read16(0x8e56);
  m.step(0x6e30, 16); // 6e2d  ld hl,(0x8e56)
  regs.de = 0x0000;
  m.step(0x6e33, 10); // 6e30  ld de,0x0000
  regs.b = 0x0e;
  m.step(0x6e35, 7); // 6e33  ld b,0x0e

  for (;;) {
    regs.a = mem.read8(regs.hl);
    m.step(0x6e36, 7); // 6e35  ld a,(hl)
    regs.add(regs.e);
    m.step(0x6e37, 4); // 6e36  add a,e
    regs.e = regs.a;
    m.step(0x6e38, 4); // 6e37  ld e,a
    if (regs.fNC) {
      m.step(0x6e3b, 12); // 6e38  jr nc,0x6e3b
    } else {
      m.step(0x6e3a, 7);
      regs.d = regs.inc8(regs.d);
      m.step(0x6e3b, 4); // 6e3a  inc d
    }
    regs.a = 0x20;
    m.step(0x6e3d, 7); // 6e3b  ld a,0x20
    regs.add(regs.l);
    m.step(0x6e3e, 4); // 6e3d  add a,l
    regs.l = regs.a;
    m.step(0x6e3f, 4); // 6e3e  ld l,a
    if (regs.fNC) {
      m.step(0x6e42, 12); // 6e3f  jr nc,0x6e42
    } else {
      m.step(0x6e41, 7);
      regs.h = regs.inc8(regs.h);
      m.step(0x6e42, 4); // 6e41  inc h
    }
    if (regs.djnz() !== 0) { m.step(0x6e35, 13); continue; } // 6e42  djnz 0x6e35
    m.step(0x6e44, 8);
    break;
  }

  regs.hl = mem.read16(0x8f48);
  m.step(0x6e47, 16); // 6e44  ld hl,(0x8f48)
  regs.a = mem.read8(regs.hl);
  m.step(0x6e48, 7); // 6e47  ld a,(hl)
  regs.cp(regs.e);
  m.step(0x6e49, 4); // 6e48  cp e
  if (regs.fNZ) {
    m.step(0x7442, 10); // 6e49  jp nz,0x7442 -- checksum-fail tamper trap
    return m.call(0x7442);
  }
  m.step(0x6e4c, 10);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x6e4d, 6); // 6e4c  inc hl
  regs.a = mem.read8(regs.hl);
  m.step(0x6e4e, 7); // 6e4d  ld a,(hl)
  regs.cp(regs.d);
  m.step(0x6e4f, 4); // 6e4e  cp d
  if (regs.fNZ) {
    m.step(0x76ea, 10); // 6e4f  jp nz,0x76ea -- checksum-fail tamper trap
    return m.call(0x76ea);
  }
  m.step(0x6e52, 10);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x6e53, 6); // 6e52  inc hl
  mem.write16(0x8f48, regs.hl);
  m.step(0x6e56, 16); // 6e53  ld (0x8f48),hl
  m.ret(); // 6e56  ret
}
