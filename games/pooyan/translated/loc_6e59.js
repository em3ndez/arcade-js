// SPDX-License-Identifier: GPL-3.0-only

// loc_6e59  (ROM 0x6e59-0x6e74) -- level-intro phase 1 (per-frame body). A straight run of nine
// subroutine calls -- input/actor/sound updates plus the phase-1-specific 0x6e75 spawner -- then
// returns to loc_6da6's caller.
export function loc_6e59(m) {
  const { regs } = m;

  m.push16(0x6e5c);
  m.step(0x1583, 17); // 6e59  call 0x1583
  m.call(0x1583);
  m.push16(0x6e5f);
  m.step(0x6e75, 17); // 6e5c  call 0x6e75
  m.call(0x6e75);
  m.push16(0x6e62);
  m.step(0x1e55, 17); // 6e5f  call 0x1e55
  m.call(0x1e55);
  m.push16(0x6e65);
  m.step(0x20d4, 17); // 6e62  call 0x20d4
  m.call(0x20d4);
  m.push16(0x6e68);
  m.step(0x02ef, 17); // 6e65  call 0x02ef
  m.call(0x02ef);
  m.push16(0x6e6b);
  m.step(0x18da, 17); // 6e68  call 0x18da
  m.call(0x18da);
  m.push16(0x6e6e);
  m.step(0x191c, 17); // 6e6b  call 0x191c
  m.call(0x191c);
  m.push16(0x6e71);
  m.step(0x6404, 17); // 6e6e  call 0x6404
  m.call(0x6404);
  m.push16(0x6e74);
  m.step(0x0e64, 17); // 6e71  call 0x0e64
  m.call(0x0e64);
  m.ret(); // 6e74  ret
}
