// SPDX-License-Identifier: GPL-3.0-only
//
// loc_24fb  (ROM 0x24fb-0x250e) -- 0x8a80 actor state 5 (dispatch 0x2436[5]). Frame-delay countdown;
// on expiry writes 0x07 into a flag at 0x882b (or 0x880a when 0x882b is already non-zero). If
// (0x8a3c) is zero it returns, otherwise it falls into loc_250f to reload a shape from the pointer
// left in HL (0x882b/0x880a).
export function loc_24fb(m) {
  const { regs, mem } = m;

  regs.decMem8(mem, (regs.ix + 0x11) & 0xffff); m.step(0x24fe, 23); // 24fb  dec (ix+0x11)
  if (regs.fNZ) { m.ret(11); return; } // 24fe  ret nz
  m.step(0x24ff, 5);
  regs.hl = 0x882b; m.step(0x2502, 10); // 24ff  ld hl,0x882b
  regs.a = mem.read8(regs.hl); m.step(0x2503, 7); // 2502  ld a,(hl)
  regs.and(regs.a); m.step(0x2504, 4); // 2503  and a
  if (regs.fNZ) {
    m.step(0x2508, 12); // 2504  jr nz,0x2508
  } else {
    m.step(0x2506, 7);
    regs.l = 0x0a; m.step(0x2508, 7); // 2506  ld l,0x0a -> 0x880a
  }
  mem.write8(regs.hl, 0x07); m.step(0x250a, 10); // 2508  ld (hl),0x07
  regs.a = mem.read8(0x8a3c); m.step(0x250d, 13); // 250a  ld a,(0x8a3c)
  regs.and(regs.a); m.step(0x250e, 4); // 250d  and a
  if (regs.fZ) { m.ret(11); return; } // 250e  ret z
  m.step(0x250f, 5);
  return m.call(0x250f); // fall into loc_250f
}
