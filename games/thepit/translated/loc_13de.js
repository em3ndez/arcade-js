// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_13de  (ROM 0x13de-0x141f) — the main player/state dispatcher body,
 * entered from the loc_13c9 countdown gate once the frame timer is idle. It
 * reads a chain of work-RAM gate/mode bytes and vectors to the matching
 * handler; the routine itself holds NO logic beyond the guards.
 *
 * Guard chain (each byte gates the next test):
 *   0x807a != 0                       -> 0x1b5b   (busy this frame; defer)
 *   0x8079 == 0                       -> ret      (nothing active; done)
 *   0x807b != 0                       -> ret      (sub-state busy; defer)
 *   DE = word (0x806c/0x806d)                     (loaded for the handlers)
 *   0x80c1 == 1                       -> 0x186a
 *   0x80c1 != 0 (and != 1)            -> 0x1b5b   (dec/inc probe of 0x80c1)
 *   0x8075 < 0  (bit7 set)            -> 0x1659
 *   0x8075 > 0                        -> 0x184a
 *   (0x8075 == 0) 0x80e7 == 0         -> loc_1420 (jr into the shared tail)
 *   0x8077 != 0                       -> 0x19d0
 *   0x80e6 == 0                       -> 0x186f
 *   else                              -> loc_1420 (falls through into it)
 *
 * loc_1420 is its own translated routine, reached BOTH via the jr z at 0x1410
 * and via the fall-through past the final jp z — modelled as a tail-jump
 * (`return m.call(0x1420)`, whose own ret returns to OUR caller). Likewise every
 * jp/jp cc out is a tail-jump: no trailing m.ret here.
 *
 *   13de  3a 7a 80     ld   a,(0x807a)
 *   13e1  b7           or   a
 *   13e2  c2 5b 1b     jp   nz,0x1b5b
 *   13e5  3a 79 80     ld   a,(0x8079)
 *   13e8  a7           and  a
 *   13e9  c8           ret  z
 *   13ea  3a 7b 80     ld   a,(0x807b)
 *   13ed  a7           and  a
 *   13ee  c0           ret  nz
 *   13ef  3a 6c 80     ld   a,(0x806c)
 *   13f2  5f           ld   e,a
 *   13f3  3a 6d 80     ld   a,(0x806d)
 *   13f6  57           ld   d,a
 *   13f7  3a c1 80     ld   a,(0x80c1)
 *   13fa  3d           dec  a
 *   13fb  ca 6a 18     jp   z,0x186a
 *   13fe  3c           inc  a
 *   13ff  c2 5b 1b     jp   nz,0x1b5b
 *   1402  3a 75 80     ld   a,(0x8075)
 *   1405  a7           and  a
 *   1406  fa 59 16     jp   m,0x1659
 *   1409  c2 4a 18     jp   nz,0x184a
 *   140c  3a e7 80     ld   a,(0x80e7)
 *   140f  a7           and  a
 *   1410  28 0e        jr   z,0x1420
 *   1412  3a 77 80     ld   a,(0x8077)
 *   1415  a7           and  a
 *   1416  c2 d0 19     jp   nz,0x19d0
 *   1419  3a e6 80     ld   a,(0x80e6)
 *   141c  a7           and  a
 *   141d  ca 6f 18     jp   z,0x186f
 *                      (fall through into loc_1420)
 */
