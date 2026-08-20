// SPDX-License-Identifier: GPL-3.0-only

// loc_6e75  (ROM 0x6e75-0x6e85) -- phase-1 spawner gate. If either the 0x881e freeze flag or the
// 0x8ef0 pause flag is set, the ROM's `jp nz,0x4c92` arm fires -- but 0x4c92 is DATA (a dead trap,
// see below), so that arm is unreachable in correct operation. Otherwise call the two spawn steps
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
    // 6e7c  jp nz,0x4c92 -- freeze(0x881e)/pause(0x8ef0) skip-spawn arm. 0x4c92 is a 0x95/0x98 DATA
    // table, so this arm is unreachable in correct operation (taking it would execute data). Model the trap.
    throw new Error("loc_6e75: freeze/pause trap 0x4c92 unreachable with a valid ROM (target is data)");
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
