// SPDX-License-Identifier: GPL-3.0-only
//
// loc_2dbc  (ROM 0x2dbc-0x2ded) -- rope-blit driver (0x8f14 state 1). Runs the 0x8f16 hold counter;
// on expiry, when the frame index (0x8f1b) has reached 8 it resets it and re-arms the next rope cell
// (0x8f14/0x8f18-derived), otherwise it looks up a tile-block via loc_0c45 (table 0x2dee) and blits
// it at the video column (0x8f19) via loc_3325, bumping (0x8f1b). loc_0c45/3325 pattern A.
export function loc_2dbc(m) {
  const { regs, mem } = m;

  regs.hl = 0x8f16; m.step(0x2dbf, 10);
  regs.a = mem.read8(regs.hl); m.step(0x2dc0, 7); // 2dbf  ld a,(hl)
  regs.and(regs.a); m.step(0x2dc1, 4);
  if (regs.fZ) {
    m.step(0x2dc5, 12);
  } else {
    m.step(0x2dc3, 7);
    regs.decMem8(mem, regs.hl); m.step(0x2dc4, 11); // 2dc3  dec (hl)
    m.ret();
    return;
  }
  mem.write8(regs.hl, 0x08); m.step(0x2dc7, 10); // 2dc5  ld (hl),0x08
  regs.l = 0x1b; m.step(0x2dc9, 7); // 2dc7  ld l,0x1b -> 0x8f1b
  regs.a = mem.read8(regs.hl); m.step(0x2dca, 7); // 2dc9  ld a,(hl)
  regs.cp(0x08); m.step(0x2dcc, 7);
  if (regs.fNZ) {
    m.step(0x2ddd, 12);
  } else {
    m.step(0x2dce, 7);
    regs.xor(regs.a); m.step(0x2dcf, 4);
    mem.write8(regs.hl, regs.a); m.step(0x2dd0, 7); // 2dcf  ld (hl),a
    regs.l = 0x14; m.step(0x2dd2, 7); // 2dd0  ld l,0x14 -> 0x8f14
    mem.write8(regs.hl, regs.a); m.step(0x2dd3, 7); // 2dd2  ld (hl),a
    regs.a = mem.read8(0x8f18); m.step(0x2dd6, 13); // 2dd3  ld a,(0x8f18)
    regs.l = 0x1b; m.step(0x2dd8, 7);
    regs.add(regs.l); m.step(0x2dd9, 4);
    regs.l = regs.a; m.step(0x2dda, 4);
    mem.write8(regs.hl, 0x01); m.step(0x2ddc, 10); // 2dda  ld (hl),0x01
    m.ret();
    return;
  }
  regs.hl = 0x2dee; m.step(0x2de0, 10);
  m.push16(0x2de3); m.step(0x0c45, 17); m.call(0x0c45); // 2de0  call 0x0c45 (pattern A)
  regs.hl = mem.read16(0x8f19); m.step(0x2de6, 16); // 2de3  ld hl,(0x8f19)
  m.push16(0x2de9); m.step(0x3325, 17); m.call(0x3325); // 2de6  call 0x3325 (pattern A)
  regs.hl = 0x8f1b; m.step(0x2dec, 10);
  regs.incMem8(mem, regs.hl); m.step(0x2ded, 11); // 2dec  inc (hl)
  m.ret();
}
