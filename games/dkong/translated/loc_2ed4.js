// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2ed4  (ROM 0x2ED4–0x2FCA) — two-object sprite-state updater.
 * rst 0x30 / rst 0x10 skip gates (A=0x0b). Object select by (ix+1) bit0: IX=0x6680/DE=0x6A18
 * or IX=0x6690/DE=0x6A1C. (0x6217) bit0 chooses the build path (loc_2f43 chain) vs loc_2f97.
 * All paths converge on loc_2f7c, which writes the 4-byte record x/B/C/y through DE->HL and
 * mirrors x/y to (ix+3)/(ix+5). NO LOOP (the four jp 0x2f7c are backward but loc_2f7c rets).
 * Uses sla / set n,r / neg.
 */
export function loc_2ed4(m) {
  const { regs, mem } = m;
  regs.a = 0x0b;
  m.step(0x2ed6, 7); // ld a,0x0b
  m.push16(0x2ed7); m.step(0x0030, 11); // rst 0x30
  if (!m.call(0x0030)) return; // skip gate
  m.push16(0x2ed8); m.step(0x0010, 11); // rst 0x10
  if (!m.call(0x0010)) return; // skip gate
  regs.de = 0x6a18;
  m.step(0x2edb, 10); // ld de,0x6a18
  regs.ix = 0x6680;
  m.step(0x2edf, 14); // ld ix,0x6680
  regs.a = mem.read8((regs.ix + 0x01) & 0xffff);
  m.step(0x2ee2, 19); // ld a,(ix+0x01)
  regs.rrca();
  m.step(0x2ee3, 4); // rrca
  if (regs.fC) {
    m.step(0x2eed, 10); // jp c,0x2eed (bit0 set -> keep defaults)
  } else {
    m.step(0x2ee6, 10);
    regs.de = 0x6a1c;
    m.step(0x2ee9, 10); // ld de,0x6a1c
    regs.ix = 0x6690;
    m.step(0x2eed, 14); // ld ix,0x6690
  }
  // -- loc_2eed --
  const R = (d) => (regs.ix + d) & 0xffff;
  mem.write8(R(0x0e), 0x00);
  m.step(0x2ef1, 19); // ld (ix+0x0e),0x00
  mem.write8(R(0x0f), 0xf0);
  m.step(0x2ef5, 19); // ld (ix+0x0f),0xf0
  regs.a = mem.read8(0x6217);
  m.step(0x2ef8, 13); // ld a,(0x6217)
  regs.rrca();
  m.step(0x2ef9, 4); // rrca
  if (regs.fNC) { m.step(0x2f97, 10); return m.call(0x2f97); } // jp nc,0x2f97
  m.step(0x2efc, 10);

  // -- (0x6217) bit0 set: build sprite attributes B/C --
  regs.xor(regs.a);
  m.step(0x2efd, 4); // xor a
  mem.write8(0x6218, regs.a);
  m.step(0x2f00, 13); // ld (0x6218),a
  regs.hl = 0x6089;
  m.step(0x2f03, 10); // ld hl,0x6089
  mem.write8(regs.hl, 0x04);
  m.step(0x2f05, 10); // ld (hl),0x04
  mem.write8(R(0x09), 0x06);
  m.step(0x2f09, 19); // ld (ix+0x09),0x06
  mem.write8(R(0x0a), 0x03);
  m.step(0x2f0d, 19); // ld (ix+0x0a),0x03
  regs.b = 0x1e;
  m.step(0x2f0f, 7); // ld b,0x1e
  regs.a = mem.read8(0x6207);
  m.step(0x2f12, 13); // ld a,(0x6207)
  regs.a = regs.sla(regs.a);
  m.step(0x2f14, 8); // sla a
  if (regs.fNC) {
    m.step(0x2f1b, 10); // jp nc,0x2f1b
  } else {
    m.step(0x2f17, 10);
    regs.or(0x80);
    m.step(0x2f19, 7); // or 0x80
    regs.b = regs.set(7, regs.b);
    m.step(0x2f1b, 8); // set 7,b
  }
  // -- loc_2f1b --
  regs.or(0x08);
  m.step(0x2f1d, 7); // or 0x08
  regs.c = regs.a;
  m.step(0x2f1e, 4); // ld c,a
  regs.a = mem.read8(0x6394);
  m.step(0x2f21, 13); // ld a,(0x6394)
  regs.bit(3, regs.a);
  m.step(0x2f23, 8); // bit 3,a
  if (regs.fZ) { m.step(0x2f43, 10); return m.call(0x2f43); } // jp z,0x2f43
  m.step(0x2f26, 10);
  regs.b = regs.set(0, regs.b);
  m.step(0x2f28, 8); // set 0,b
  regs.c = regs.set(0, regs.c);
  m.step(0x2f2a, 8); // set 0,c
  mem.write8(R(0x09), 0x05);
  m.step(0x2f2e, 19); // ld (ix+0x09),0x05
  mem.write8(R(0x0a), 0x06);
  m.step(0x2f32, 19); // ld (ix+0x0a),0x06
  mem.write8(R(0x0f), 0x00);
  m.step(0x2f36, 19); // ld (ix+0x0f),0x00
  mem.write8(R(0x0e), 0xf0);
  m.step(0x2f3a, 19); // ld (ix+0x0e),0xf0
  regs.bit(7, regs.c);
  m.step(0x2f3c, 8); // bit 7,c
  if (regs.fZ) { m.step(0x2f43, 10); return m.call(0x2f43); } // jp z,0x2f43
  m.step(0x2f3f, 10);
  mem.write8(R(0x0e), 0x10);
  m.step(0x2f43, 19); // ld (ix+0x0e),0x10 -- falls into loc_2f43
  return m.call(0x2f43);
}
