// SPDX-License-Identifier: GPL-3.0-only

// loc_175d  (ROM 0x175d-0x17c0) -- idx2 leaf handler. Runs loc_4381, then advances two counters:
// 0x88b7 wraps at 0x1c (returns until it reaches 0x1c, then resets to 0); on that wrap it toggles
// the one-shot at 0x8920 (returns if it was 0, else clears it and continues). Past the guards it
// picks an action keyed on 0x8f50 / 0x8904 / 0x8806 / 0x8907: either arm sub-state 0x0d (0x880a),
// or (loc_1798) mark 0x8904/0x8903 in progress and run the level-start batch (loc_1ead, loc_2065,
// loc_4a0b, seed 0x8a91/0x8f06/0x8f09=0x10, loc_540d, loc_02ef), finally forcing sub-state 3.
// Every callee's register clobbers are irrelevant here (all live registers are reloaded after).
export function loc_175d(m) {
  const { regs, mem } = m;

  m.push16(0x1760);
  m.step(0x4381, 17);                // 175d  call 0x4381
  m.call(0x4381);

  regs.hl = 0x88b7;                  m.step(0x1763, 10);
  regs.incMem8(mem, regs.hl);        m.step(0x1764, 11); // inc (0x88b7)
  regs.a = mem.read8(regs.hl);       m.step(0x1765, 7);
  regs.cp(0x1c);                     m.step(0x1767, 7);
  if (regs.fNZ) { return m.ret(11); } // ret nz -- not at wrap yet
  m.step(0x1768, 5);
  mem.write8(regs.hl, 0x00);         m.step(0x176a, 10); // ld (0x88b7),0 -- wrap
  regs.hl = 0x8920;                  m.step(0x176d, 10);
  regs.a = mem.read8(regs.hl);       m.step(0x176e, 7);
  regs.incMem8(mem, regs.hl);        m.step(0x176f, 11); // inc (0x8920)
  regs.and(regs.a);                  m.step(0x1770, 4);  // test the pre-increment value
  if (regs.fZ) { return m.ret(11); } // ret z -- one-shot was 0
  m.step(0x1771, 5);
  regs.xor(regs.a);                  m.step(0x1772, 4);
  mem.write8(regs.hl, regs.a);       m.step(0x1773, 7);  // clear 0x8920
  regs.a = mem.read8(0x8f50);        m.step(0x1776, 13);
  regs.and(regs.a);                  m.step(0x1777, 4);

  block17bb: {
    block17a1: {
      block1798: {
        block1792: {
          if (regs.fNZ) { m.step(0x17bb, 12); break block17bb; } // jr nz,0x17bb (attract)
          m.step(0x1779, 7);
          regs.a = mem.read8(0x8904); m.step(0x177c, 13);
          regs.and(regs.a);           m.step(0x177d, 4);
          if (regs.fNZ) { m.step(0x17a1, 12); break block17a1; } // jr nz,0x17a1 (already started)
          m.step(0x177f, 7);
          regs.a = mem.read8(0x8806); m.step(0x1782, 13);
          regs.and(regs.a);           m.step(0x1783, 4);
          if (regs.fZ) { m.step(0x1798, 12); break block1798; } // jr z,0x1798 (no credit)
          m.step(0x1785, 7);
          regs.a = mem.read8(0x8907); m.step(0x1788, 13);
          regs.bit(0, regs.a);        m.step(0x178a, 8);
          if (regs.fNZ) { m.step(0x1792, 12); break block1792; } // jr nz,0x1792
          m.step(0x178c, 7);
          regs.a = mem.read8(0x8907); m.step(0x178f, 13);
          regs.and(regs.a);           m.step(0x1790, 4);
          if (regs.fNZ) { m.step(0x1798, 12); break block1798; } // jr nz,0x1798
          m.step(0x1792, 7);          // fall through -> 0x1792
        }
        // loc_1792: arm sub-state 0x0d and return
        regs.a = 0x0d;                m.step(0x1794, 7);
        mem.write8(0x880a, regs.a);   m.step(0x1797, 13);
        return m.ret(10); // 1797  ret
      }
      // loc_1798: mark in-progress, then fall into the level-start batch
      regs.a = 0x01;                  m.step(0x179a, 7);
      mem.write8(0x8904, regs.a);     m.step(0x179d, 13);
      regs.a = regs.inc8(regs.a);     m.step(0x179e, 4);
      mem.write8(0x8903, regs.a);     m.step(0x17a1, 13);
    }
    // loc_17a1: level-start batch
    m.push16(0x17a4);
    m.step(0x1ead, 17);               // 17a1  call 0x1ead
    m.call(0x1ead);
    m.push16(0x17a7);
    m.step(0x2065, 17);               // 17a4  call 0x2065
    m.call(0x2065);
    m.push16(0x17aa);
    m.step(0x4a0b, 17);               // 17a7  call 0x4a0b
    m.call(0x4a0b);
    regs.a = 0x10;                    m.step(0x17ac, 7);
    mem.write8(0x8a91, regs.a);       m.step(0x17af, 13);
    mem.write8(0x8f06, regs.a);       m.step(0x17b2, 13);
    mem.write8(0x8f09, regs.a);       m.step(0x17b5, 13);
    m.push16(0x17b8);
    m.step(0x540d, 17);               // 17b5  call 0x540d
    m.call(0x540d);
    m.push16(0x17bb);
    m.step(0x02ef, 17);               // 17b8  call 0x02ef
    m.call(0x02ef);
  }
  // loc_17bb: force sub-state 3 and return
  regs.hl = 0x880a;                   m.step(0x17be, 10);
  mem.write8(regs.hl, 0x03);          m.step(0x17c0, 10); // ld (0x880a),0x03
  m.ret(); // 17c0  ret
}
