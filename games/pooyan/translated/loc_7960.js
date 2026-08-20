// SPDX-License-Identifier: GPL-3.0-only

// loc_7960  (ROM 0x7960-0x7a0a) -- shared ROM-integrity + nibble-render handler (called by loc_1b43,
// loc_1b8c). rst 0x38 enqueues a display command, then a 0x5b-byte checksum over the table at 0x2901
// folds into E,D (16-bit sum) and L,H (running sum on even IX only); a 4-byte mismatch tail-jumps to a
// trap (0x7a0b/0x0fa0/0x1388/0x1770). The 2 low bytes at 0x8a32|0x8a35 (per 0x880d) are split into hi/lo
// nibbles down 0x862d (stride -0x20), rst 0x10 clears 3 bytes, and the first nonzero of 7 flags at 0x89e7
// diverts to a second checksum (sum until the 0xc9 sentinel, guard at 0x7a0b/0x7a0c, traps 0x07d0/0x1a85).
// The `jr nz,0x79d2` lands mid `dec ix` (0xdd 0x2b) so it executes the bare 0x2b = `dec hl` on B's last bit.
export function loc_7960(m) {
  const { regs, mem } = m;

  regs.de = 0x0609;                            m.step(0x7963, 10);
  m.push16(0x7964); m.step(0x0038, 11); m.call(0x0038); // rst 0x38 enqueue
  regs.ix = 0x2901;                            m.step(0x7968, 14);
  regs.hl = 0x0000;                            m.step(0x796b, 10);
  regs.e = regs.l;                             m.step(0x796c, 4);
  regs.d = regs.e;                             m.step(0x796d, 4);
  regs.b = 0x5b;                               m.step(0x796f, 7);

  // loc_796f: DE += table[IX] (16-bit), and for even IX fold the running low byte into HL
  for (;;) {
    regs.a = mem.read8(regs.ix & 0xffff);      m.step(0x7972, 19);
    regs.add(regs.e);                          m.step(0x7973, 4);
    regs.e = regs.a;                           m.step(0x7974, 4);
    if (regs.fNC) {
      m.step(0x7977, 12);
    } else {
      m.step(0x7976, 7);
      regs.d = regs.inc8(regs.d);              m.step(0x7977, 4);
    }
    regs.c = regs.a;                           m.step(0x7978, 4);
    regs.a = regs.ix & 0xff;                   m.step(0x797a, 8); // ld a,ixl
    regs.and(0x01);                            m.step(0x797c, 7);
    if (regs.fNZ) {
      m.step(0x7984, 12);
    } else {
      m.step(0x797e, 7);
      regs.a = regs.c;                         m.step(0x797f, 4);
      regs.add(regs.l);                        m.step(0x7980, 4);
      regs.l = regs.a;                         m.step(0x7981, 4);
      if (regs.fNC) {
        m.step(0x7984, 12);
      } else {
        m.step(0x7983, 7);
        regs.h = regs.inc8(regs.h);            m.step(0x7984, 4);
      }
    }
    regs.ix = (regs.ix + 1) & 0xffff;          m.step(0x7986, 10);
    if (regs.djnz()) { m.step(0x796f, 13); continue; }
    m.step(0x7988, 8); break;
  }

  // loc_7988: verify the 4 checksum bytes E,D,L,H against the guard at IX; any miss tail-jumps to a trap
  regs.a = regs.e;                             m.step(0x7989, 4);
  regs.cp(mem.read8(regs.ix & 0xffff));        m.step(0x798c, 19);
  if (regs.fNZ) { throw new Error("loc_7960: ROM-integrity/sanity trap 0x7a0b unreachable with a valid ROM"); }
  m.step(0x798f, 10);
  regs.a = regs.d;                             m.step(0x7990, 4);
  regs.cp(mem.read8((regs.ix + 1) & 0xffff));  m.step(0x7993, 19);
  if (regs.fNZ) { throw new Error("loc_7960: ROM-integrity/sanity trap 0x0fa0 unreachable with a valid ROM"); }
  m.step(0x7996, 10);
  regs.a = regs.l;                             m.step(0x7997, 4);
  regs.cp(mem.read8((regs.ix + 2) & 0xffff));  m.step(0x799a, 19);
  if (regs.fNZ) { throw new Error("loc_7960: ROM-integrity/sanity trap 0x1388 unreachable with a valid ROM"); }
  m.step(0x799d, 10);
  regs.a = regs.h;                             m.step(0x799e, 4);
  regs.cp(mem.read8((regs.ix + 3) & 0xffff));  m.step(0x79a1, 19);
  if (regs.fNZ) { throw new Error("loc_7960: ROM-integrity/sanity trap 0x1770 unreachable with a valid ROM"); }
  m.step(0x79a4, 10);

  // loc_79a4: pick the source pair (0x8a32, or 0x8a35 when 0x880d != 0)
  regs.a = mem.read8(0x880d);                  m.step(0x79a7, 13);
  regs.and(regs.a);                            m.step(0x79a8, 4);
  regs.ix = 0x8a32;                            m.step(0x79ac, 14);
  if (regs.fZ) {
    m.step(0x79b1, 12);
  } else {
    m.step(0x79ae, 7);
    regs.ix = (regs.ix & 0xff00) | 0x35;       m.step(0x79b1, 11); // ld ixl,0x35
  }
  regs.hl = 0x862d;                            m.step(0x79b4, 10);
  regs.de = 0xffe0;                            m.step(0x79b7, 10);
  regs.b = 0x02;                               m.step(0x79b9, 7);

  // loc_79b9: split each byte into hi/lo nibble down HL (stride -0x20); on B's last bit take the
  // overlapping `dec hl` at 0x79d2 (bare 0x2b) instead of the 0x51 spacer + `dec ix`
  for (;;) {
    regs.a = mem.read8(regs.ix & 0xffff);      m.step(0x79bc, 19);
    regs.c = regs.a;                           m.step(0x79bd, 4);
    regs.and(0xf0);                            m.step(0x79bf, 7);
    regs.rrca();                               m.step(0x79c0, 4);
    regs.rrca();                               m.step(0x79c1, 4);
    regs.rrca();                               m.step(0x79c2, 4);
    regs.rrca();                               m.step(0x79c3, 4);
    mem.write8(regs.hl, regs.a);               m.step(0x79c4, 7);
    regs.addHl(regs.de);                       m.step(0x79c5, 11);
    regs.a = regs.c;                           m.step(0x79c6, 4);
    regs.and(0x0f);                            m.step(0x79c8, 7);
    mem.write8(regs.hl, regs.a);               m.step(0x79c9, 7);
    regs.addHl(regs.de);                       m.step(0x79ca, 11);
    regs.bit(0, regs.b);                       m.step(0x79cc, 8);
    if (regs.fNZ) {
      m.step(0x79d2, 12);                      // jr nz -> lands on the 0x2b of `dec ix`
      regs.hl = (regs.hl - 1) & 0xffff;        m.step(0x79d3, 6); // 0x2b = dec hl
    } else {
      m.step(0x79ce, 7);
      mem.write8(regs.hl, 0x51);               m.step(0x79d0, 10);
      regs.addHl(regs.de);                     m.step(0x79d1, 11);
      regs.ix = (regs.ix - 1) & 0xffff;        m.step(0x79d3, 10);
    }
    if (regs.djnz()) { m.step(0x79b9, 13); continue; }
    m.step(0x79d5, 8); break;
  }

  m.push16(regs.ix);                           m.step(0x79d7, 15); // push ix
  regs.hl = m.pop16();                         m.step(0x79d8, 10); // pop hl -> HL = IX
  regs.xor(regs.a);                            m.step(0x79d9, 4);
  regs.b = 0x03;                               m.step(0x79db, 7);
  m.push16(0x79dc); m.step(0x0010, 11); m.call(0x0010); // rst 0x10 fill 3 = 0
  regs.hl = 0x89e7;                            m.step(0x79df, 10);
  regs.b = 0x07;                               m.step(0x79e1, 7);

  // loc_79e1: scan 7 flags; first nonzero diverts to the tail checksum, else return
  let toTail = false;
  for (;;) {
    regs.a = mem.read8(regs.hl);               m.step(0x79e2, 7);
    regs.and(regs.a);                          m.step(0x79e3, 4);
    if (regs.fNZ) { m.step(0x79ef, 12); toTail = true; break; }
    m.step(0x79e5, 7);
    regs.hl = (regs.hl + 1) & 0xffff;          m.step(0x79e6, 6);
    if (regs.djnz()) { m.step(0x79e1, 13); continue; }
    m.step(0x79e8, 8); break;
  }
  if (!toTail) { return m.ret(10); } // 0x79e8 ret

  // loc_79ef: sum bytes from HL into DE until a 0xc9 sentinel, then verify E,D against the guard at
  // 0x7a0b/0x7a0c; any miss tail-jumps to a trap. (0x79e9-0x79ee is a separate entry that falls in here;
  // loc_7960 reaches 0x79ef only via the scan's jr nz above, so DE is the 0xffe0 left by the render.)
  for (;;) {
    regs.a = mem.read8(regs.hl);               m.step(0x79f0, 7);
    regs.cp(0xc9);                             m.step(0x79f2, 7);
    if (regs.fZ) { m.step(0x79fc, 12); break; }
    m.step(0x79f4, 7);
    regs.add(regs.e);                          m.step(0x79f5, 4);
    if (regs.fNC) {
      m.step(0x79f8, 12);
    } else {
      m.step(0x79f7, 7);
      regs.d = regs.inc8(regs.d);              m.step(0x79f8, 4);
    }
    regs.e = regs.a;                           m.step(0x79f9, 4);
    regs.hl = (regs.hl + 1) & 0xffff;          m.step(0x79fa, 6);
    m.step(0x79ef, 12); // jr 0x79ef
  }

  regs.hl = 0x7a0b;                            m.step(0x79ff, 10);
  regs.a = regs.e;                             m.step(0x7a00, 4);
  regs.cp(mem.read8(regs.hl));                 m.step(0x7a01, 7);
  if (regs.fNZ) { throw new Error("loc_7960: ROM-integrity/sanity trap 0x07d0 unreachable with a valid ROM"); }
  m.step(0x7a04, 10);
  regs.a = regs.d;                             m.step(0x7a05, 4);
  regs.hl = (regs.hl + 1) & 0xffff;            m.step(0x7a06, 6);
  regs.cp(mem.read8(regs.hl));                 m.step(0x7a07, 7);
  if (regs.fNZ) { m.step(0x1a85, 10); return m.call(0x1a85); }
  m.step(0x7a0a, 10);
  return m.ret(10); // 0x7a0a ret
}
