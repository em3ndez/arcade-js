// SPDX-License-Identifier: GPL-3.0-only
//
// loc_3266  (ROM 0x3266-0x3277) -- hunter-formation dispatch state 2 (rst 0x30eb[2]): a ROM
// self-check summing 0x20 bytes at 0x0799; unless the sum is 0xdc it re-enters 0x0799 (guard,
// delegated), otherwise it returns to the shared epilogue (loc_32bd).
export function loc_3266(m) {
  const { regs, mem } = m;

  regs.hl = 0x0799; m.step(0x3269, 10); // 3266  ld hl,0x0799
  regs.bc = 0x2000; m.step(0x326c, 10); // 3269  ld bc,0x2000
  for (;;) {
    regs.a = mem.read8(regs.hl); m.step(0x326d, 7); // 326c  ld a,(hl)
    regs.add(regs.c); m.step(0x326e, 4); // 326d  add a,c
    regs.c = regs.a; m.step(0x326f, 4); // 326e  ld c,a
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x3270, 6); // 326f  inc hl
    if (regs.djnz() !== 0) { m.step(0x326c, 13); continue; } // 3270  djnz 0x326c
    m.step(0x3272, 8); break;
  }
  regs.cp(0xdc); m.step(0x3274, 7); // 3272  cp 0xdc
  if (regs.fNZ) { throw new Error("loc_3266: ROM-integrity/sanity trap 0x0799 unreachable with a valid ROM"); } // 3274  jp nz,0x0799 (guard)
  m.step(0x3277, 10);
  m.ret(); // 3277  ret
}
