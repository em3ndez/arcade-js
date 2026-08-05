// SPDX-License-Identifier: GPL-3.0-only

// loc_0f54  (ROM 0x0F54-0x0F7A, Time Pilot)
export function loc_0f54(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xad30);
  m.step(0x0f57, 13); // ld a,(0xad30)
  regs.and(regs.a);
  m.step(0x0f58, 4); // and a -- zero test

  if (regs.fNZ) {
    m.ret(11); // ret nz
    return;
  }
  m.step(0x0f59, 5); // ret nz not taken

  regs.a = mem.read8(0xa986);
  m.step(0x0f5c, 13); // ld a,(0xa986)
  regs.and(regs.a);
  m.step(0x0f5d, 4); // and a

  if (regs.fNZ) {
    m.step(0x0f70, 12); // jr nz,0x0f70 (taken)

    regs.xor(regs.a);
    m.step(0x0f71, 4); // xor a
    mem.write8(0xa9ac, regs.a);
    m.step(0x0f74, 13); // ld (0xa9ac),a -- clear the dispatch index
    regs.a = mem.read8(0x1736); // ROM constant, 0x02
    m.step(0x0f77, 13); // ld a,(0x1736)
    mem.write8(0xa9ab, regs.a);
    m.step(0x0f7a, 13); // ld (0xa9ab),a

    m.ret(10); // 0f7a  ret
    return;
  }
  m.step(0x0f5f, 7); // jr nz not taken

  regs.a = mem.read8(0xa9c0);
  m.step(0x0f62, 13); // ld a,(0xa9c0)
  regs.and(regs.a);
  m.step(0x0f63, 4); // and a

  if (regs.fZ) {
    m.ret(11); // ret z
    return;
  }
  m.step(0x0f64, 5); // ret z not taken

  regs.a = mem.read8(0xa9ae);
  m.step(0x0f67, 13); // ld a,(0xa9ae)
  regs.and(0x18);
  m.step(0x0f69, 7); // and 0x18 -- bits 3-4

  if (regs.fZ) {
    m.ret(11); // ret z
    return;
  }
  m.step(0x0f6a, 5); // ret z not taken

  m.push16(0x0f6d);
  m.step(0x15b6, 17); // call 0x15b6
  m.call(0x15b6);

  m.step(0x1690, 10); // jp 0x1690 -- TAIL
  return m.call(0x1690);
}
