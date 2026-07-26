// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_3ba8  (ROM 0x3ba8-0x3bea) — paints a fixed screen, then SPINS FOREVER
 * displaying it. Selects a mode via 0x4bff (A=0x01), copies a 0x400-byte tilemap
 * from ROM 0x4232 into video RAM (0x9000), floods the whole colour map
 * (0x8800-0x8BFF, 0x400 bytes) with attribute 0x02, draws three colour column
 * strips via 0x3e1d ((A=start-offset,C=attribute) = (0x12,0x07)/(0x16,0x04)/
 * (0x1a,0x06); each writes a 28-tile vertical strip at 0x8840+A, stride 0x20),
 * and calls 0x3d49 to finish setup. It then falls into loc_3bdf, an UNCONDITIONAL
 * infinite loop (`jr 0x3bdf`) that repeatedly calls 0x3d7e / 0x4bff(A=0x0f) /
 * 0x4b55 — it NEVER returns. Contrast loc_3b81, whose near-identical prologue
 * ends by tail-jumping into 0x4bff.
 *
 *   3ba8  3e 01        ld   a,0x01
 *   3baa  cd ff 4b     call 0x4bff
 *   3bad  11 00 90     ld   de,0x9000
 *   3bb0  21 32 42     ld   hl,0x4232
 *   3bb3  01 00 04     ld   bc,0x0400
 *   3bb6  ed b0        ldir
 *   3bb8  11 00 88     ld   de,0x8800
 *   3bbb  3e 02        ld   a,0x02
 *   3bbd  01 04 00     ld   bc,0x0004
 * loc_3bc0:
 *   3bc0  12           ld   (de),a
 *   3bc1  13           inc  de
 *   3bc2  10 fc        djnz 0x3bc0
 *   3bc4  0d           dec  c
 *   3bc5  20 f9        jr   nz,0x3bc0
 *   3bc7  0e 07        ld   c,0x07
 *   3bc9  3e 12        ld   a,0x12
 *   3bcb  cd 1d 3e     call 0x3e1d
 *   3bce  0e 04        ld   c,0x04
 *   3bd0  3e 16        ld   a,0x16
 *   3bd2  cd 1d 3e     call 0x3e1d
 *   3bd5  0e 06        ld   c,0x06
 *   3bd7  3e 1a        ld   a,0x1a
 *   3bd9  cd 1d 3e     call 0x3e1d
 *   3bdc  cd 49 3d     call 0x3d49
 * loc_3bdf:
 *   3bdf  cd 7e 3d     call 0x3d7e
 *   3be2  3e 0f        ld   a,0x0f
 *   3be4  cd ff 4b     call 0x4bff
 *   3be7  cd 55 4b     call 0x4b55
 *   3bea  18 f3        jr   0x3bdf
 *
 * The colour flood is a nested count: bc=0x0004 loads B=0x00, so each `djnz`
 * pass writes 256 bytes (0x00 -> 0xFF -> ... -> 0x00), and C=0x04 outer passes
 * make 0x400 = 1024 bytes total (0x8800-0x8BFF). `djnz` touches no flags; the
 * outer `jr nz` reads `dec c`'s Z. The trailing `jr 0x3bdf` is UNCONDITIONAL, so
 * loc_3bdf is a genuine infinite loop — modelled as `for (;;)` with no exit, like
 * the DK main loop; the only escape on hardware is the NMI/watchdog reset.
 */
