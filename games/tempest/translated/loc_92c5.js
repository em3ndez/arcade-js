// SPDX-License-Identifier: GPL-3.0-only
// loc_92c5  (ROM 0x92c5-0x93df) -- clamps $9f to build $2b, then walks a 0x6f..0x03 (step -4) table at
// $9604+x: for each entry follows ptr ($2c/$2d) through a range search (jsr $9683 advance / $9677 hit)
// and stores the result via ptr ($3b/$3c); finally re-scales $0160/$015b state and seeds many $01xx cells.
// NOTE: (zp),y reads charged 5 T (real NMOS count) -- brief's table listed 4; sta (zp),y = 6.
export function loc_92c5(m) {
  const { regs, mem } = m;

  // build $2b: $9f if <0x62, else reload ($60da & 0x1f) | 0x40; then INC
  regs.a = mem.read8(0x9f); regs.setNZ(regs.a); m.step(0x92c7, 3);
  regs.cmp(0x62); m.step(0x92c9, 2);
  if (regs.fNC) {
    m.step(0x92d2, 3);
  } else {
    m.step(0x92cb, 2);
    regs.a = mem.read8(0x60da); regs.setNZ(regs.a); m.step(0x92ce, 4);
    regs.and(0x1f); m.step(0x92d0, 2);
    regs.ora(0x40); m.step(0x92d2, 2);
  }
  mem.write8(0x2b, regs.a); m.step(0x92d4, 3);
  mem.write8(0x2b, regs.inc8(mem.read8(0x2b))); m.step(0x92d6, 5);
  regs.x = 0x6f; regs.setNZ(regs.x); m.step(0x92d8, 2);
  mem.write8(0x37, regs.x); m.step(0x92da, 3);

  // ----- outer table walk (x = $37, step -4, until $37 wraps to 0xff) -----
  while (true) {
    regs.x = mem.read8(0x37); regs.setNZ(regs.x); m.step(0x92dc, 3);
    regs.a = mem.read8((0x9607 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0x92df, 4);
    mem.write8(0x3c, regs.a); m.step(0x92e1, 3);
    regs.a = mem.read8((0x9606 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0x92e4, 4);
    mem.write8(0x3b, regs.a); m.step(0x92e6, 3);
    regs.a = mem.read8((0x9605 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0x92e9, 4);
    mem.write8(0x2d, regs.a); m.step(0x92eb, 3);
    regs.a = mem.read8((0x9604 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0x92ee, 4);
    mem.write8(0x2c, regs.a); m.step(0x92f0, 3);
    regs.a = 0x01; regs.setNZ(regs.a); m.step(0x92f2, 2);
    mem.write8(0x38, regs.a); m.step(0x92f4, 3);
    regs.y = 0x00; regs.setNZ(regs.y); m.step(0x92f6, 2);

    // ----- inner range search over (($2d<<8)|$2c) -----
    while (true) {
      const ptr2c = mem.read8(0x2c) | (mem.read8(0x2d) << 8);
      regs.a = mem.read8((ptr2c + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0x92f8, 5);
      mem.write8(0x015e, regs.a); m.step(0x92fb, 4);
      if (regs.fZ) { m.step(0x9319, 4); break; }
      m.step(0x92fd, 2);
      regs.a = mem.read8(0x2b); regs.setNZ(regs.a); m.step(0x92ff, 3);
      regs.y = regs.inc8(regs.y); m.step(0x9300, 2);
      regs.cmp(mem.read8((ptr2c + regs.y) & 0xffff)); m.step(0x9302, 5);
      regs.y = regs.inc8(regs.y); m.step(0x9303, 2);
      if (regs.fNC) {
        m.step(0x9313, 3);
      } else {
        m.step(0x9305, 2);
        regs.cmp(mem.read8((ptr2c + regs.y) & 0xffff)); m.step(0x9307, 5);
        if (regs.fNZ) {
          m.step(0x930a, 3);
        } else {
          m.step(0x9309, 2);
          regs.clc(); m.step(0x930a, 2);
        }
        if (regs.fC) {
          m.step(0x9313, 3);
        } else {
          m.step(0x930c, 2);
          regs.y = regs.inc8(regs.y); m.step(0x930d, 2);
          m.push16(0x930f); m.step(0x9310, 6); m.call(0x9677);
          m.step(0x9319, 3); break;
        }
      }
      m.push16(0x9315); m.step(0x9316, 6); m.call(0x9683);
      regs.clc(); m.step(0x9317, 2);
      m.step(0x92f6, 4);
    }

    regs.y = 0x00; regs.setNZ(regs.y); m.step(0x931b, 2);
    { const ptr3b = mem.read8(0x3b) | (mem.read8(0x3c) << 8);
      mem.write8((ptr3b + regs.y) & 0xffff, regs.a); } m.step(0x931d, 6);
    regs.a = mem.read8(0x37); regs.setNZ(regs.a); m.step(0x931f, 3);
    regs.sec(); m.step(0x9320, 2);
    regs.sbc(0x04); m.step(0x9322, 2);
    mem.write8(0x37, regs.a); m.step(0x9324, 3);
    regs.cmp(0xff); m.step(0x9326, 2);
    if (regs.fNZ) { m.step(0x92da, 4); continue; }
    m.step(0x9328, 2); break;
  }

  // dispatch on ($016a & 3): ==1 -> 9331 down-rescale; ==2 -> 934d up-rescale; else (0/3) -> skip to 9382
  regs.a = mem.read8(0x016a); regs.setNZ(regs.a); m.step(0x932b, 4);
  regs.and(0x03); m.step(0x932d, 2);
  regs.cmp(0x01); m.step(0x932f, 2);
  if (regs.fNZ) {
    m.step(0x934d, 3);
    regs.cmp(0x02); m.step(0x934f, 2);
    if (regs.fNZ) {   // &3 != 2 -> BNE $9382 taken, skip the up-rescale
      m.step(0x9382, 3);
    } else {
      m.step(0x9351, 2);
      mem.write8(0x011a, regs.inc8(mem.read8(0x011a))); m.step(0x9354, 6);
      regs.a = mem.read8(0x011a); regs.setNZ(regs.a); m.step(0x9357, 4);
      regs.cmp(0x03); m.step(0x9359, 2);
      if (regs.fNC) {
        m.step(0x9360, 3);
      } else {
        m.step(0x935b, 2);
        regs.a = 0x03; regs.setNZ(regs.a); m.step(0x935d, 2);
        mem.write8(0x011a, regs.a); m.step(0x9360, 4);
      }
      regs.a = mem.read8(0x0160); regs.setNZ(regs.a); m.step(0x9363, 4);
      regs.a = regs.lsr(regs.a); m.step(0x9364, 2);
      regs.a = regs.lsr(regs.a); m.step(0x9365, 2);
      regs.a = regs.lsr(regs.a); m.step(0x9366, 2);
      regs.ora(0xe0); m.step(0x9368, 2);
      regs.adc(mem.read8(0x0160)); m.step(0x936b, 4);
      mem.write8(0x0160, regs.a); m.step(0x936e, 4);
      regs.a = mem.read8(0x015b); regs.setNZ(regs.a); m.step(0x9371, 4);
      regs.a = regs.lsr(regs.a); m.step(0x9372, 2);
      regs.a = regs.lsr(regs.a); m.step(0x9373, 2);
      regs.a = regs.lsr(regs.a); m.step(0x9374, 2);
      regs.adc(mem.read8(0x015b)); m.step(0x9377, 4);
      mem.write8(0x015b, regs.a); m.step(0x937a, 4);
      regs.a = mem.read8(0x016d); regs.setNZ(regs.a); m.step(0x937d, 4);
      regs.ora(0x40); m.step(0x937f, 2);
      mem.write8(0x016d, regs.a); m.step(0x9382, 4);
    }
  } else {
    m.step(0x9331, 2);
    mem.write8(0x011a, regs.dec8(mem.read8(0x011a))); m.step(0x9334, 6);
    regs.a = mem.read8(0x0160); regs.setNZ(regs.a); m.step(0x9337, 4);
    regs.eor(0xff); m.step(0x9339, 2);
    regs.a = regs.lsr(regs.a); m.step(0x933a, 2);
    regs.a = regs.lsr(regs.a); m.step(0x933b, 2);
    regs.a = regs.lsr(regs.a); m.step(0x933c, 2);
    regs.adc(mem.read8(0x0160)); m.step(0x933f, 4);
    mem.write8(0x0160, regs.a); m.step(0x9342, 4);
    regs.a = mem.read8(0x9f); regs.setNZ(regs.a); m.step(0x9344, 3);
    regs.cmp(0x11); m.step(0x9346, 2);
    if (regs.fC) {
      m.step(0x934a, 3);
    } else {
      m.step(0x9348, 2);
      mem.write8(0xb3, regs.dec8(mem.read8(0xb3))); m.step(0x934a, 5);
    }
    regs.clv(); m.step(0x934b, 2);
    m.step(0x9382, 3);
  }

  regs.a = mem.read8(0x0163); regs.setNZ(regs.a); m.step(0x9385, 4);
  m.push16(0x9387); m.step(0x9388, 6); m.call(0x93e0);
  mem.write8(0x0163, regs.a); m.step(0x938b, 4);
  mem.write8(0x0168, regs.y); m.step(0x938e, 4);
  mem.write8(0x0154, regs.x); m.step(0x9391, 4);
  regs.a = mem.read8(0x0120); regs.setNZ(regs.a); m.step(0x9394, 4);
  m.push16(0x9396); m.step(0x9397, 6); m.call(0x93e0);
  mem.write8(0x0120, regs.a); m.step(0x939a, 4);
  mem.write8(0x0118, regs.y); m.step(0x939d, 4);
  mem.write8(0xa7, regs.x); m.step(0x939f, 3);
  regs.a = mem.read8(0x0160); regs.setNZ(regs.a); m.step(0x93a2, 4);
  m.push16(0x93a4); m.step(0x93a5, 6); m.call(0x93e0);
  mem.write8(0x0160, regs.a); m.step(0x93a8, 4);
  mem.write8(0x0162, regs.a); m.step(0x93ab, 4);
  mem.write8(0x0167, regs.y); m.step(0x93ae, 4);
  mem.write8(0x0165, regs.y); m.step(0x93b1, 4);
  mem.write8(0x0151, regs.x); m.step(0x93b4, 4);
  mem.write8(0x0153, regs.x); m.step(0x93b7, 4);
  mem.write8(0x0152, regs.x); m.step(0x93ba, 4);
  regs.a = mem.read8(0x0160); regs.setNZ(regs.a); m.step(0x93bd, 4);
  regs.a = regs.asl(regs.a); m.step(0x93be, 2);
  mem.write8(0x0164, regs.a); m.step(0x93c1, 4);
  regs.a = mem.read8(0x0165); regs.setNZ(regs.a); m.step(0x93c4, 4);
  regs.a = regs.rol(regs.a); m.step(0x93c5, 2);
  mem.write8(0x0169, regs.a); m.step(0x93c8, 4);
  regs.a = 0x06; regs.setNZ(regs.a); m.step(0x93ca, 2);
  mem.write8(0x0155, regs.a); m.step(0x93cd, 4);
  regs.a = 0xa0; regs.setNZ(regs.a); m.step(0x93cf, 2);
  mem.write8(0x0161, regs.a); m.step(0x93d2, 4);
  regs.a = 0xfe; regs.setNZ(regs.a); m.step(0x93d4, 2);
  mem.write8(0x0166, regs.a); m.step(0x93d7, 4);
  regs.a = 0x01; regs.setNZ(regs.a); m.step(0x93d9, 2);
  mem.write8(0x014a, regs.a); m.step(0x93dc, 4);
  mem.write8(0x0149, regs.a); m.step(0x93df, 4);
  return m.ret(6);
}
