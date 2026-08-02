// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2a85  (ROM 0x2A85–0x2AB3) — 0x198F cascade: gated tile probe; sub_2a2f sibling.
 *
 * Three gates (0x6215, 0x6216, 0x6398), then probes the tilemap at position
 * (H=0x6203-3, L=0x6205+0x0C) via sub_2ff0. On the tape the executing exit is the
 * ret at 0x2AB3 (tile >= 0xB0 AND low-nibble < 8). The jp c / jp nc -> 0x2AB4 slope
 * cascade is NON-EXECUTING (frontier; see sub_2a2f).
 */
export function loc_2a85(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x6215);
  m.step(0x2a88, 13); // ld a,(0x6215)
  regs.and(regs.a);
  m.step(0x2a89, 4); // and a
  if (regs.fNZ) { m.ret(11); return; } // ret nz -- gate 1
  m.step(0x2a8a, 5);
  regs.a = mem.read8(0x6216);
  m.step(0x2a8d, 13); // ld a,(0x6216)
  regs.and(regs.a);
  m.step(0x2a8e, 4); // and a
  if (regs.fNZ) { m.ret(11); return; } // ret nz -- gate 2
  m.step(0x2a8f, 5);
  regs.a = mem.read8(0x6398);
  m.step(0x2a92, 13); // ld a,(0x6398)
  regs.cp(0x01);
  m.step(0x2a94, 7); // cp 0x01
  if (regs.fZ) { m.ret(11); return; } // ret z -- gate 3
  m.step(0x2a95, 5);

  regs.a = mem.read8(0x6203);
  m.step(0x2a98, 13); // ld a,(0x6203)
  regs.sub(0x03);
  m.step(0x2a9a, 7); // sub 0x03
  regs.h = regs.a; // H = 0x6203 - 3
  m.step(0x2a9b, 4); // ld h,a
  regs.a = mem.read8(0x6205);
  m.step(0x2a9e, 13); // ld a,(0x6205)
  regs.add(0x0c);
  m.step(0x2aa0, 7); // add a,0x0c
  regs.l = regs.a; // L = 0x6205 + 0x0C
  m.step(0x2aa1, 4); // ld l,a

  m.push16(regs.hl); // push hl -- the probe position
  m.step(0x2aa2, 11);
  m.push16(0x2aa5);
  m.step(0x2ff0, 17);
  m.call(0x2ff0); // HL = pos -> HL = tilemap cell ptr
  regs.de = m.pop16(); // pop de -- saved position
  m.step(0x2aa6, 10);

  regs.a = mem.read8(regs.hl); // the tile
  m.step(0x2aa7, 7); // ld a,(hl)
  regs.cp(0xb0);
  m.step(0x2aa9, 7); // cp 0xb0
  if (regs.fC) {
    // -- jp c,0x2ab4 -- tile < 0xB0: slope cascade (Mario on angled girder) --
    m.step(0x2ab4, 10);
    return m.call(0x2ab4);
  }
  m.step(0x2aac, 10); // jp c not taken
  regs.and(0x0f);
  m.step(0x2aae, 7); // and 0x0f
  regs.cp(0x08);
  m.step(0x2ab0, 7); // cp 0x08
  if (regs.fNC) {
    // -- jp nc,0x2ab4 -- low nibble >= 8: slope cascade (Mario on angled girder) --
    m.step(0x2ab4, 10);
    return m.call(0x2ab4);
  }
  m.step(0x2ab3, 10); // jp nc not taken -> the executing path
  m.ret(); // 0x2AB3
}
