// SPDX-License-Identifier: GPL-3.0-only

// loc_0fef  (ROM 0x0fef-0x1034) -- main-loop sub-state 0 handler (selected by 0x8f5c & 7 == 0).
// Writes 0x0f to 0x8901; if bit 2 of (0x8907) is set, runs 0x50f1. Then re-arms three main-loop
// flags (0x8f61, 0x8f3f, 0x8f5c all = 1), calls the setup helper 0x0fbc, and reads the pending
// sub-state byte at (0x8a38): if it's 0, `ret`s; otherwise it stores it into 0x8f5c and FALLS
// THROUGH into loc_1016 -- the per-frame worker chain (0x1583/0x1042/0x107d/0x20d4/0x511b/
// 0x1219/0x40bd/0x02ef/0x5ae4/0x0e64) -- then `ret`s.
export function loc_0fef(m) {
  const { regs, mem } = m;

  regs.a = 0x0f;
  m.step(0x0ff1, 7); // 0fef  ld a,0x0f
  regs.hl = 0x8901;
  m.step(0x0ff4, 10); // 0ff1  ld hl,0x8901
  mem.write8(regs.hl, regs.a);
  m.step(0x0ff5, 7); // 0ff4  ld (hl),a
  regs.l = 0x07;
  m.step(0x0ff7, 7); // 0ff5  ld l,0x07 -- HL = 0x8907

  regs.bit(2, mem.read8(regs.hl));
  m.step(0x0ff9, 12); // 0ff7  bit 2,(hl)
  if (regs.fZ) {
    m.step(0x0ffe, 12); // 0ff9  jr z,0x0ffe taken -- bit 2 clear, skip 0x50f1
  } else {
    m.step(0x0ffb, 7); // 0ff9  jr z not taken
    m.push16(0x0ffe); // 0ffb  call 0x50f1 -- seat the return
    m.step(0x50f1, 17);
    m.call(0x50f1, "loc_50f1 -- bit-2 conditional side routine");
  }

  // loc_0ffe -- re-arm main-loop flags and run setup.
  regs.a = 0x01;
  m.step(0x1000, 7); // 0ffe  ld a,0x01
  mem.write8(0x8f61, regs.a);
  m.step(0x1003, 13); // 1000  ld (0x8f61),a
  mem.write8(0x8f3f, regs.a);
  m.step(0x1006, 13); // 1003  ld (0x8f3f),a
  mem.write8(0x8f5c, regs.a);
  m.step(0x1009, 13); // 1006  ld (0x8f5c),a
  m.push16(0x100c); // 1009  call 0x0fbc -- seat the return
  m.step(0x0fbc, 17);
  m.call(0x0fbc, "loc_0fbc -- main-loop setup helper");

  regs.hl = 0x8a38;
  m.step(0x100f, 10); // 100c  ld hl,0x8a38
  regs.a = mem.read8(regs.hl);
  m.step(0x1010, 7); // 100f  ld a,(hl)
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x1011, 6); // 1010  inc hl
  regs.or(regs.a);
  m.step(0x1012, 4); // 1011  or a
  if (regs.fZ) {
    m.ret(11); // 1012  ret z taken -- no pending sub-state
    return;
  }
  m.step(0x1013, 5); // 1012  ret z not taken
  mem.write8(0x8f5c, regs.a);
  m.step(0x1016, 13); // 1013  ld (0x8f5c),a -- store pending sub-state, fall through

  // loc_1016 -- per-frame worker chain (fall-through target).
  m.push16(0x1019); // 1016  call 0x1583
  m.step(0x1583, 17);
  m.call(0x1583, "loc_1583");
  m.push16(0x101c); // 1019  call 0x1042
  m.step(0x1042, 17);
  m.call(0x1042, "loc_1042");
  m.push16(0x101f); // 101c  call 0x107d
  m.step(0x107d, 17);
  m.call(0x107d, "loc_107d");
  m.push16(0x1022); // 101f  call 0x20d4
  m.step(0x20d4, 17);
  m.call(0x20d4, "loc_20d4");
  m.push16(0x1025); // 1022  call 0x511b
  m.step(0x511b, 17);
  m.call(0x511b, "loc_511b");
  m.push16(0x1028); // 1025  call 0x1219
  m.step(0x1219, 17);
  m.call(0x1219, "loc_1219 -- per-object update sweep");
  m.push16(0x102b); // 1028  call 0x40bd
  m.step(0x40bd, 17);
  m.call(0x40bd, "loc_40bd");
  m.push16(0x102e); // 102b  call 0x02ef
  m.step(0x02ef, 17);
  m.call(0x02ef, "loc_02ef -- sprite display-list builder");
  m.push16(0x1031); // 102e  call 0x5ae4
  m.step(0x5ae4, 17);
  m.call(0x5ae4, "loc_5ae4");
  m.push16(0x1034); // 1031  call 0x0e64
  m.step(0x0e64, 17);
  m.call(0x0e64, "loc_0e64 -- ring consumer");

  m.ret(); // 1034  ret
}
