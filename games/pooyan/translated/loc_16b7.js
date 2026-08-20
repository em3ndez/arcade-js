// SPDX-License-Identifier: GPL-3.0-only

// loc_16b7  (ROM 0x16b7-0x174b) -- idx1 state handler. Decrements the phase timer at 0x8808 and
// returns until it expires; then runs the per-phase setup (loc_02e3 + loc_1dd3), and selects a
// (HL=graphic, DE=layout) pair from a decision tree keyed on 0x8f50 / 0x8904 / 0x8806 / 0x8907.
// The chosen pair is stored to 0x88ba/0x8f45, fixed pointers seeded (0x88b8/0x8f43/0x8d07), the
// sub-state at 0x880a bumped, a display command (DE=0x0683) enqueued via rst 0x38 (loc_0038), and
// loc_1694 tail-invoked. loc_0038/loc_02e3/loc_03c2 preserve nothing this routine needs afterward
// (every register is reloaded), so their clobbers are irrelevant here.
export function loc_16b7(m) {
  const { regs, mem } = m;

  regs.hl = 0x8808;                  m.step(0x16ba, 10);
  regs.decMem8(mem, regs.hl);        m.step(0x16bb, 11); // dec (0x8808) -- phase timer
  if (regs.fNZ) { return m.ret(11); } // ret nz -- timer still running
  m.step(0x16bc, 5);

  m.push16(0x16bf);
  m.step(0x02e3, 17);                // 16bc  call 0x02e3
  m.call(0x02e3);
  m.push16(0x16c2);
  m.step(0x1dd3, 17);                // 16bf  call 0x1dd3
  m.call(0x1dd3);

  regs.a = mem.read8(0x8f50);        m.step(0x16c5, 13);
  regs.and(0x01);                    m.step(0x16c7, 7);
  if (regs.fNZ) {
    m.step(0x16c9, 7);               // jr z not taken -- attract/other: force sub-state 0x10
    regs.a = 0x10;                   m.step(0x16cb, 7);
    mem.write8(0x880a, regs.a);      m.step(0x16ce, 13);
    return m.ret(10);
  }
  m.step(0x16cf, 12);                // 16c7  jr z,0x16cf

  regs.xor(regs.a);                  m.step(0x16d0, 4);
  mem.write8(0x88b7, regs.a);        m.step(0x16d3, 13);
  m.push16(0x16d6);
  m.step(0x03c2, 17);                // 16d3  call 0x03c2
  m.call(0x03c2);
  regs.a = mem.read8(0x8f50);        m.step(0x16d9, 13);
  regs.and(regs.a);                  m.step(0x16da, 4);

  // Decision tree -> (HL=graphic ptr, DE=layout ptr), converging at 0x1728.
  block1728: {
    block1715: {
      if (regs.fZ) {
        m.step(0x16f3, 12);          // 16da  jr z,0x16f3
        regs.a = mem.read8(0x8904);  m.step(0x16f6, 13);
        regs.and(regs.a);            m.step(0x16f7, 4);
        if (regs.fNZ) { m.step(0x1715, 12); break block1715; } // jr nz,0x1715
        m.step(0x16f9, 7);
        regs.a = mem.read8(0x8806);  m.step(0x16fc, 13);
        regs.and(regs.a);            m.step(0x16fd, 4);
        if (regs.fZ) { m.step(0x1715, 12); break block1715; } // jr z,0x1715
        m.step(0x16ff, 7);
        regs.a = mem.read8(0x8907);  m.step(0x1702, 13);
        regs.bit(0, regs.a);         m.step(0x1704, 8);
        regs.hl = 0x462c;            m.step(0x1707, 10);
        regs.de = 0x4b30;            m.step(0x170a, 10);
        if (regs.fNZ) { m.step(0x1728, 12); break block1728; } // jr nz,0x1728
        m.step(0x170c, 7);
        regs.and(regs.a);            m.step(0x170d, 4);
        regs.hl = 0x44a9;            m.step(0x1710, 10);
        regs.de = 0x4b55;            m.step(0x1713, 10);
        if (regs.fZ) { m.step(0x1728, 12); break block1728; } // jr z,0x1728
        m.step(0x1715, 7);           // jr z not taken -> 0x1715
        break block1715;
      } else {
        m.step(0x16dc, 7);           // 16da  jr z not taken
        regs.a = mem.read8(0x8907);  m.step(0x16df, 13);
        regs.bit(1, regs.a);         m.step(0x16e1, 8);
        if (regs.fNZ) {
          m.step(0x16eb, 12);        // jr nz,0x16eb
          regs.hl = 0x4c92;          m.step(0x16ee, 10);
          regs.de = 0x4dce;          m.step(0x16f1, 10);
          m.step(0x1728, 12);        // jr 0x1728
          break block1728;
        }
        m.step(0x16e3, 7);
        regs.hl = 0x4e81;            m.step(0x16e6, 10);
        regs.de = 0x5039;            m.step(0x16e9, 10);
        m.step(0x1728, 12);          // jr 0x1728
        break block1728;
      }
    }
    // loc_1715: shared alternate (HL,DE) selection keyed on 0x8907 bit0
    regs.a = mem.read8(0x8907);      m.step(0x1718, 13);
    regs.bit(0, regs.a);             m.step(0x171a, 8);
    regs.hl = 0x46d6;                m.step(0x171d, 10);
    regs.de = 0x4a50;                m.step(0x1720, 10);
    if (regs.fZ) { m.step(0x1728, 12); break block1728; } // jr z,0x1728
    m.step(0x1722, 7);
    regs.hl = 0x4872;                m.step(0x1725, 10);
    regs.de = 0x4bf6;                m.step(0x1728, 10);
  }

  // loc_1728: commit the chosen pointers and seed the fixed state, then enqueue + tail-call.
  mem.write16(0x8f45, regs.de);      m.step(0x172c, 20); // ld (0x8f45),de  (ED)
  mem.write16(0x88ba, regs.hl);      m.step(0x172f, 16); // ld (0x88ba),hl
  regs.hl = 0x8442;                  m.step(0x1732, 10);
  mem.write16(0x88b8, regs.hl);      m.step(0x1735, 16);
  regs.hl = 0x8042;                  m.step(0x1738, 10);
  mem.write16(0x8f43, regs.hl);      m.step(0x173b, 16);
  regs.a = 0x20;                     m.step(0x173d, 7);
  mem.write8(0x8d07, regs.a);        m.step(0x1740, 13);
  regs.hl = 0x880a;                  m.step(0x1743, 10);
  regs.incMem8(mem, regs.hl);        m.step(0x1744, 11); // inc (0x880a) -- next sub-state
  regs.de = 0x0683;                  m.step(0x1747, 10);
  m.push16(0x1748);
  m.step(0x0038, 11);                // 1747  rst 0x38 (loc_0038) -- enqueue display command DE
  m.call(0x0038);
  m.push16(0x174b);
  m.step(0x1694, 17);                // 1748  call 0x1694
  m.call(0x1694);
  m.ret(); // 174b  ret
}
