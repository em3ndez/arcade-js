// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0a37  (ROM 0x0A37–0x0A62) — enqueue 4 tasks, advance 0x600A, seed video.
 */
export function loc_0a37(m) {
  const { regs, mem } = m;

  regs.de = 0x0304;
  m.step(0x0a3a, 10); // ld de,0x0304
  m.push16(0x0a3d);
  m.step(0x309f, 17); // call 0x309f
  m.call(0x309f);
  regs.de = 0x0202;
  m.step(0x0a40, 10); // ld de,0x0202
  m.push16(0x0a43);
  m.step(0x309f, 17); // call 0x309f
  m.call(0x309f);
  regs.de = 0x0200;
  m.step(0x0a46, 10); // ld de,0x0200
  m.push16(0x0a49);
  m.step(0x309f, 17); // call 0x309f
  m.call(0x309f);
  regs.de = 0x0600;
  m.step(0x0a4c, 10); // ld de,0x0600
  m.push16(0x0a4f);
  m.step(0x309f, 17); // call 0x309f
  m.call(0x309f);

  regs.hl = 0x600a;
  m.step(0x0a52, 10); // ld hl,0x600a
  regs.incMem8(mem, regs.hl); // inc (hl) -- advance the 0x600A selector
  m.step(0x0a53, 11);

  regs.a = 0x01;
  m.step(0x0a55, 7); // ld a,0x01
  mem.write8(0x7740, regs.a, 10); // ld (0x7740),a
  m.step(0x0a58, 13);
  regs.a = 0x25;
  m.step(0x0a5a, 7); // ld a,0x25
  mem.write8(0x7720, regs.a, 10); // ld (0x7720),a
  m.step(0x0a5d, 13);
  regs.a = 0x20;
  m.step(0x0a5f, 7); // ld a,0x20
  mem.write8(0x7700, regs.a, 10); // ld (0x7700),a
  m.step(0x0a62, 13);
  m.ret(); // ret (0x0A62)
}
