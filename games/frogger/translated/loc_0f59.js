// SPDX-License-Identifier: GPL-3.0-only

// loc_0f59  (ROM 0x0F59-0x0F68) — game-over / level line: clear the 0xA850 VRAM row via loc_19e2,
// then blit a 9-tile string via rst 0x28 (loc_0028: DE=src=0x2F0E, HL=dst=0xAA70, B=9).
// Called from loc_048f.
export function loc_0f59(m) {
  const { regs } = m;

  regs.hl = 0xa850;
  m.step(0x0f5c, 10);
  m.push16(0x0f5f);
  m.step(0x19e2, 17); // call 0x19e2 -- clear the 0xa850 row
  m.call(0x19e2);

  regs.hl = 0xaa70;
  m.step(0x0f62, 10);
  regs.de = 0x2f0e;
  m.step(0x0f65, 10);
  regs.b = 0x09;
  m.step(0x0f67, 7);
  m.push16(0x0f68);
  m.step(0x0028, 11); // rst 0x28 -- blit 9 tiles from 0x2f0e
  m.call(0x0028);

  m.ret();
}
