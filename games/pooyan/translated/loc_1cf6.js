// SPDX-License-Identifier: GPL-3.0-only

// loc_1cf6  (ROM 0x1cf6-0x1d0c) -- a distinct routine entered by `jr z,0x1cf6` at 0x1ccb
// (SPLIT out of the 0x1cec-0x1d0d span). If (0x8988)==0 delegate to loc_1d15; otherwise clear
// (0x880a), rst-0x10 fill 0x3f bytes at 0x8940 with 0, set (0x880d)=1, call 0x02e3, then fall
// through into loc_1d0d (its own routine). rst 0x10 and call 0x02e3 are pattern-A calls.
export function loc_1cf6(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8988);   m.step(0x1cf9, 13); // 1cf6  ld a,(0x8988)
  regs.and(regs.a);             m.step(0x1cfa, 4);  // 1cf9  and a
  if (regs.fZ) { m.step(0x1d15, 12); return m.call(0x1d15); } // 1cfa  jr z,0x1d15
  m.step(0x1cfc, 7);
  regs.xor(regs.a);             m.step(0x1cfd, 4);  // 1cfc  xor a
  mem.write8(0x880a, regs.a);   m.step(0x1d00, 13); // 1cfd  ld (0x880a),a
  regs.hl = 0x8940;             m.step(0x1d03, 10); // 1d00  ld hl,0x8940
  regs.b = 0x3f;                m.step(0x1d05, 7);  // 1d03  ld b,0x3f
  m.push16(0x1d06); m.step(0x0010, 11); m.call(0x0010); // 1d05  rst 0x10 (fill = 0)
  regs.a = regs.inc8(regs.a);   m.step(0x1d07, 4);  // 1d06  inc a
  mem.write8(0x880d, regs.a);   m.step(0x1d0a, 13); // 1d07  ld (0x880d),a
  m.push16(0x1d0d); m.step(0x02e3, 17); m.call(0x02e3); // 1d0a  call 0x02e3
  return m.call(0x1d0d);        // fall through into loc_1d0d
}
