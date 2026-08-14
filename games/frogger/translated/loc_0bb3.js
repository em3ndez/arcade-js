// SPDX-License-Identifier: GPL-3.0-only

// loc_0bb3  (ROM 0x0BB3-0x0C24) — mode-3 board setup: decrement (0x83D8), zero (0x83D7)/(0x83B3), reset
// four-stride RAM at 0x801F, then a 5-pass loop (counter held in the Z80 I register — ld i,a / ld a,i via
// regs.ldAI()) blitting digit strips through rst 0x28; falls into loc_0c17 (a mid-entry loc_0d11 also enters).
export function loc_0bb3(m) {
  const { regs, mem } = m;

  regs.hl = 0x83d8;
  m.step(0x0bb6, 10);
  mem.write8(regs.hl, regs.dec8(mem.read8(regs.hl)));
  m.step(0x0bb7, 11); // (0x83d8)--
  regs.l = regs.dec8(regs.l);
  m.step(0x0bb8, 4); // HL -> 0x83d7
  regs.xor(regs.a);
  m.step(0x0bb9, 4);
  mem.write8(regs.hl, regs.a);
  m.step(0x0bba, 7); // (0x83d7) = 0
  mem.write8(0x83b3, regs.a);
  m.step(0x0bbd, 13); // (0x83b3) = 0

  m.push16(0x0bc0);
  m.step(0x0781, 17); // call 0x0781
  m.call(0x0781);

  regs.a = 0x03;
  m.step(0x0bc2, 7);
  mem.write8(0x8019, regs.a);
  m.step(0x0bc5, 13); // (0x8019) = 3
  regs.hl = 0x801f;
  m.step(0x0bc8, 10);
  regs.b = 0x05;
  m.step(0x0bca, 7);
  regs.xor(regs.a);
  m.step(0x0bcb, 4);

  for (;;) { // loc_0bcb: B passes, zero every 4th cell from 0x801f
    mem.write8(regs.hl, regs.a);
    m.step(0x0bcc, 7);
    regs.l = regs.inc8(regs.l);
    m.step(0x0bcd, 4);
    regs.l = regs.inc8(regs.l);
    m.step(0x0bce, 4);
    regs.l = regs.inc8(regs.l);
    m.step(0x0bcf, 4);
    regs.l = regs.inc8(regs.l);
    m.step(0x0bd0, 4);
    if (regs.djnz() !== 0) {
      m.step(0x0bcb, 13);
      continue;
    }
    m.step(0x0bd2, 8);
    break;
  }

  m.push16(0x0bd5);
  m.step(0x0c3d, 17); // call 0x0c3d
  m.call(0x0c3d);

  regs.hl = 0xaaac;
  m.step(0x0bd8, 10);
  regs.de = 0x2ee5;
  m.step(0x0bdb, 10);
  regs.b = 0x0d;
  m.step(0x0bdd, 7);
  m.push16(0x0bde);
  m.step(0x0028, 11); // rst 0x28 -- blit 0x0d tiles
  m.call(0x0028);

  regs.a = 0x01;
  m.step(0x0be0, 7);

  for (;;) { // loc_0be0: counter A=1..5 preserved in the I register across the A-clobbering blits
    regs.h = 0xaa;
    m.step(0x0be2, 7);
    regs.i = regs.a;
    m.step(0x0be4, 9); // ld i,a
    regs.add(regs.a);
    m.step(0x0be5, 4); // A = A*2
    regs.add(0xcd);
    m.step(0x0be7, 7);
    regs.l = regs.a;
    m.step(0x0be8, 4); // HL = 0xaa(2A+0xcd)
    regs.ldAI();
    m.step(0x0bea, 9); // ld a,i
    m.push16(0x0bed);
    m.step(0x0ba9, 17); // call 0x0ba9
    m.call(0x0ba9);
    regs.ldAI();
    m.step(0x0bef, 9); // ld a,i
    regs.exAf();
    m.step(0x0bf0, 4);
    regs.b = 0x03;
    m.step(0x0bf2, 7);
    m.push16(0x0bf3);
    m.step(0x0028, 11); // rst 0x28 -- blit 0x03 tiles
    m.call(0x0028);
    regs.exx();
    m.step(0x0bf4, 4);
    regs.hl = 0x83ef;
    m.step(0x0bf7, 10);
    regs.exAf();
    m.step(0x0bf8, 4);
    regs.b = regs.a;
    m.step(0x0bf9, 4); // B = restored counter

    for (;;) { // loc_0bf9: advance HL by 2*B
      regs.l = regs.inc8(regs.l);
      m.step(0x0bfa, 4);
      regs.l = regs.inc8(regs.l);
      m.step(0x0bfb, 4);
      if (regs.djnz() !== 0) {
        m.step(0x0bf9, 13);
        continue;
      }
      m.step(0x0bfd, 8);
      break;
    }

    regs.e = mem.read8(regs.hl);
    m.step(0x0bfe, 7);
    regs.l = regs.inc8(regs.l);
    m.step(0x0bff, 4);
    regs.d = mem.read8(regs.hl);
    m.step(0x0c00, 7); // DE = (HL..HL+1)
    regs.h = 0xa9;
    m.step(0x0c02, 7);
    regs.add(regs.a);
    m.step(0x0c03, 4);
    regs.add(0xed);
    m.step(0x0c05, 7);
    regs.l = regs.a;
    m.step(0x0c06, 4); // HL = 0xa9(2A+0xed)
    m.push16(0x0c09);
    m.step(0x0b95, 17); // call 0x0b95
    m.call(0x0b95);
    regs.de = 0x2fba;
    m.step(0x0c0c, 10);
    regs.b = 0x04;
    m.step(0x0c0e, 7);
    m.push16(0x0c0f);
    m.step(0x0028, 11); // rst 0x28 -- blit 0x04 tiles
    m.call(0x0028);
    regs.ldAI();
    m.step(0x0c11, 9); // ld a,i -- restore counter
    regs.exx();
    m.step(0x0c12, 4);
    regs.a = regs.inc8(regs.a);
    m.step(0x0c13, 4); // counter++
    regs.cp(0x06);
    m.step(0x0c15, 7); // Z iff counter == 6
    if (regs.fNZ) {
      m.step(0x0be0, 12);
      continue;
    }
    m.step(0x0c17, 7); // jr nz not taken -- fall through into loc_0c17
    return m.call(0x0c17);
  }
}

// loc_0c17  (ROM 0x0C17-0x0C24) — final strip: zero (0x8039), blit 0x0f tiles from 0x2F4D via rst 0x28,
// return. loc_0d11 jumps here directly (mode-3 already set up), so it is a registered mid-entry.
export function loc_0c17(m) {
  const { regs, mem } = m;

  regs.de = 0x2f4d;
  m.step(0x0c1a, 10);
  regs.hl = 0xaafc;
  m.step(0x0c1d, 10);
  regs.b = 0x0f;
  m.step(0x0c1f, 7);
  regs.xor(regs.a);
  m.step(0x0c20, 4);
  mem.write8(0x8039, regs.a);
  m.step(0x0c23, 13); // (0x8039) = 0
  m.push16(0x0c24);
  m.step(0x0028, 11); // rst 0x28 -- blit 0x0f tiles
  m.call(0x0028);
  m.ret(10);
}
