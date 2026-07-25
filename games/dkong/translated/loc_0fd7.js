// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0fd7  (ROM 0x0FD7–0x101A) — rst 0x28 table entry 1.
 *
 *   0fd7  21 dc 3d     ld   hl,0x3ddc
 *   0fda  11 a8 69     ld   de,0x69a8
 *   0fdd  01 10 00     ld   bc,0x0010
 *   0fe0  ed b0        ldir
 *   0fe2  21 ec 3d     ld   hl,0x3dec
 *   0fe5  11 07 64     ld   de,0x6407
 *   0fe8  0e 1c        ld   c,0x1c
 *   0fea  06 05        ld   b,0x05
 *   0fec  cd 2a 12     call 0x122a
 *   ... four more helper calls, then `ret` at 0x101A
 *
 * THIS IS WHERE SPRITES COME FROM. The destinations include 0x69A8 and
 * 0x69FC, which are inside 0x6900-0x6A7F -- the sprite buffer the i8257
 * blits to 0x7000 every vblank. sub_0874 clears exactly that range at boot;
 * this is the routine that fills it.
 *
 * NOTE the source at 0x1006 is `ld hl,0x101b` -- four bytes of DATA
 * (00 00 02 02) sitting immediately after this routine's `ret`, which is why
 * 0x101B-0x101E shows as UNREACHED in the coverage map. It is data, not
 * unexercised code, and the same shape as the 9 bytes before handler_01c3.
 */
export function loc_0fd7(m) {
  const { regs } = m;

  regs.hl = 0x3ddc;
  m.step(0x0fda, 10);
  regs.de = 0x69a8; // INSIDE the sprite buffer
  m.step(0x0fdd, 10);
  regs.bc = 0x0010;
  m.step(0x0fe0, 10);
  m.ldirAt(0x0fe0, 0x0fe2);

  regs.hl = 0x3dec;
  m.step(0x0fe5, 10);
  regs.de = 0x6407;
  m.step(0x0fe8, 10);
  regs.c = 0x1c;
  m.step(0x0fea, 7);
  regs.b = 0x05;
  m.step(0x0fec, 7);

  m.push16(0x0fef);
  m.step(0x122a, 17);
  m.call(0x122a);

  // HL here is a LIVE-IN PARAMETER to sub_11fa (0x3DF4), not a value sub_11fa
  // sets. sub_122a has left C = 0x1C and HL = 0x3DEC, both dead across this.
  regs.hl = 0x3df4;
  m.step(0x0ff2, 10);
  m.push16(0x0ff5);
  m.step(0x11fa, 17);
  m.call(0x11fa);

  regs.hl = 0x3e00;
  m.step(0x0ff8, 10);
  regs.de = 0x69fc; // INSIDE the sprite buffer, like the 0x69A8 above
  m.step(0x0ffb, 10);
  regs.bc = 0x0004;
  m.step(0x0ffe, 10);
  m.ldirAt(0x0ffe, 0x1000);

  // HL is a LIVE-IN PARAMETER of sub_11a6, which passes it straight through to
  // sub_11ec without ever setting it. All three of sub_11a6's call sites supply
  // it -- 0x3E0C here, 0x3E10 at 0x1073, 0x3E14 at 0x1140, stride 4.
  regs.hl = 0x3e0c;
  m.step(0x1003, 10);
  m.push16(0x1006);
  m.step(0x11a6, 17);
  m.call(0x11a6);

  // 0x101B is the four DATA bytes (00 00 02 02) after this routine's `ret`.
  regs.hl = 0x101b;
  m.step(0x1009, 10);
  regs.de = 0x6707;
  m.step(0x100c, 10);
  regs.bc = 0x081c; // B = 8 passes, C = 0x1C stride
  m.step(0x100f, 10);
  m.push16(0x1012);
  m.step(0x122a, 17);
  m.call(0x122a);

  // Reloads DE and B ONLY -- not HL, not C. This is the site that proves
  // sub_122a preserves both; see the note on sub_122a.
  regs.de = 0x6807;
  m.step(0x1015, 10);
  regs.b = 0x02;
  m.step(0x1017, 7);
  m.push16(0x101a);
  m.step(0x122a, 17);
  m.call(0x122a);

  m.ret(); // 101a
}
