// SPDX-License-Identifier: GPL-3.0-only
//
// loc_2405  (ROM 0x2405-0x241d) -- even-frame gate + script-pointer advance (mirror of loc_23ec, the
// opposite direction). Bumps 0x8f37 and returns on even frames (bit0 clear). Otherwise it walks the
// script pointer (0x88be): unless the byte reached 0x37 it increments it; at 0x37 it steps hl to the
// next high byte and reseeds 0x34. Plain-ret (pattern A callee), used by loc_236a / 0x2901 / 0x2918.
export function loc_2405(m) {
  const { regs, mem } = m;

  regs.hl = 0x8f37; m.step(0x2408, 10); // 2405  ld hl,0x8f37
  regs.incMem8(mem, regs.hl); m.step(0x2409, 11); // 2408  inc (hl)
  regs.bit(0, mem.read8(regs.hl)); m.step(0x240b, 12); // 2409  bit 0,(hl)
  if (regs.fZ) { m.ret(11); return; } // 240b  ret z (even frame)
  m.step(0x240c, 5);
  regs.hl = mem.read16(0x88be); m.step(0x240f, 16); // 240c  ld hl,(0x88be)
  regs.a = mem.read8(regs.hl); m.step(0x2410, 7); // 240f  ld a,(hl)
  regs.cp(0x37); m.step(0x2412, 7); // 2410  cp 0x37
  if (regs.fNC) {
    m.step(0x2417, 12); // 2412  jr nc,0x2417
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x2418, 6); // 2417  inc hl
    mem.write8(regs.hl, 0x34); m.step(0x241a, 10); // 2418  ld (hl),0x34
  } else {
    m.step(0x2414, 7);
    regs.incMem8(mem, regs.hl); m.step(0x2415, 11); // 2414  inc (hl)
    m.step(0x241a, 12); // 2415  jr 0x241a
  }
  mem.write16(0x88be, regs.hl); m.step(0x241d, 16); // 241a  ld (0x88be),hl
  m.ret(); // 241d  ret
}
