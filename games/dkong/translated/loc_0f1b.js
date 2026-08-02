// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0f1b  (ROM 0x0F1B–0x0F55) — ROUND-2 BATCH: kind-4/5/6 record strip filler.
 * Reached from loc_0ee8 (kind>=4). kind>=7
 * -> 0x0ECF (inc de / jp 0x0da7). Kind picks the fill tile-code (4->0xE0, 5->0xB0,
 * 6->0xFE), then a do-while column fill. `jp p` @0x0F20 is a SIGN test (not jp nc);
 * `jp 0x0da7` exits are the walk back-edge -> `return`.
 */
export function loc_0f1b(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x63b3);
  m.step(0x0f1e, 13); // ld a,(0x63b3) -- record kind
  regs.cp(0x07);
  m.step(0x0f20, 7); // cp 0x07
  if (regs.fP) {
    // jp p,0x0ecf -- kind >= 7 (SIGN test)
    m.step(0x0ecf, 10); // jp p taken
    regs.de = (regs.de + 1) & 0xffff;
    m.step(0x0ed0, 6); // inc de
    m.step(0x0da7, 10); // jp 0x0da7 -- walk back-edge
    return;
  }
  m.step(0x0f23, 10); // jp p NOT taken

  regs.cp(0x04);
  m.step(0x0f25, 7); // cp 0x04
  if (regs.fZ) {
    m.step(0x0f4c, 10); // jp z,0x0f4c -- kind 4
    regs.a = 0xe0;
    m.step(0x0f4e, 7); // ld a,0xe0
    m.step(0x0f2f, 10); // jp 0x0f2f
  } else {
    m.step(0x0f28, 10); // jp z NOT taken
    regs.cp(0x05);
    m.step(0x0f2a, 7); // cp 0x05
    if (regs.fZ) {
      m.step(0x0f51, 10); // jp z,0x0f51 -- kind 5
      regs.a = 0xb0;
      m.step(0x0f53, 7); // ld a,0xb0
      m.step(0x0f2f, 10); // jp 0x0f2f
    } else {
      m.step(0x0f2d, 10); // jp z NOT taken -- kind 6 (default)
      regs.a = 0xfe;
      m.step(0x0f2f, 7); // ld a,0xfe
    }
  }

  // loc_0f2f -- common fill body; A = fill tile-code
  mem.write8(0x63b5, regs.a);
  m.step(0x0f32, 13); // ld (0x63b5),a
  regs.hl = mem.read16(0x63ab);
  m.step(0x0f35, 16); // ld hl,(0x63ab)

  do {
    regs.a = mem.read8(0x63b5);
    m.step(0x0f38, 13); // ld a,(0x63b5)
    mem.write8(regs.hl, regs.a);
    m.step(0x0f39, 7); // ld (hl),a
    regs.bc = 0x0020;
    m.step(0x0f3c, 10); // ld bc,0x0020
    regs.addHl(regs.bc);
    m.step(0x0f3d, 11); // add hl,bc
    regs.a = mem.read8(0x63b1);
    m.step(0x0f40, 13); // ld a,(0x63b1)
    regs.sub(0x08);
    m.step(0x0f42, 7); // sub 0x08
    mem.write8(0x63b1, regs.a);
    m.step(0x0f45, 13); // ld (0x63b1),a
    m.step(regs.fNC ? 0x0f35 : 0x0f48, 10); // jp nc,0x0f35
  } while (regs.fNC);

  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x0f49, 6); // inc de
  m.step(0x0da7, 10); // jp 0x0da7 -- walk back-edge
  return;
}
