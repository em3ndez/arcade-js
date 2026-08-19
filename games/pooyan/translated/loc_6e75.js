// SPDX-License-Identifier: GPL-3.0-only

// loc_6e75  (ROM 0x6e75-0x6e85) -- phase-1 spawner gate. If either the 0x881e freeze flag or the
// 0x8ef0 pause flag is set, tail-jump to 0x4c92 (skip spawning). Otherwise call the two spawn steps
// 0x6e86 (single-object launcher) and 0x6edb (per-record driver), then return.
export function loc_6e75(m) {
  const { regs, mem } = m;

  regs.hl = 0x881e;
  m.step(0x6e78, 10); // 6e75  ld hl,0x881e
  regs.a = mem.read8(0x8ef0);
  m.step(0x6e7b, 13); // 6e78  ld a,(0x8ef0)
  regs.or(mem.read8(regs.hl));
  m.step(0x6e7c, 7); // 6e7b  or (hl)
  if (regs.fNZ) {
    m.step(0x4c92, 10); // 6e7c  jp nz,0x4c92 -- frozen/paused: skip spawning
    return m.call(0x4c92);
  }
  m.step(0x6e7f, 10);
  m.push16(0x6e82);
  m.step(0x6e86, 17); // 6e7f  call 0x6e86
  m.call(0x6e86);
  m.push16(0x6e85);
  m.step(0x6edb, 17); // 6e82  call 0x6edb
  m.call(0x6edb);
  m.ret(); // 6e85  ret
}
