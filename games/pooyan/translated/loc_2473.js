// SPDX-License-Identifier: GPL-3.0-only
//
// loc_2473  (ROM 0x2473-0x2496) -- 0x8a80 actor state 1 (dispatch 0x2436[1]). Counts down the frame
// delay (ix+0x11); on expiry, if (0x8a39) is zero it reseeds the delay and advances the state, else
// it skips that via a mid-instruction jump to 0x2483 -- the third byte (0x02) of `inc (ix+0x02)`
// decodes as `ld (bc),a` when entered there. Both paths converge at 0x2484: base Y += 0x10, clear
// (ix+0x1e), load shape table 0x26c1 via loc_250f (pattern A).
export function loc_2473(m) {
  const { regs, mem } = m;

  regs.decMem8(mem, (regs.ix + 0x11) & 0xffff); m.step(0x2476, 23); // 2473  dec (ix+0x11)
  if (regs.fNZ) { m.ret(11); return; }
  m.step(0x2477, 5);
  regs.a = mem.read8(0x8a39); m.step(0x247a, 13); // 2477  ld a,(0x8a39)
  regs.and(regs.a); m.step(0x247b, 4);
  if (regs.fNZ) {
    m.step(0x2483, 12); // 247b  jr nz,0x2483 (into inc (ix+0x02))
    mem.write8(regs.bc, regs.a); m.step(0x2484, 7); // 2483  ld (bc),a (overlap byte)
  } else {
    m.step(0x247d, 7);
    mem.write8((regs.ix + 0x11) & 0xffff, 0x10); m.step(0x2481, 19); // 247d  ld (ix+0x11),0x10
    regs.incMem8(mem, (regs.ix + 0x02) & 0xffff); m.step(0x2484, 23); // 2481  inc (ix+0x02)
  }
  regs.a = mem.read8((regs.ix + 0x04) & 0xffff); m.step(0x2487, 19); // 2484  ld a,(ix+0x04)
  regs.add(0x10); m.step(0x2489, 7);
  mem.write8((regs.ix + 0x04) & 0xffff, regs.a); m.step(0x248c, 19); // 2489  ld (ix+0x04),a
  regs.xor(regs.a); m.step(0x248d, 4);
  mem.write8((regs.ix + 0x1e) & 0xffff, regs.a); m.step(0x2490, 19); // 248d  ld (ix+0x1e),a
  regs.hl = 0x26c1; m.step(0x2493, 10);
  m.push16(0x2496); m.step(0x250f, 17); m.call(0x250f); // 2493  call 0x250f (pattern A)
  m.ret();
}
