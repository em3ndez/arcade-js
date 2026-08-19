// SPDX-License-Identifier: GPL-3.0-only

// loc_09f8  (ROM 0x09f8-0x0a0b) -- steps the (ix+0x0e) timer handler (0x4006) across four
// 0x18-byte object records from 0x8b70 (IX += 0x18 per pass), then delegates to the sprite
// display-list builder (0x02ef). 0x4006 and 0x02ef both plain-ret -> pattern-A call sites.
export function loc_09f8(m) {
  const { regs } = m;

  regs.ix = 0x8b70;
  m.step(0x09fc, 14); // 09f8  ld ix,0x8b70
  regs.b = 0x04;
  m.step(0x09fe, 7); // 09fc  ld b,0x04
  regs.de = 0x0018;
  m.step(0x0a01, 10); // 09fe  ld de,0x0018

  for (;;) {
    m.push16(0x0a04);
    m.step(0x4006, 17); // 0a01  call 0x4006 (pattern-A: pushed 0x0a04 popped by its ret)
    m.call(0x4006);
    regs.addIx(regs.de);
    m.step(0x0a06, 15); // 0a04  add ix,de
    if (regs.djnz() !== 0) { m.step(0x0a01, 13); continue; } // 0a06  djnz 0x0a01
    m.step(0x0a08, 8);
    break;
  }

  m.push16(0x0a0b);
  m.step(0x02ef, 17); // 0a08  call 0x02ef (pattern-A)
  m.call(0x02ef);
  m.ret(); // 0a0b  ret
}
