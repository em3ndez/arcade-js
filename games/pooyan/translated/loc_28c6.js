// SPDX-License-Identifier: GPL-3.0-only
//
// loc_28c6  (ROM 0x28c6-0x28f0) -- per-frame driver for the 0x8a80 actor's secondary state machine,
// called from 0x19fa. After loc_2101, if (0x8907) bit0 is clear it forces state (0x880a)=6 and
// returns; else if (0x8f08) is set it forces state 4 and returns. Otherwise it pushes the shared
// epilogue loc_2b8d as the handler return, runs the frame delay (ix+0x11), and (on expiry) dispatches
// (ix+0x02)&7 via rst 0x28 into the inline table at 0x28f1
// {0->0x2901,1->0x29a0,2->0x2a01,3->0x2a32,4->0x2a79,5->0x2a96,6->0x2ab3,7->0x2ae8}. loc_2101 = plain
// call (its own m.ret). The `ret nz` at 0x28ea returns into loc_2b8d, not loc_28c6's caller.
export function loc_28c6(m) {
  const { regs, mem } = m;

  m.push16(0x28c9); m.step(0x2101, 17); m.call(0x2101);
  regs.a = mem.read8(0x8907); m.step(0x28cc, 13); // 28c9  ld a,(0x8907)
  regs.bit(0, regs.a); m.step(0x28ce, 8);
  regs.hl = 0x880a; m.step(0x28d1, 10);
  if (regs.fNZ) {
    m.step(0x28d6, 12);
  } else {
    m.step(0x28d3, 7);
    mem.write8(regs.hl, 0x06); m.step(0x28d5, 10); // 28d3  ld (hl),0x06
    m.ret();
    return;
  }
  regs.a = mem.read8(0x8f08); m.step(0x28d9, 13); // 28d6  ld a,(0x8f08)
  regs.and(regs.a); m.step(0x28da, 4);
  if (regs.fZ) {
    m.step(0x28df, 12);
  } else {
    m.step(0x28dc, 7);
    mem.write8(regs.hl, 0x04); m.step(0x28de, 10); // 28dc  ld (hl),0x04
    m.ret();
    return;
  }
  regs.ix = 0x8a80; m.step(0x28e3, 14);
  regs.hl = 0x2b8d; m.step(0x28e6, 10);
  m.push16(regs.hl); m.step(0x28e7, 11); // 28e6  push hl (handler epilogue loc_2b8d)
  regs.decMem8(mem, (regs.ix + 0x11) & 0xffff); m.step(0x28ea, 23); // 28e7  dec (ix+0x11)
  if (regs.fNZ) { m.ret(11); return; } // 28ea  ret nz -> returns into loc_2b8d
  m.step(0x28eb, 5);
  regs.a = mem.read8((regs.ix + 0x02) & 0xffff); m.step(0x28ee, 19); // 28eb  ld a,(ix+0x02)
  regs.and(0x07); m.step(0x28f0, 7);
  m.push16(0x28f1); m.step(0x0028, 11); // 28f0  rst 0x28 (table base 0x28f1)
  return m.call(0x0028);
}
