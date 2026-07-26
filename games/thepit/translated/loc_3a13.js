// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_3a13  (ROM 0x3a13–0x3a4b, then falls through into loc_3a4c) — runs the
 * move/collision driver (loc_319d) over one, then optionally two, 17-byte object
 * records via the shared working block at 0x8083.
 *
 * Each pass copies a 0x11-byte record into the scratch block at 0x8083 (ldir),
 * calls loc_319d to advance/collide it in place, then copies the result back to
 * the record. Record 1 lives at 0x810a and is ALWAYS processed. Record 2 lives at
 * 0x811b and is processed only when the gate at 0x8078 is non-zero — otherwise the
 * routine jumps straight to loc_3a4c. Both the taken `jp z` and the fall-through at
 * the end reach loc_3a4c, whose final `ret` returns to loc_3a13's OWN caller, so
 * each is modelled as a tail-call (m.call with NO push and NO trailing m.ret; a
 * second ret would double-pop).
 *
 *   3a13  21 0a 81     ld   hl,0x810a
 *   3a16  11 83 80     ld   de,0x8083
 *   3a19  01 11 00     ld   bc,0x0011
 *   3a1c  ed b0        ldir                 ; record 1 -> scratch 0x8083
 *   3a1e  cd 9d 31     call 0x319d          ; move/collision driver on the scratch block
 *   3a21  21 83 80     ld   hl,0x8083
 *   3a24  11 0a 81     ld   de,0x810a
 *   3a27  01 11 00     ld   bc,0x0011
 *   3a2a  ed b0        ldir                 ; scratch -> record 1
 *   3a2c  3a 78 80     ld   a,(0x8078)
 *   3a2f  b7           or   a               ; second record active?
 *   3a30  ca 4c 3a     jp   z,0x3a4c        ; no -> tail-jump to loc_3a4c
 *   3a33  21 1b 81     ld   hl,0x811b
 *   3a36  11 83 80     ld   de,0x8083
 *   3a39  01 11 00     ld   bc,0x0011
 *   3a3c  ed b0        ldir                 ; record 2 -> scratch 0x8083
 *   3a3e  cd 9d 31     call 0x319d          ; move/collision driver on the scratch block
 *   3a41  21 83 80     ld   hl,0x8083
 *   3a44  11 1b 81     ld   de,0x811b
 *   3a47  01 11 00     ld   bc,0x0011
 *   3a4a  ed b0        ldir                 ; scratch -> record 2 ; PC now at loc_3a4c
 */
export function loc_3a13(m) {
  const { regs, mem } = m;

  // -- record 1: 0x810a <-> scratch 0x8083, driven by loc_319d ------------------
  regs.hl = 0x810a;
  m.step(0x3a16, 10); // 3a13  ld hl,0x810a

  regs.de = 0x8083;
  m.step(0x3a19, 10); // 3a16  ld de,0x8083

  regs.bc = 0x0011;
  m.step(0x3a1c, 10); // 3a19  ld bc,0x0011

  m.ldirAt(0x3a1c, 0x3a1e); // 3a1c  ldir -- record 1 -> scratch (0x11 bytes)

  m.push16(0x3a21);
  m.step(0x319d, 17); // 3a1e  call 0x319d
  m.call(0x319d);

  regs.hl = 0x8083;
  m.step(0x3a24, 10); // 3a21  ld hl,0x8083

  regs.de = 0x810a;
  m.step(0x3a27, 10); // 3a24  ld de,0x810a

  regs.bc = 0x0011;
  m.step(0x3a2a, 10); // 3a27  ld bc,0x0011

  m.ldirAt(0x3a2a, 0x3a2c); // 3a2a  ldir -- scratch -> record 1

  regs.a = mem.read8(0x8078);
  m.step(0x3a2f, 13); // 3a2c  ld a,(0x8078)

  regs.or(regs.a);
  m.step(0x3a30, 4); // 3a2f  or a -- test the second-record gate

  if (regs.fZ) {
    m.step(0x3a4c, 10); // 3a30  jp z,0x3a4c -- taken: no second record
    // Tail-jump into loc_3a4c: its ret returns to loc_3a13's caller. No push, no ret.
    return m.call(0x3a4c);
  }
  m.step(0x3a33, 10); // 3a30  jp z,0x3a4c -- not taken: process record 2

  // -- record 2: 0x811b <-> scratch 0x8083, driven by loc_319d ------------------
  regs.hl = 0x811b;
  m.step(0x3a36, 10); // 3a33  ld hl,0x811b

  regs.de = 0x8083;
  m.step(0x3a39, 10); // 3a36  ld de,0x8083

  regs.bc = 0x0011;
  m.step(0x3a3c, 10); // 3a39  ld bc,0x0011

  m.ldirAt(0x3a3c, 0x3a3e); // 3a3c  ldir -- record 2 -> scratch (0x11 bytes)

  m.push16(0x3a41);
  m.step(0x319d, 17); // 3a3e  call 0x319d
  m.call(0x319d);

  regs.hl = 0x8083;
  m.step(0x3a44, 10); // 3a41  ld hl,0x8083

  regs.de = 0x811b;
  m.step(0x3a47, 10); // 3a44  ld de,0x811b

  regs.bc = 0x0011;
  m.step(0x3a4a, 10); // 3a47  ld bc,0x0011

  m.ldirAt(0x3a4a, 0x3a4c); // 3a4a  ldir -- scratch -> record 2 ; PC now at loc_3a4c

  // Fall through into loc_3a4c: its ret returns to loc_3a13's caller. Tail-call
  // idiom -- no push, no trailing m.ret.
  return m.call(0x3a4c);
}
