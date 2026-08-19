// SPDX-License-Identifier: GPL-3.0-only
//
// loc_2bd3  (ROM 0x2bd3-0x2be0) -- blit the ready-sprite tile: unless the tile already at 0x87bb is
// 0xba, paint source block 0x2be1 there via loc_3325. Reached by fallthrough from loc_2bbf/loc_2bd2
// and by `jr z 0x2bd3` from loc_2bbf. loc_3325 is pattern A; source 0x2be1 is ROM data.
export function loc_2bd3(m) {
  const { regs, mem } = m;

  regs.hl = 0x87bb; m.step(0x2bd6, 10); // 2bd3  ld hl,0x87bb
  regs.a = mem.read8(regs.hl); m.step(0x2bd7, 7); // 2bd6  ld a,(hl)
  regs.cp(0xba); m.step(0x2bd9, 7); // 2bd7  cp 0xba
  if (regs.fZ) { m.ret(11); return; } // 2bd9  ret z
  m.step(0x2bda, 5);
  regs.de = 0x2be1; m.step(0x2bdd, 10); // 2bda  ld de,0x2be1
  m.push16(0x2be0); m.step(0x3325, 17); m.call(0x3325); // 2bdd  call 0x3325 (pattern A)
  m.ret(); // 2be0  ret
}
