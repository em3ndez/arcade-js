// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_144c  (ROM 0x144c-0x1467) — the "mode-idle" object dispatcher, entered
 * from loc_1434 via `m.call(0x144c)` on the `jr z` at 0x1439 (i.e. when the
 * 0x8075 mode byte is zero). L still holds the selected object byte that
 * loc_1434 stashed there; this routine vectors on that byte:
 *
 *   if L bit0 set              -> 0x1493
 *   else if L bit1 set         -> 0x167f
 *   else if (L & 0x0c) != 0    -> 0x1468
 *   else:                        A = 0 (the AND result), store it into 0x801a,
 *     then read mem[0x80e7]:
 *       if mem[0x80e7] != 0    -> 0x186f
 *       else                   -> 0x1b5b   (defer the frame)
 *
 * `and 0x0c` at 0x1457 leaves A = L & 0x0c; on the fall-through path that value
 * is zero, so the `ld (0x801a),a` at 0x145b writes 0. Every exit is a tail-jump:
 * `return m.call(target)` whose callee ret returns to OUR caller, so there is no
 * trailing m.ret (a second ret would double-pop).
 *
 *   144c  cb 45        bit  0,l
 *   144e  c2 93 14     jp   nz,0x1493
 *   1451  cb 4d        bit  1,l
 *   1453  c2 7f 16     jp   nz,0x167f
 *   1456  7d           ld   a,l
 *   1457  e6 0c        and  0x0c
 *   1459  20 0d        jr   nz,0x1468
 *   145b  32 1a 80     ld   (0x801a),a
 *   145e  3a e7 80     ld   a,(0x80e7)
 *   1461  a7           and  a
 *   1462  c2 6f 18     jp   nz,0x186f
 *   1465  c3 5b 1b     jp   0x1b5b
 */
export function loc_144c(m) {
  const { regs, mem } = m;

  regs.bit(0, regs.l);
  m.step(0x144e, 8); // bit 0,l -- test the object byte's bit 0
  if (regs.fNZ) {
    m.step(0x1493, 10); // jp nz taken -- L bit0 set
    return m.call(0x1493);
  }
  m.step(0x1451, 10); // jp nz not taken

  regs.bit(1, regs.l);
  m.step(0x1453, 8); // bit 1,l
  if (regs.fNZ) {
    m.step(0x167f, 10); // jp nz taken -- L bit1 set
    return m.call(0x167f);
  }
  m.step(0x1456, 10); // jp nz not taken

  regs.a = regs.l;
  m.step(0x1457, 4); // ld a,l
  regs.and(0x0c);
  m.step(0x1459, 7); // and 0x0c -- isolate bits 2..3 of the object byte
  if (regs.fNZ) {
    m.step(0x1468, 12); // jr nz taken -- (L & 0x0c) != 0
    return m.call(0x1468);
  }
  m.step(0x145b, 7); // jr nz not taken -- A is now 0

  mem.write8(0x801a, regs.a); // A == 0 here
  m.step(0x145e, 13); // ld (0x801a),a
  regs.a = mem.read8(0x80e7);
  m.step(0x1461, 13); // ld a,(0x80e7)
  regs.and(regs.a);
  m.step(0x1462, 4); // and a -- test the 0x80e7 byte
  if (regs.fNZ) {
    m.step(0x186f, 10); // jp nz taken -- 0x80e7 set
    return m.call(0x186f);
  }
  m.step(0x1465, 10); // jp nz not taken

  m.step(0x1b5b, 10); // jp 0x1b5b -- defer the frame
  return m.call(0x1b5b);
}
