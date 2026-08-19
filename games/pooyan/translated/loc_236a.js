// SPDX-License-Identifier: GPL-3.0-only
//
// loc_236a  (ROM 0x236a-0x23a0) -- companion state handler to loc_2334, reached from a dispatcher at
// 0x232d. Gated on (ix+0x07) bit 3; advances (ix+0x04) with a high clamp of 0xc0, refreshes the
// sprite Y trio (loc_23d7), then, when the script byte (0x88be)==0xf6, validates a 3-byte block at
// 0x8a38 and a colour-RAM parity (0x8083/0x8343) before running the shared phase tail via loc_2405,
// falling into loc_23a1. loc_23d7 plain-ret, loc_2405 rets to 0x23a1 (pattern A).
export function loc_236a(m) {
  const { regs, mem } = m;

  regs.bit(3, mem.read8((regs.ix + 0x07) & 0xffff)); m.step(0x236e, 20); // 236a  bit 3,(ix+7)
  if (regs.fZ) { m.ret(11); return; }
  m.step(0x236f, 5);
  regs.incMem8(mem, (regs.ix + 0x04) & 0xffff); m.step(0x2372, 23); // 236f  inc (ix+4)
  regs.a = mem.read8((regs.ix + 0x04) & 0xffff); m.step(0x2375, 19); // 2372  ld a,(ix+4)
  regs.cp(0xc0); m.step(0x2377, 7);
  if (regs.fC) {
    m.step(0x237d, 12);
  } else {
    m.step(0x2379, 7);
    mem.write8((regs.ix + 0x04) & 0xffff, 0xc0); m.step(0x237d, 19); // 2379  ld (ix+4),0xc0 (clamp)
  }
  m.push16(0x2380); m.step(0x23d7, 17); m.call(0x23d7); // 237d  call 0x23d7 (pattern A)
  regs.a = mem.read8(0x88be); m.step(0x2383, 13); // 2380  ld a,(0x88be)
  regs.cp(0xf6); m.step(0x2385, 7);

  let go239e = false;
  if (regs.fNZ) {
    m.step(0x239e, 12); go239e = true;
  } else {
    m.step(0x2387, 7);
    regs.hl = 0x8a38; m.step(0x238a, 10);
    regs.b = 0x03; m.step(0x238c, 7);
    for (;;) {
      regs.a = mem.read8(regs.hl); m.step(0x238d, 7); // 238c  ld a,(hl)
      regs.and(regs.a); m.step(0x238e, 4);
      if (regs.fNZ) { m.step(0x239e, 12); go239e = true; break; }
      m.step(0x2390, 7);
      regs.hl = (regs.hl + 1) & 0xffff; m.step(0x2391, 6);
      if (regs.djnz() !== 0) { m.step(0x238c, 13); continue; }
      m.step(0x2393, 8); break;
    }
    if (!go239e) {
      regs.hl = 0x8083; m.step(0x2396, 10);
      regs.a = mem.read8(0x8343); m.step(0x2399, 13); // 2396  ld a,(0x8343)
      regs.add(mem.read8(regs.hl)); m.step(0x239a, 7); // 2399  add a,(hl)
      regs.and(0x0f); m.step(0x239c, 7);
      regs.and(regs.a); m.step(0x239d, 4);
      if (regs.fZ) { m.ret(11); return; }
      m.step(0x239e, 5);
    }
  }
  m.push16(0x23a1); m.step(0x2405, 17); m.call(0x2405); // 239e  call 0x2405 (pattern A)
  return m.call(0x23a1); // fall into loc_23a1
}
