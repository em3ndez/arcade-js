// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0c92  (ROM 0x0C92–0x0CB8) — reached only by tail jump from 0x0763.
 *
 *   0c92  cd 74 08     call 0x0874
 *   0c95  af           xor  a
 *   0c96  32 8c 63     ld   (0x638c),a
 *   0c99  11 01 05     ld   de,0x0501
 *   0c9c  cd 9f 30     call 0x309f
 *   0c9f  21 86 7d     ld   hl,0x7d86
 *   0ca2  36 00        ld   (hl),0x00
 *   0ca4  23           inc  hl
 *   0ca5  36 01        ld   (hl),0x01
 *   0ca7  3a 27 62     ld   a,(0x6227)
 *   0caa  3d           dec  a
 *   0cab  ca d4 0c     jp   z,0x0cd4
 *   0cae  3d           dec  a
 *   0caf  ca df 0c     jp   z,0x0cdf
 *   0cb2  3d           dec  a
 *   0cb3  ca f2 0c     jp   z,0x0cf2
 *   0cb6  cd 43 0d     call 0x0d43
 *
 * THE FIRST WRITE OF 0x7D87 = 1 IN THE WHOLE RUN. The two palette-bank bits
 * are walked with `inc hl` again (0x7D86 then 0x7D87), and this sets bit 1
 * while clearing bit 0 -- so the palette bank becomes 2, having been 0 for
 * every frame up to here. The latch audit showed 0x7D87 as never varying
 * on the short capture and varying on the long one; this is the site.
 *
 * A CASCADE OF `dec a / jp z`, not a jump table: A is 0x6227 and each `dec`
 * tests the next value in turn, so the arms are 1, 2, 3, and fall-through.
 * handler_0763 sets 0x6227 = 1 immediately before tail-jumping here, so ONLY
 * THE FIRST ARM IS EXERCISED on this path. The other three are left
 * untranslated deliberately -- translating them would be unexercised code
 * written to spec, which is what coverage-as-to-do-list exists to prevent.
 */
export function loc_0c92(m) {
  const { regs, mem } = m;

  m.push16(0x0c95);
  m.step(0x0874, 17);
  m.call(0x0874);

  regs.xor(regs.a);
  m.step(0x0c96, 4);
  mem.write8(0x638c, regs.a);
  m.step(0x0c99, 13);
  regs.de = 0x0501;
  m.step(0x0c9c, 10);

  m.push16(0x0c9f);
  m.step(0x309f, 17);
  m.call(0x309f);

  regs.hl = 0x7d86;
  m.step(0x0ca2, 10);
  mem.write8(regs.hl, 0x00, 7); // ld (hl),n -- bus cycle at +7
  m.step(0x0ca4, 10);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0ca5, 6);
  mem.write8(regs.hl, 0x01, 7); // 0x7D87 = 1 -- palette bank bit 1
  m.step(0x0ca7, 10);

  regs.a = mem.read8(0x6227);
  m.step(0x0caa, 13);
  regs.a = regs.dec8(regs.a);
  m.step(0x0cab, 4);
  if (regs.fZ) {
    m.step(0x0cd4, 10); // jp z taken -- the only arm this path reaches
    return m.call(0x0cd4);
  }
  m.step(0x0cae, 10); // jp z,0x0cd4 NOT taken (board 1)

  regs.a = regs.dec8(regs.a);
  m.step(0x0caf, 4); // dec a (board 2 check)
  if (regs.fZ) {
    m.step(0x0cdf, 10); // jp z,0x0cdf taken -- board 2 (50m conveyor)
    return m.call(0x0cdf);
  }
  m.step(0x0cb2, 10); // jp z,0x0cdf NOT taken

  regs.a = regs.dec8(regs.a);
  m.step(0x0cb3, 4); // dec a (board 3 check)
  if (regs.fZ) {
    m.step(0x0cf2, 10); // jp z,0x0cf2 taken -- board 3 (75m elevator)
    return m.call(0x0cf2);
  }
  m.step(0x0cb6, 10); // jp z,0x0cf2 NOT taken -- board 4 (0x6227==4, 100m rivet)

  // loc_0cb6 (0x0CB6-0x0CC5): board-4 rivet setup, FALLS INTO loc_0cc6 (no jp/ret).
  // Reachable -- 100m rivet is level-1's 2nd board (seq 0x3A73 has id 04).
  m.push16(0x0cb9);
  m.step(0x0d43, 17); // call 0x0d43 -- sprite-row clear
  m.call(0x0d43);
  regs.hl = 0x7d86;
  m.step(0x0cbc, 10); // ld hl,0x7d86
  mem.write8(regs.hl, 0x01, 7);
  m.step(0x0cbe, 10); // ld (hl),0x01 -- (0x7D86)=1
  regs.a = 0x0b;
  m.step(0x0cc0, 7); // ld a,0x0b
  mem.write8(0x6089, regs.a);
  m.step(0x0cc3, 13); // ld (0x6089),a -- rivet board mode 0x0B
  regs.de = 0x3c8b;
  m.step(0x0cc6, 10); // ld de,0x3c8b -- rivet layout ptr (live-out); FALL INTO loc_0cc6
  return m.call(0x0cc6);
}
