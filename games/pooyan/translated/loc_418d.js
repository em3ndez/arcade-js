// SPDX-License-Identifier: GPL-3.0-only

// loc_418d  (ROM 0x418d-0x41b0) -- steps the (ix+0x11) countdown handler (0x4006); while the
// counter is still non-zero it returns. On expiry it enqueues a display command via rst 0x38
// (D=0x03, E=0x12 + adjusted (ix+0x16)), re-seats (ix+0x11)=1 / (ix+0x13)=C+1 / (ix+0x02)=2,
// then tail-jumps to loc_416f.
export function loc_418d(m) {
  const { regs, mem } = m;

  m.push16(0x4190);
  m.step(0x4006, 17); // 418d  call 0x4006 (pattern A)
  m.call(0x4006);

  regs.decMem8(mem, (regs.ix + 0x11) & 0xffff); m.step(0x4193, 23); // 4190  dec (ix+0x11)
  if (regs.fNZ) { m.ret(11); return; }                             // 4193  ret nz taken -- still counting
  m.step(0x4194, 5); // 4193  ret nz not taken

  regs.a = mem.read8((regs.ix + 0x16) & 0xffff); m.step(0x4197, 19); // 4194  ld a,(ix+0x16)
  regs.c = regs.a;                               m.step(0x4198, 4);  // 4197  ld c,a
  regs.and(regs.a);                              m.step(0x4199, 4);  // 4198  and a
  if (regs.fZ) {
    m.step(0x419c, 12); // 4199  jr z,0x419c taken
  } else {
    m.step(0x419b, 7);                           // 4199  jr z not taken
    regs.a = regs.dec8(regs.a); m.step(0x419c, 4); // 419b  dec a
  }
  regs.de = 0x0312;   m.step(0x419f, 10); // 419c  ld de,0x0312
  regs.add(regs.e);   m.step(0x41a0, 4);  // 419f  add a,e
  regs.e = regs.a;    m.step(0x41a1, 4);  // 41a0  ld e,a

  m.push16(0x41a2);
  m.step(0x0038, 11); // 41a1  rst 0x38 (enqueue DE)
  m.call(0x0038);

  mem.write8((regs.ix + 0x11) & 0xffff, 0x01); m.step(0x41a6, 19); // 41a2  ld (ix+0x11),0x01
  regs.c = regs.inc8(regs.c);                  m.step(0x41a7, 4);  // 41a6  inc c
  mem.write8((regs.ix + 0x13) & 0xffff, regs.c); m.step(0x41aa, 19); // 41a7  ld (ix+0x13),c
  mem.write8((regs.ix + 0x02) & 0xffff, 0x02); m.step(0x41ae, 19); // 41aa  ld (ix+0x02),0x02

  m.step(0x416f, 10); // 41ae  jp 0x416f (tail)
  return m.call(0x416f);
}
