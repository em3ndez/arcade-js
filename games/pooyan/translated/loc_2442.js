// SPDX-License-Identifier: GPL-3.0-only
//
// loc_2442  (ROM 0x2442-0x2472) -- 0x8a80 actor state 0 (dispatch 0x2436[0]). Idle until both
// 0x89e8 and 0x89ef read zero; then seed the frame delay (ix+0x11)=0x10, advance the state
// (ix+0x02), snapshot the 0x18-byte actor record 0x8a80->0x8a98 (ldir), drop the base Y (ix+0x04)
// by 0x10, and load the shape table 0x26bd via loc_250f. Returns early if (0x8f24) is busy, else
// runs loc_0fad. loc_250f/loc_0fad are pattern A.
export function loc_2442(m) {
  const { regs, mem } = m;

  regs.hl = 0x89e8; m.step(0x2445, 10);
  regs.a = mem.read8(regs.hl); m.step(0x2446, 7); // 2445  ld a,(hl)
  regs.l = 0xef; m.step(0x2448, 7); // 2446  ld l,0xef -> 0x89ef
  regs.or(mem.read8(regs.hl)); m.step(0x2449, 7); // 2448  or (hl)
  if (regs.fNZ) { m.ret(11); return; } // 2449  ret nz (still active)
  m.step(0x244a, 5);
  mem.write8((regs.ix + 0x11) & 0xffff, 0x10); m.step(0x244e, 19); // 244a  ld (ix+0x11),0x10
  regs.incMem8(mem, (regs.ix + 0x02) & 0xffff); m.step(0x2451, 23); // 244e  inc (ix+0x02)
  regs.hl = 0x8a80; m.step(0x2454, 10);
  regs.de = 0x8a98; m.step(0x2457, 10);
  regs.bc = 0x0018; m.step(0x245a, 10);
  m.ldirAt(0x245a, 0x245c); // 245a  ldir  (snapshot 0x18 bytes)
  regs.a = mem.read8((regs.ix + 0x04) & 0xffff); m.step(0x245f, 19); // 245c  ld a,(ix+0x04)
  regs.sub(0x10); m.step(0x2461, 7);
  mem.write8((regs.ix + 0x04) & 0xffff, regs.a); m.step(0x2464, 19); // 2461  ld (ix+0x04),a
  regs.hl = 0x26bd; m.step(0x2467, 10);
  m.push16(0x246a); m.step(0x250f, 17); m.call(0x250f); // 2467  call 0x250f (pattern A)
  regs.a = mem.read8(0x8f24); m.step(0x246d, 13); // 246a  ld a,(0x8f24)
  regs.and(regs.a); m.step(0x246e, 4);
  if (regs.fNZ) { m.ret(11); return; }
  m.step(0x246f, 5);
  m.push16(0x2472); m.step(0x0fad, 17); m.call(0x0fad); // 246f  call 0x0fad (pattern A)
  m.ret();
}
