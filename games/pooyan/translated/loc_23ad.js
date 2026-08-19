// SPDX-License-Identifier: GPL-3.0-only
//
// loc_23ad  (ROM 0x23ad-0x23d6) -- render tail: mask the phase counter at (HL) to 0..3, look up a
// tile-block descriptor via loc_0c45 (table 0x26f6), and blit three 2x2 blocks with loc_3325 at
// video cells 0x8425 / 0x8465 / 0x84a5, the last choosing source 0x270a or 0x270e on (0x88bc) bit0.
// Entered by fallthrough from loc_23a1 and by `jr 0x23ad` from loc_2334. loc_0c45/loc_3325 plain-ret
// (pattern A). Tables 0x26f6 / 0x270a / 0x270e are ROM data.
export function loc_23ad(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(regs.hl); m.step(0x23ae, 7); // 23ad  ld a,(hl)
  regs.and(0x03); m.step(0x23b0, 7);
  mem.write8(regs.hl, regs.a); m.step(0x23b1, 7); // 23b0  ld (hl),a
  regs.hl = 0x26f6; m.step(0x23b4, 10);
  m.push16(0x23b7); m.step(0x0c45, 17); m.call(0x0c45); // 23b4  call 0x0c45 -> DE = table[A]
  m.push16(regs.de); m.step(0x23b8, 11);
  regs.hl = 0x8425; m.step(0x23bb, 10);
  m.push16(0x23be); m.step(0x3325, 17); m.call(0x3325); // 23bb  call 0x3325 (pattern A)
  regs.de = m.pop16(); m.step(0x23bf, 10);
  regs.l = 0x65; m.step(0x23c1, 7); // 23bf  ld l,0x65 -> 0x8465
  m.push16(0x23c4); m.step(0x3325, 17); m.call(0x3325); // 23c1  call 0x3325 (pattern A)
  regs.l = 0xa5; m.step(0x23c6, 7); // 23c4  ld l,0xa5 -> 0x84a5
  regs.de = 0x270a; m.step(0x23c9, 10);
  regs.a = mem.read8(0x88bc); m.step(0x23cc, 13); // 23c9  ld a,(0x88bc)
  regs.and(0x01); m.step(0x23ce, 7);
  if (regs.fNZ) {
    m.step(0x23d3, 12);
  } else {
    m.step(0x23d0, 7);
    regs.de = 0x270e; m.step(0x23d3, 10);
  }
  m.push16(0x23d6); m.step(0x3325, 17); m.call(0x3325); // 23d3  call 0x3325 (pattern A)
  m.ret();
}