export function loc_13de(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x807a);
  m.step(0x13e1, 13); // ld a,(0x807a)
  regs.or(regs.a);
  m.step(0x13e2, 4); // or a -- test the 0x807a "busy this frame" gate
  if (regs.fNZ) {
    m.step(0x1b5b, 10); // jp nz taken -- busy, defer
    return m.call(0x1b5b);
  }
  m.step(0x13e5, 10); // jp nz not taken

  regs.a = mem.read8(0x8079);
  m.step(0x13e8, 13); // ld a,(0x8079)
  regs.and(regs.a);
  m.step(0x13e9, 4); // and a -- test the 0x8079 "active" flag
  if (regs.fZ) {
    m.ret(11); // ret z -- nothing active this frame
    return;
  }
  m.step(0x13ea, 5); // ret z not taken

  regs.a = mem.read8(0x807b);
  m.step(0x13ed, 13); // ld a,(0x807b)
  regs.and(regs.a);
  m.step(0x13ee, 4); // and a -- test the 0x807b sub-state busy flag
  if (regs.fNZ) {
    m.ret(11); // ret nz -- sub-state busy, defer
    return;
  }
  m.step(0x13ef, 5); // ret nz not taken

  regs.a = mem.read8(0x806c);
  m.step(0x13f2, 13); // ld a,(0x806c)
  regs.e = regs.a;
  m.step(0x13f3, 4); // ld e,a
  regs.a = mem.read8(0x806d);
  m.step(0x13f6, 13); // ld a,(0x806d)
  regs.d = regs.a;
  m.step(0x13f7, 4); // ld d,a -- DE = word at 0x806c/0x806d

  regs.a = mem.read8(0x80c1);
  m.step(0x13fa, 13); // ld a,(0x80c1)
  regs.a = regs.dec8(regs.a);
  m.step(0x13fb, 4); // dec a -- A==0 iff 0x80c1 was 1
  if (regs.fZ) {
    m.step(0x186a, 10); // jp z taken -- 0x80c1 == 1
    return m.call(0x186a);
  }
  m.step(0x13fe, 10); // jp z not taken

  regs.a = regs.inc8(regs.a);
  m.step(0x13ff, 4); // inc a -- restore A to the 0x80c1 value; A==0 iff it was 0
  if (regs.fNZ) {
    m.step(0x1b5b, 10); // jp nz taken -- 0x80c1 neither 0 nor 1
    return m.call(0x1b5b);
  }
  m.step(0x1402, 10); // jp nz not taken -- 0x80c1 == 0

  regs.a = mem.read8(0x8075);
  m.step(0x1405, 13); // ld a,(0x8075)
  regs.and(regs.a);
  m.step(0x1406, 4); // and a -- test the signed 0x8075 mode byte
  if (regs.fM) {
    m.step(0x1659, 10); // jp m taken -- 0x8075 negative
    return m.call(0x1659);
  }
  m.step(0x1409, 10); // jp m not taken
  if (regs.fNZ) {
    m.step(0x184a, 10); // jp nz taken -- 0x8075 positive non-zero
    return m.call(0x184a);
  }
  m.step(0x140c, 10); // jp nz not taken -- 0x8075 == 0

  regs.a = mem.read8(0x80e7);
  m.step(0x140f, 13); // ld a,(0x80e7)
  regs.and(regs.a);
  m.step(0x1410, 4); // and a -- test 0x80e7
  if (regs.fZ) {
    m.step(0x1420, 12); // jr z taken -- branch into the shared tail loc_1420
    return m.call(0x1420);
  }
  m.step(0x1412, 7); // jr z not taken

  regs.a = mem.read8(0x8077);
  m.step(0x1415, 13); // ld a,(0x8077)
  regs.and(regs.a);
  m.step(0x1416, 4); // and a -- test 0x8077
  if (regs.fNZ) {
    m.step(0x19d0, 10); // jp nz taken
    return m.call(0x19d0);
  }
  m.step(0x1419, 10); // jp nz not taken

  regs.a = mem.read8(0x80e6);
  m.step(0x141c, 13); // ld a,(0x80e6)
  regs.and(regs.a);
  m.step(0x141d, 4); // and a -- test 0x80e6
  if (regs.fZ) {
    m.step(0x186f, 10); // jp z taken
    return m.call(0x186f);
  }
  m.step(0x1420, 10); // jp z not taken -- fall through into loc_1420

  return m.call(0x1420); // fall-through tail-jump; PC already at 0x1420
}
