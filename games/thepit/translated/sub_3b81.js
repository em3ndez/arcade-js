// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_3b81  (ROM 0x3b81-0x3ba7) — paints a fixed screen: copies a 0x400-byte
 * tilemap from ROM 0x3e32 into video RAM (0x9000), floods the whole colour map
 * (0x8800, 0x400 bytes) with attribute 0x93, and brackets the work with the
 * 0x4b44 / 0x4bff setup calls (A selects the bank/mode 0x4bff acts on). Ends by
 * TAIL-jumping into 0x4bff with A=0xA0 — 0x4bff's own `ret` returns to OUR caller.
 *
 *   3b81  cd 44 4b     call 0x4b44
 *   3b84  3e 01        ld   a,0x01
 *   3b86  cd ff 4b     call 0x4bff
 *   3b89  11 00 90     ld   de,0x9000
 *   3b8c  21 32 3e     ld   hl,0x3e32
 *   3b8f  01 00 04     ld   bc,0x0400
 *   3b92  ed b0        ldir
 *   3b94  11 00 88     ld   de,0x8800
 *   3b97  3e 93        ld   a,0x93
 *   3b99  01 04 00     ld   bc,0x0004
 * loc_3b9c:
 *   3b9c  12           ld   (de),a
 *   3b9d  13           inc  de
 *   3b9e  10 fc        djnz 0x3b9c
 *   3ba0  0d           dec  c
 *   3ba1  20 f9        jr   nz,0x3b9c
 *   3ba3  3e a0        ld   a,0xa0
 *   3ba5  c3 ff 4b     jp   0x4bff
 *
 * The colour flood is a nested count: B is loaded 0x00 (high byte of bc=0x0004),
 * so each `djnz` pass writes 256 bytes (0x00 -> 0xFF -> ... -> 0x00), and C=0x04
 * outer passes make 0x400 = 1024 bytes total (0x8800-0x8BFF). `djnz` touches no
 * flags; the outer `jr nz` reads `dec c`'s Z. The `jp 0x4bff` is a tail-jump
 * (pushes nothing), so it is `m.step(target,10); return m.call(target)`, NOT the
 * `m.call; m.ret()` shape — that would push a spurious word and charge a second ret.
 */
export function sub_3b81(m) {
  const { regs, mem } = m;

  m.push16(0x3b84);
  m.step(0x4b44, 17); // 3b81  call 0x4b44
  m.call(0x4b44);

  regs.a = 0x01;
  m.step(0x3b86, 7); // 3b84  ld a,0x01

  m.push16(0x3b89);
  m.step(0x4bff, 17); // 3b86  call 0x4bff
  m.call(0x4bff);

  regs.de = 0x9000;
  m.step(0x3b8c, 10); // 3b89  ld de,0x9000

  regs.hl = 0x3e32;
  m.step(0x3b8f, 10); // 3b8c  ld hl,0x3e32

  regs.bc = 0x0400;
  m.step(0x3b92, 10); // 3b8f  ld bc,0x0400

  m.ldirAt(0x3b92, 0x3b94); // 3b92  ldir -- copy 0x400 bytes to video RAM

  regs.de = 0x8800;
  m.step(0x3b97, 10); // 3b94  ld de,0x8800

  regs.a = 0x93;
  m.step(0x3b99, 7); // 3b97  ld a,0x93

  regs.bc = 0x0004;
  m.step(0x3b9c, 10); // 3b99  ld bc,0x0004

  // loc_3b9c: flood colour RAM 0x8800 with 0x93 -- 4 outer passes of 256 bytes.
  for (;;) {
    for (;;) {
      mem.write8(regs.de, regs.a); // 3b9c  ld (de),a
      m.step(0x3b9d, 7);

      regs.de = (regs.de + 1) & 0xffff; // 3b9d  inc de
      m.step(0x3b9e, 6);

      // 3b9e  djnz 0x3b9c -- decrement B (no flags), loop while non-zero
      if (regs.djnz() !== 0) {
        m.step(0x3b9c, 13); // djnz taken
      } else {
        m.step(0x3ba0, 8); // djnz not taken -> fall through
        break;
      }
    }

    regs.c = regs.dec8(regs.c); // 3ba0  dec c
    m.step(0x3ba1, 4);

    // 3ba1  jr nz,0x3b9c -- another 256-byte pass while C != 0
    if (regs.fNZ) {
      m.step(0x3b9c, 12); // jr nz taken
    } else {
      m.step(0x3ba3, 7); // jr nz not taken
      break;
    }
  }

  regs.a = 0xa0;
  m.step(0x3ba5, 7); // 3ba3  ld a,0xa0

  // 3ba5  jp 0x4bff -- tail-jump (pushes nothing; 0x4bff's ret returns to OUR caller)
  m.step(0x4bff, 10);
  return m.call(0x4bff);
}
