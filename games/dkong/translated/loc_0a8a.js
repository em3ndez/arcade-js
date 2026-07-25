// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0a8a  (ROM 0x0A8A–0x0ABE) — state setup; seed the two walk pointers.
 */
export function loc_0a8a(m) {
  const { regs, mem } = m;

  regs.xor(regs.a); // A = 0
  m.step(0x0a8b, 4);
  mem.write8(0x7d86, regs.a, 10); // ld (0x7d86),a -- palette latch = 0
  m.step(0x0a8e, 13);
  regs.a = regs.inc8(regs.a); // A = 1
  m.step(0x0a8f, 4);
  mem.write8(0x7d87, regs.a, 10); // ld (0x7d87),a -- palette latch = 1
  m.step(0x0a92, 13);

  regs.de = 0x380d;
  m.step(0x0a95, 10); // ld de,0x380d
  m.push16(0x0a98);
  m.step(0x0da7, 17);
  m.call(0x0da7);

  regs.a = 0x10;
  m.step(0x0a9a, 7); // ld a,0x10
  mem.write8(0x76a3, regs.a, 10); // ld (0x76a3),a
  m.step(0x0a9d, 13);
  mem.write8(0x7663, regs.a, 10); // ld (0x7663),a
  m.step(0x0aa0, 13);
  regs.a = 0xd4;
  m.step(0x0aa2, 7); // ld a,0xd4
  mem.write8(0x75aa, regs.a, 10); // ld (0x75aa),a
  m.step(0x0aa5, 13);
  regs.xor(regs.a); // A = 0
  m.step(0x0aa6, 4);
  mem.write8(0x62af, regs.a); // ld (0x62af),a -- work RAM
  m.step(0x0aa9, 13);

  regs.hl = 0x38b4;
  m.step(0x0aac, 10); // ld hl,0x38b4
  mem.write16(0x63c2, regs.hl); // seed loc_0b06's walk pointer
  m.step(0x0aaf, 16);
  regs.hl = 0x38cb;
  m.step(0x0ab2, 10); // ld hl,0x38cb
  mem.write16(0x63c4, regs.hl); // seed loc_0b68's walk pointer
  m.step(0x0ab5, 16);

  regs.a = 0x40;
  m.step(0x0ab7, 7); // ld a,0x40
  mem.write8(0x6009, regs.a); // arm the countdown to 64
  m.step(0x0aba, 13); // ld (0x6009),a
  regs.hl = 0x6385;
  m.step(0x0abd, 10); // ld hl,0x6385
  regs.incMem8(mem, regs.hl); // inc (hl) -- advance the sequence
  m.step(0x0abe, 11);
  m.ret(); // ret (0x0ABE)
}
