// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1434  (ROM 0x1434-0x144b) — the object-flags dispatcher, entered from
 * loc_1420 (tail-jump / fall-through) with A = the selected object byte
 * (mem[0x801b] or mem[0x8018]). It stashes that byte in L and then vectors to
 * one of three handlers on two independent conditions:
 *
 *   if mem[0x8075] == 0        -> loc_144c              (the mode-idle branch)
 *   else                        depends on L's low bits, then 0x8075's sign:
 *     if L bit0 set            -> 0x1659
 *     else if L bit1 set       -> 0x184a
 *     else if mem[0x8075] < 0  -> 0x1659    (bit7 set == "negative" mode)
 *     else                     -> 0x184a
 *
 * The second `and a` (0x1445) re-tests A, which still holds mem[0x8075] — none
 * of the intervening `bit`/`jp` touch A — so `jp m` reads the 0x8075 sign.
 * Every exit is a tail-jump: `return m.call(target)` whose callee ret returns to
 * OUR caller, so there is no trailing m.ret (a second ret would double-pop).
 *
 *   1434  6f           ld   l,a
 *   1435  3a 75 80     ld   a,(0x8075)
 *   1438  a7           and  a
 *   1439  28 11        jr   z,0x144c
 *   143b  cb 45        bit  0,l
 *   143d  c2 59 16     jp   nz,0x1659
 *   1440  cb 4d        bit  1,l
 *   1442  c2 4a 18     jp   nz,0x184a
 *   1445  a7           and  a
 *   1446  fa 59 16     jp   m,0x1659
 *   1449  c3 4a 18     jp   0x184a
 */
export function loc_1434(m) {
  const { regs, mem } = m;

  regs.l = regs.a;
  m.step(0x1435, 4); // ld l,a -- stash the incoming object byte in L

  regs.a = mem.read8(0x8075);
  m.step(0x1438, 13); // ld a,(0x8075)
  regs.and(regs.a);
  m.step(0x1439, 4); // and a -- test the 0x8075 mode byte
  if (regs.fZ) {
    m.step(0x144c, 12); // jr z taken -- mode idle
    return m.call(0x144c);
  }
  m.step(0x143b, 7); // jr z not taken

  regs.bit(0, regs.l);
  m.step(0x143d, 8); // bit 0,l
  if (regs.fNZ) {
    m.step(0x1659, 10); // jp nz taken -- L bit0 set
    return m.call(0x1659);
  }
  m.step(0x1440, 10); // jp nz not taken

  regs.bit(1, regs.l);
  m.step(0x1442, 8); // bit 1,l
  if (regs.fNZ) {
    m.step(0x184a, 10); // jp nz taken -- L bit1 set
    return m.call(0x184a);
  }
  m.step(0x1445, 10); // jp nz not taken

  regs.and(regs.a);
  m.step(0x1446, 4); // and a -- re-test A (still mem[0x8075]) for its sign
  if (regs.fM) {
    m.step(0x1659, 10); // jp m taken -- 0x8075 negative
    return m.call(0x1659);
  }
  m.step(0x1449, 10); // jp m not taken

  m.step(0x184a, 10); // jp 0x184a -- 0x8075 positive
  return m.call(0x184a);
}
