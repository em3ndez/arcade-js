// SPDX-License-Identifier: GPL-3.0-only
//
// loc_2d66  (ROM 0x2d66-0x2d77) -- pull-rope even-frame branch (reached from loc_25a6 when (0x8907)
// bit0 is clear). Aborts if (0x8d32) is busy or (0x8903)==2; otherwise runs the rope-tile driver
// loc_2d78 and the rope-cell writer loc_2e22. Both are pattern A.
export function loc_2d66(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8d32); m.step(0x2d69, 13); // 2d66  ld a,(0x8d32)
  regs.and(regs.a); m.step(0x2d6a, 4); // 2d69  and a
  if (regs.fNZ) { m.ret(11); return; } // 2d6a  ret nz
  m.step(0x2d6b, 5);
  regs.a = mem.read8(0x8903); m.step(0x2d6e, 13); // 2d6b  ld a,(0x8903)
  regs.sub(0x02); m.step(0x2d70, 7); // 2d6e  sub 0x02
  if (regs.fZ) { m.ret(11); return; } // 2d70  ret z
  m.step(0x2d71, 5);
  m.push16(0x2d74); m.step(0x2d78, 17); m.call(0x2d78); // 2d71  call 0x2d78
  m.push16(0x2d77); m.step(0x2e22, 17); m.call(0x2e22); // 2d74  call 0x2e22
  m.ret(); // 2d77  ret
}
