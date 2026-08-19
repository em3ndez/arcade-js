// SPDX-License-Identifier: GPL-3.0-only
//
// loc_2527  (ROM 0x2527-0x2561) -- board/HUD reset. Enqueues a display command (rst 0x38, D=0x08),
// then when the 0x8902 counter has reached 0x07 it reseeds two flags (0x8902/0x8934=0x04, A from
// 0x89fb) and clears 0x20 bytes at 0x8920 (rst 0x10). Always clears three more RAM blocks (0x4f
// bytes at 0x8f00, 4 at 0x8f57, 3 at 0x8d30) and mirrors A into five actor/HUD bytes.
// rst 0x38 (loc_0038) and rst 0x10 (loc_0010) are pattern A. Reached from 0x15ec/0x1a01/0x1a6d.
export function loc_2527(m) {
  const { regs, mem } = m;

  regs.d = 0x08; m.step(0x2529, 7);
  m.push16(0x252a); m.step(0x0038, 11); m.call(0x0038);
  regs.hl = 0x8902; m.step(0x252d, 10);
  regs.a = mem.read8(regs.hl); m.step(0x252e, 7); // 252d  ld a,(hl)
  regs.cp(0x07); m.step(0x2530, 7);
  regs.a = 0x00; m.step(0x2532, 7);
  if (regs.fC) {
    m.step(0x2541, 12);
  } else {
    m.step(0x2534, 7);
    regs.a = mem.read8(0x89fb); m.step(0x2537, 13); // 2534  ld a,(0x89fb)
    mem.write8(regs.hl, 0x04); m.step(0x2539, 10); // 2537  ld (hl),0x04
    regs.l = 0x34; m.step(0x253b, 7); // 2539  ld l,0x34 -> 0x8934
    mem.write8(regs.hl, 0x04); m.step(0x253d, 10); // 253b  ld (hl),0x04
    regs.b = 0x20; m.step(0x253f, 7);
    regs.l = regs.b; m.step(0x2540, 4); // 253f  ld l,b -> 0x8920
    m.push16(0x2541); m.step(0x0010, 11); m.call(0x0010); // 2540  rst 0x10 (fill 0x20 = A)
  }
  regs.hl = 0x8f00; m.step(0x2544, 10);
  regs.b = 0x4f; m.step(0x2546, 7);
  m.push16(0x2547); m.step(0x0010, 11); m.call(0x0010);
  regs.l = 0x57; m.step(0x2549, 7); // 2547  ld l,0x57 -> 0x8f57
  regs.b = 0x04; m.step(0x254b, 7);
  m.push16(0x254c); m.step(0x0010, 11); m.call(0x0010);
  regs.hl = 0x8d30; m.step(0x254f, 10);
  regs.b = 0x03; m.step(0x2551, 7);
  m.push16(0x2552); m.step(0x0010, 11); m.call(0x0010);
  mem.write8(0x8a82, regs.a); m.step(0x2555, 13); // 2552  ld (0x8a82),a
  mem.write8(0x8c90, regs.a); m.step(0x2558, 13); // 2555  ld (0x8c90),a
  mem.write8(0x8ca8, regs.a); m.step(0x255b, 13); // 2558  ld (0x8ca8),a
  mem.write8(0x8f52, regs.a); m.step(0x255e, 13); // 255b  ld (0x8f52),a
  mem.write8(0x8f63, regs.a); m.step(0x2561, 13); // 255e  ld (0x8f63),a
  m.ret();
}
