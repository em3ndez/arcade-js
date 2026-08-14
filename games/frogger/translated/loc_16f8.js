// SPDX-License-Identifier: GPL-3.0-only

// loc_16f8  (ROM 0x16F8-0x1801) — frog death / hop-complete animation driver. Gated by (0x8004);
// ticks the hop-frame counter (0x8247) and, once it reaches 0x10, advances the death phase (0x81B2)
// and dispatches on it: either the board-advance/reset arm (calls loc_0804) or one of the per-phase
// tile pokes (queued via rst 0x18) that draw the death sequence; (0x829C) selects the second bank.
export function loc_16f8(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8004);
  m.step(0x16fb, 13); // ld a,(0x8004) -- the death/hop-active gate
  regs.and(regs.a);
  m.step(0x16fc, 4);
  if (regs.fZ) {
    m.ret(11); // ret z (taken) -- not active
    return;
  }
  m.step(0x16fd, 5);
  regs.a = mem.read8(0x8150);
  m.step(0x1700, 13);
  regs.bit(0, regs.a);
  m.step(0x1702, 8); // bit 0,a
  if (regs.fZ) {
    m.step(0x1709, 12);
    return block_1709();
  }
  m.step(0x1704, 7);
  regs.a = 0x01;
  m.step(0x1706, 7);
  mem.write8(0x8118, regs.a);
  m.step(0x1709, 13);
  return block_1709();

  function block_1709() {
    regs.a = mem.read8(0x8120);
    m.step(0x170c, 13);
    regs.and(regs.a);
    m.step(0x170d, 4);
    if (regs.fZ) {
      m.step(0x1712, 12);
      return block_1712();
    }
    m.step(0x170f, 7);
    mem.write8(0x8121, regs.a);
    m.step(0x1712, 13);
    return block_1712();
  }

  function block_1712() {
    m.push16(0x1715);
    m.step(0x25ce, 17); // call 0x25ce
    m.call(0x25ce);
    m.push16(0x1718);
    m.step(0x27b3, 17); // call 0x27b3
    m.call(0x27b3);
    regs.a = mem.read8(0x8247);
    m.step(0x171b, 13); // ld a,(0x8247) -- hop-frame counter
    regs.a = regs.inc8(regs.a);
    m.step(0x171c, 4);
    mem.write8(0x8247, regs.a);
    m.step(0x171f, 13);
    regs.sub(0x10);
    m.step(0x1721, 7); // sub 0x10
    if (regs.fNZ) {
      m.ret(11); // ret nz (taken) -- counter not yet at 0x10
      return;
    }
    m.step(0x1722, 5);
    mem.write8(0x8247, regs.a);
    m.step(0x1725, 13); // ld (0x8247),a -- A = 0
    regs.a = 0x07;
    m.step(0x1727, 7);
    mem.write8(0x8046, regs.a);
    m.step(0x172a, 13);
    regs.hl = 0x8044;
    m.step(0x172d, 10);
    regs.a = mem.read8(0x81b2);
    m.step(0x1730, 13); // ld a,(0x81b2) -- death phase index
    regs.a = regs.inc8(regs.a);
    m.step(0x1731, 4);
    mem.write8(0x81b2, regs.a);
    m.step(0x1734, 13);
    regs.c = regs.a;
    m.step(0x1735, 4);
    regs.a = mem.read8(0x829c);
    m.step(0x1738, 13); // ld a,(0x829c) -- second-bank select
    regs.and(regs.a);
    m.step(0x1739, 4);
    if (regs.fNZ) {
      m.step(0x177d, 10); // jp nz,0x177d
      return block_177d();
    }
    m.step(0x173c, 10);
    regs.a = regs.c;
    m.step(0x173d, 4);
    regs.cp(0x06);
    m.step(0x173f, 7); // cp 0x06
    if (regs.fNZ) {
      m.step(0x1785, 12);
      return block_1785();
    }
    m.step(0x1741, 7);
    return block_1741();
  }

  function block_1741() {
    m.push16(0x1744);
    m.step(0x0804, 17); // call 0x0804
    m.call(0x0804);
    regs.xor(regs.a);
    m.step(0x1745, 4); // A = 0
    mem.write8(0x81b2, regs.a);
    m.step(0x1748, 13); // ld (0x81b2),a -- reset death phase
    mem.write8(0x8004, regs.a);
    m.step(0x174b, 13); // ld (0x8004),a -- clear the death gate
    mem.write8(0x8247, regs.a);
    m.step(0x174e, 13);
    mem.write8(0x8269, regs.a);
    m.step(0x1751, 13);
    mem.write8(0x829c, regs.a);
    m.step(0x1754, 13);
    regs.hl = 0x8248;
    m.step(0x1757, 10);
    regs.de = 0x8249;
    m.step(0x175a, 10);
    regs.bc = 0x000b;
    m.step(0x175d, 10);
    mem.write8(regs.hl, regs.a);
    m.step(0x175e, 7); // ld (hl),a -- seed the block with 0
    m.ldirAt(0x175e, 0x1760); // ldir -- clear 0x8249..0x8253
    regs.a = regs.inc8(regs.a);
    m.step(0x1761, 4); // A = 1
    mem.write8(0x83ce, regs.a);
    m.step(0x1764, 13);
    regs.a = mem.read8(0x83d6);
    m.step(0x1767, 13); // ld a,(0x83d6) -- game-mode byte
    regs.a = regs.dec8(regs.a);
    m.step(0x1768, 4);
    if (regs.fNZ) {
      m.step(0x177c, 12);
      return block_177c();
    }
    m.step(0x176a, 7);
    regs.a = mem.read8(0x83fe);
    m.step(0x176d, 13); // ld a,(0x83fe) -- play/mode flag
    regs.and(regs.a);
    m.step(0x176e, 4);
    if (regs.fNZ) {
      m.step(0x177c, 12);
      return block_177c();
    }
    m.step(0x1770, 7);
    mem.write8(0x83d6, regs.a);
    m.step(0x1773, 13);
    mem.write8(0x8299, regs.a);
    m.step(0x1776, 13);
    mem.write8(0x829a, regs.a);
    m.step(0x1779, 13);
    mem.write8(0x825b, regs.a);
    m.step(0x177c, 13);
    return block_177c();
  }

  function block_177c() {
    m.ret();
  }

  function block_177d() {
    regs.a = regs.c;
    m.step(0x177e, 4);
    regs.cp(0x05);
    m.step(0x1780, 7); // cp 0x05
    if (regs.fNZ) {
      m.step(0x1785, 12);
      return block_1785();
    }
    m.step(0x1782, 7);
    m.step(0x1741, 10); // jp 0x1741
    return block_1741();
  }

  function block_1785() {
    regs.a = mem.read8(0x829c);
    m.step(0x1788, 13); // ld a,(0x829c)
    regs.and(regs.a);
    m.step(0x1789, 4);
    if (regs.fNZ) {
      m.step(0x17c4, 10); // jp nz,0x17c4
      return block_17c4();
    }
    m.step(0x178c, 10);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x178d, 6); // inc hl
    regs.a = mem.read8(0x81b2);
    m.step(0x1790, 13); // ld a,(0x81b2) -- death phase index
    regs.a = regs.dec8(regs.a);
    m.step(0x1791, 4);
    if (regs.fZ) {
      m.step(0x179e, 12);
      return block_179e();
    }
    m.step(0x1793, 7);
    regs.a = regs.dec8(regs.a);
    m.step(0x1794, 4);
    if (regs.fZ) {
      m.step(0x17ab, 12);
      return block_17ab();
    }
    m.step(0x1796, 7);
    regs.a = regs.dec8(regs.a);
    m.step(0x1797, 4);
    if (regs.fZ) {
      m.step(0x17ae, 12);
      return block_17ae();
    }
    m.step(0x1799, 7);
    regs.a = regs.dec8(regs.a);
    m.step(0x179a, 4);
    if (regs.fZ) {
      m.step(0x17b1, 12);
      return block_17b1();
    }
    m.step(0x179c, 7);
    m.step(0x17b4, 12); // jr 0x17b4
    return block_17b4();
  }

  function block_179e() {
    mem.write8(regs.hl, 0x39);
    m.step(0x17a0, 10); // ld (hl),0x39
    regs.xor(regs.a);
    m.step(0x17a1, 4);
    regs.h = regs.a;
    m.step(0x17a2, 4);
    regs.l = regs.a;
    m.step(0x17a3, 4); // HL = 0
    mem.write16(0x8382, regs.hl);
    m.step(0x17a6, 16); // ld (0x8382),hl
    m.push16(0x17a7);
    m.step(0x0018, 11); // rst 0x18
    m.call(0x0018);
    regs.a = 0x03;
    m.step(0x17a9, 7);
    m.push16(0x17aa);
    m.step(0x0018, 11); // rst 0x18
    m.call(0x0018);
    m.ret();
  }

  function block_17ab() {
    mem.write8(regs.hl, 0x39);
    m.step(0x17ad, 10); // ld (hl),0x39
    m.ret();
  }

  function block_17ae() {
    mem.write8(regs.hl, 0x3a);
    m.step(0x17b0, 10); // ld (hl),0x3a
    m.ret();
  }

  function block_17b1() {
    mem.write8(regs.hl, 0x3b);
    m.step(0x17b3, 10); // ld (hl),0x3b
    m.ret();
  }

  function block_17b4() {
    mem.write8(regs.hl, 0x3c);
    m.step(0x17b6, 10); // ld (hl),0x3c
    regs.xor(regs.a);
    m.step(0x17b7, 4);
    mem.write8(0x83ae, regs.a);
    m.step(0x17ba, 13);
    m.push16(0x17bd);
    m.step(0x2856, 17); // call 0x2856
    m.call(0x2856);
    regs.hl = 0x00d8;
    m.step(0x17c0, 10);
    mem.write16(0x8382, regs.hl);
    m.step(0x17c3, 16); // ld (0x8382),hl
    m.ret();
  }

  function block_17c4() {
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x17c5, 6); // inc hl
    regs.a = mem.read8(0x81b2);
    m.step(0x17c8, 13); // ld a,(0x81b2) -- death phase index
    regs.a = regs.dec8(regs.a);
    m.step(0x17c9, 4);
    if (regs.fZ) {
      m.step(0x17d3, 12);
      return block_17d3();
    }
    m.step(0x17cb, 7);
    regs.a = regs.dec8(regs.a);
    m.step(0x17cc, 4);
    if (regs.fZ) {
      m.step(0x17e0, 12);
      return block_17e0();
    }
    m.step(0x17ce, 7);
    regs.a = regs.dec8(regs.a);
    m.step(0x17cf, 4);
    if (regs.fZ) {
      m.step(0x17e3, 12);
      return block_17e3();
    }
    m.step(0x17d1, 7);
    m.step(0x17e6, 12); // jr 0x17e6
    return block_17e6();
  }

  function block_17d3() {
    mem.write8(regs.hl, 0x22);
    m.step(0x17d5, 10); // ld (hl),0x22
    regs.xor(regs.a);
    m.step(0x17d6, 4);
    regs.h = regs.a;
    m.step(0x17d7, 4);
    regs.l = regs.a;
    m.step(0x17d8, 4); // HL = 0
    mem.write16(0x8382, regs.hl);
    m.step(0x17db, 16); // ld (0x8382),hl
    m.push16(0x17dc);
    m.step(0x0018, 11); // rst 0x18
    m.call(0x0018);
    regs.a = 0x02;
    m.step(0x17de, 7);
    m.push16(0x17df);
    m.step(0x0018, 11); // rst 0x18
    m.call(0x0018);
    m.ret();
  }

  function block_17e0() {
    mem.write8(regs.hl, 0x23);
    m.step(0x17e2, 10); // ld (hl),0x23
    m.ret();
  }

  function block_17e3() {
    mem.write8(regs.hl, 0x24);
    m.step(0x17e5, 10); // ld (hl),0x24
    m.ret();
  }

  function block_17e6() {
    mem.write8(regs.hl, 0x3c);
    m.step(0x17e8, 10); // ld (hl),0x3c
    regs.xor(regs.a);
    m.step(0x17e9, 4);
    mem.write8(0x83ae, regs.a);
    m.step(0x17ec, 13);
    mem.write8(0x8110, regs.a);
    m.step(0x17ef, 13);
    mem.write8(0x8107, regs.a);
    m.step(0x17f2, 13);
    mem.write8(0x811a, regs.a);
    m.step(0x17f5, 13);
    mem.write8(0x8119, regs.a);
    m.step(0x17f8, 13);
    m.push16(0x17fb);
    m.step(0x2856, 17); // call 0x2856
    m.call(0x2856);
    regs.hl = 0x00d8;
    m.step(0x17fe, 10);
    mem.write16(0x8382, regs.hl);
    m.step(0x1801, 16); // ld (0x8382),hl
    m.ret();
  }
}