export function loc_3ba8(m) {
  const { regs, mem } = m;

  regs.a = 0x01;
  m.step(0x3baa, 7); // 3ba8  ld a,0x01

  m.push16(0x3bad);
  m.step(0x4bff, 17); // 3baa  call 0x4bff
  m.call(0x4bff);

  regs.de = 0x9000;
  m.step(0x3bb0, 10); // 3bad  ld de,0x9000

  regs.hl = 0x4232;
  m.step(0x3bb3, 10); // 3bb0  ld hl,0x4232

  regs.bc = 0x0400;
  m.step(0x3bb6, 10); // 3bb3  ld bc,0x0400

  m.ldirAt(0x3bb6, 0x3bb8); // 3bb6  ldir -- copy 0x400 bytes of tilemap to video RAM

  regs.de = 0x8800;
  m.step(0x3bbb, 10); // 3bb8  ld de,0x8800

  regs.a = 0x02;
  m.step(0x3bbd, 7); // 3bbb  ld a,0x02

  regs.bc = 0x0004;
  m.step(0x3bc0, 10); // 3bbd  ld bc,0x0004

  // loc_3bc0: flood colour RAM 0x8800-0x8BFF with 0x02 -- 4 outer passes of 256 bytes.
  for (;;) {
    for (;;) {
      mem.write8(regs.de, regs.a); // 3bc0  ld (de),a
      m.step(0x3bc1, 7);

      regs.de = (regs.de + 1) & 0xffff; // 3bc1  inc de
      m.step(0x3bc2, 6);

      // 3bc2  djnz 0x3bc0 -- decrement B (no flags), loop while non-zero
      if (regs.djnz() !== 0) {
        m.step(0x3bc0, 13); // djnz taken
      } else {
        m.step(0x3bc4, 8); // djnz not taken -> fall through
        break;
      }
    }

    regs.c = regs.dec8(regs.c); // 3bc4  dec c
    m.step(0x3bc5, 4);

    // 3bc5  jr nz,0x3bc0 -- another 256-byte pass while C != 0
    if (regs.fNZ) {
      m.step(0x3bc0, 12); // jr nz taken
    } else {
      m.step(0x3bc7, 7); // jr nz not taken
      break;
    }
  }

  regs.c = 0x07;
  m.step(0x3bc9, 7); // 3bc7  ld c,0x07

  regs.a = 0x12;
  m.step(0x3bcb, 7); // 3bc9  ld a,0x12

  m.push16(0x3bce);
  m.step(0x3e1d, 17); // 3bcb  call 0x3e1d -- colour strip at 0x8840+0x12, attr 0x07
  m.call(0x3e1d);

  regs.c = 0x04;
  m.step(0x3bd0, 7); // 3bce  ld c,0x04

  regs.a = 0x16;
  m.step(0x3bd2, 7); // 3bd0  ld a,0x16

  m.push16(0x3bd5);
  m.step(0x3e1d, 17); // 3bd2  call 0x3e1d -- colour strip at 0x8840+0x16, attr 0x04
  m.call(0x3e1d);

  regs.c = 0x06;
  m.step(0x3bd7, 7); // 3bd5  ld c,0x06

  regs.a = 0x1a;
  m.step(0x3bd9, 7); // 3bd7  ld a,0x1a

  m.push16(0x3bdc);
  m.step(0x3e1d, 17); // 3bd9  call 0x3e1d -- colour strip at 0x8840+0x1a, attr 0x06
  m.call(0x3e1d);

  m.push16(0x3bdf);
  m.step(0x3d49, 17); // 3bdc  call 0x3d49 -- finish screen setup
  m.call(0x3d49);

  // loc_3bdf: display loop. `jr 0x3bdf` at 0x3bea is UNCONDITIONAL, so this
  // runs forever and the routine NEVER returns.
  for (;;) {
    m.push16(0x3be2);
    m.step(0x3d7e, 17); // 3bdf  call 0x3d7e
    m.call(0x3d7e);

    regs.a = 0x0f;
    m.step(0x3be4, 7); // 3be2  ld a,0x0f

    m.push16(0x3be7);
    m.step(0x4bff, 17); // 3be4  call 0x4bff
    m.call(0x4bff);

    m.push16(0x3bea);
    m.step(0x4b55, 17); // 3be7  call 0x4b55
    m.call(0x4b55);

    m.step(0x3bdf, 12); // 3bea  jr 0x3bdf -- unconditional, back to loc_3bdf
  }
}
