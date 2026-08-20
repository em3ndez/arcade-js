// SPDX-License-Identifier: GPL-3.0-only

// loc_6274  (ROM 0x6274-0x6286) -- pick the active tile row buffer (0x8c90 / 0x8ca8 by I-register
// parity via `ld a,i`), blank 0x18 tiles there (rst 0x10, A=0), run loc_0ef1, then SKIP-RETURN
// (`pop af` discards the caller's return -> the `ret` lands one frame up). Shared tail: entered by
// call, by `jp 0x6274` (0x630c) and by fall-through from 0x6270.
export function loc_6274(m) {
  const { regs, mem } = m;

  regs.hl = 0x8c90;            m.step(0x6277, 10);
  regs.ldAI();                 m.step(0x6279, 9);   // ld a,i -- Z = (I == 0)
  if (regs.fZ) {
    m.step(0x627e, 12);        // jr z -- keep 0x8c90
  } else {
    m.step(0x627b, 7);
    regs.hl = 0x8ca8;          m.step(0x627e, 10);
  }
  regs.b = 0x18;               m.step(0x6280, 7);
  regs.xor(regs.a);            m.step(0x6281, 4);
  m.push16(0x6282); m.step(0x0010, 11); m.call(0x0010); // rst 0x10 -- blank 0x18 tiles = 0
  m.push16(0x6285); m.step(0x0ef1, 17); m.call(0x0ef1);
  regs.af = m.pop16();         m.step(0x6286, 10); // discard the caller's return -> ret skips a frame
  m.ret(10);
}
