// SPDX-License-Identifier: GPL-3.0-only
//
// loc_2d80  (ROM 0x2d80-0x2db7) -- rope-extend driver (0x8f14 state 0). Steps the rope segment counter
// (0x8931) up to (0x8903)-2; gated on (0x8f18)<4 or (0x89ef) set. Advances (0x8f18), looks up a video
// column base 0x84xx from table 0x2db8 (rst 0x20) into (0x8f19), clears the 0x8f26 cell pair indexed
// by (0x8f18), and arms the 0x8f14/0x8f16 sub-timers. rst 0x20 = loc_0020; table 0x2db8 is ROM data.
export function loc_2d80(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8903); m.step(0x2d83, 13); // 2d80  ld a,(0x8903)
  regs.sub(0x02); m.step(0x2d85, 7);
  regs.hl = 0x8931; m.step(0x2d88, 10);
  regs.cp(mem.read8(regs.hl)); m.step(0x2d89, 7); // 2d88  cp (hl)
  if (regs.fZ) { m.ret(11); return; }
  m.step(0x2d8a, 5);
  regs.incMem8(mem, regs.hl); m.step(0x2d8b, 11); // 2d8a  inc (hl)
  regs.hl = 0x8f18; m.step(0x2d8e, 10);
  regs.a = mem.read8(regs.hl); m.step(0x2d8f, 7); // 2d8e  ld a,(hl)
  regs.cp(0x04); m.step(0x2d91, 7);
  if (regs.fC) {
    m.step(0x2d98, 12);
  } else {
    m.step(0x2d93, 7);
    regs.a = mem.read8(0x89ef); m.step(0x2d96, 13); // 2d93  ld a,(0x89ef)
    regs.and(regs.a); m.step(0x2d97, 4);
    if (regs.fZ) { m.ret(11); return; }
    m.step(0x2d98, 5);
  }
  regs.incMem8(mem, regs.hl); m.step(0x2d99, 11); // 2d98  inc (hl)
  regs.hl = 0x2db8; m.step(0x2d9c, 10);
  m.push16(0x2d9d); m.step(0x0020, 11); m.call(0x0020); // 2d9c  rst 0x20 (A := table_0x2db8[A])
  regs.l = regs.a; m.step(0x2d9e, 4);
  regs.h = 0x84; m.step(0x2da0, 7);
  mem.write16(0x8f19, regs.hl); m.step(0x2da3, 16); // 2da0  ld (0x8f19),hl
  regs.a = mem.read8(0x8f18); m.step(0x2da6, 13); // 2da3  ld a,(0x8f18)
  regs.b = regs.a; m.step(0x2da7, 4);
  regs.hl = 0x8f26; m.step(0x2daa, 10);
  for (;;) {
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x2dab, 6);
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x2dac, 6);
    if (regs.djnz() !== 0) { m.step(0x2daa, 13); continue; }
    m.step(0x2dae, 8); break;
  }
  mem.write8(regs.hl, 0x10); m.step(0x2db0, 10); // 2dae  ld (hl),0x10
  regs.l = 0x14; m.step(0x2db2, 7); // 2db0  ld l,0x14 -> 0x8f14
  regs.incMem8(mem, regs.hl); m.step(0x2db3, 11); // 2db2  inc (hl)
  regs.l = 0x16; m.step(0x2db5, 7); // 2db3  ld l,0x16 -> 0x8f16
  mem.write8(regs.hl, 0x10); m.step(0x2db7, 10); // 2db5  ld (hl),0x10
  m.ret();
}
