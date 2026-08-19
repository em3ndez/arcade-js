// SPDX-License-Identifier: GPL-3.0-only

// loc_0320  (ROM 0x0320-0x0329) -- external jp-nz target (from 0x78f0) that also falls through
// from loc_02ef: `dec (hl)` on the caller-set frame counter, then gate on (0x881f). While that
// gate is non-zero it returns; once it reaches 0 it runs the loc_0378 vertical-mirror pass.
// loc_02ef inlines this same tail on its own fall-through; this is the standalone jp-nz entry.
export function loc_0320(m) {
  const { regs, mem } = m;

  regs.decMem8(mem, regs.hl);
  m.step(0x0321, 11); // 0320  dec (hl)
  regs.a = mem.read8(0x881f);
  m.step(0x0324, 13); // 0321  ld a,(0x881f)
  regs.and(regs.a);
  m.step(0x0325, 4); // 0324  and a
  if (regs.fNZ) {
    m.ret(11); // 0325  ret nz taken -- gate still counting
    return;
  }
  m.step(0x0326, 5); // 0325  ret nz not taken

  m.push16(0x0329);
  m.step(0x0378, 17); // 0326  call 0x0378 (pattern A: loc_0378 rets to 0x0329)
  m.call(0x0378);
  m.ret(); // 0329  ret
}
