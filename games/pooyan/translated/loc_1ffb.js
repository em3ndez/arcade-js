// SPDX-License-Identifier: GPL-3.0-only

// loc_1ffb  (ROM 0x1ffb-0x200c) -- select one of two ROM glyph tables by bit5 of B and render it.
// bit5 clear -> table 0x203b; bit5 set -> table 0x2050. HL = 0x8062 (VRAM dest); loc_3307 does the
// actual field render. Tail returns after the render.
export function loc_1ffb(m) {
  const { regs, mem } = m;

  regs.a = regs.b;             m.step(0x1ffc, 4);  // ld a,b
  regs.bit(5, regs.a);         m.step(0x1ffe, 8);  // bit 5,a
  regs.de = 0x203b;            m.step(0x2001, 10);
  if (regs.fZ) {
    m.step(0x2006, 12);        // jr z (bit5 clear) -> keep 0x203b
  } else {
    m.step(0x2003, 7);
    regs.de = 0x2050;          m.step(0x2006, 10);
  }
  regs.hl = 0x8062;            m.step(0x2009, 10);
  m.push16(0x200c);
  m.step(0x3307, 17);          // 2009  call 0x3307
  m.call(0x3307);
  return m.ret(10);            // 200c  ret
}
