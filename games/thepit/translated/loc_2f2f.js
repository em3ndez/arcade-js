// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2f2f  (ROM 0x2f2f-0x2f6e, The Pit) -- initialises a block of subsystem
 * parameters/counters at 0x80db-0x80e7, derives the animation reload byte at
 * (0x80e4), then TAIL-JUMPS into loc_30de.
 *
 * The straight-line block seeds fixed constants:
 *   (0x80dc)=0x39  (0x80db)=0x28  (0x80de)=0x78  (0x80dd)=0xc0
 *   (0x80df)=0x01  (0x80e0)=0xfc  (0x80e3)=0x01  (0x80e5)=0x01
 *   (0x80e7)=0x00  (0x80e6)=0x96
 * Then it computes (0x80e4) from the level/difficulty counter (0x8028):
 *   A = min((0x8028)+1, 4)   -- inc then clamp to 4 (the `jr c` skips the cap
 *                               when (0x8028)+1 < 4)
 *   A ^= 0x07                -- so (0x80e4) runs 0x07,0x06,0x05,0x04,0x03 as the
 *                               level rises, i.e. a decreasing reload as it caps
 *   (0x80e4) = A
 * Finally `jp 0x30de` -- an UNCONDITIONAL tail-jump; this routine has NO ret, so
 * loc_30de's own ret returns to OUR caller. Modelled per the thepit convention
 * (loc_02a1 / loc_0066): `m.step(target,10); return m.call(target)` with no
 * trailing m.ret (a call+ret would push a spurious frame and double-pop).
 * loc_2f69 is the internal `jr c` target, reached only from inside this routine,
 * so it is just a label in the fall-through, not a separate ROM routine. Every
 * store is to work RAM (0x80xx), which takes no write-bus offset.
 * (Role is best-effort from the code; the addresses, constants, arithmetic and
 * control flow are exact.)
 *
 * loc_2f2f:
 *   2f2f  3e 39        ld   a,0x39
 *   2f31  32 dc 80     ld   (0x80dc),a
 *   2f34  3e 28        ld   a,0x28
 *   2f36  32 db 80     ld   (0x80db),a
 *   2f39  3e 78        ld   a,0x78
 *   2f3b  32 de 80     ld   (0x80de),a
 *   2f3e  3e c0        ld   a,0xc0
 *   2f40  32 dd 80     ld   (0x80dd),a
 *   2f43  3e 01        ld   a,0x01
 *   2f45  32 df 80     ld   (0x80df),a
 *   2f48  3e fc        ld   a,0xfc
 *   2f4a  32 e0 80     ld   (0x80e0),a
 *   2f4d  3e 01        ld   a,0x01
 *   2f4f  32 e3 80     ld   (0x80e3),a
 *   2f52  32 e5 80     ld   (0x80e5),a
 *   2f55  3e 00        ld   a,0x00
 *   2f57  32 e7 80     ld   (0x80e7),a
 *   2f5a  3e 96        ld   a,0x96
 *   2f5c  32 e6 80     ld   (0x80e6),a
 *   2f5f  3a 28 80     ld   a,(0x8028)
 *   2f62  3c           inc  a
 *   2f63  fe 04        cp   0x04
 *   2f65  38 02        jr   c,0x2f69
 *   2f67  3e 04        ld   a,0x04
 * loc_2f69:
 *   2f69  ee 07        xor  0x07
 *   2f6b  32 e4 80     ld   (0x80e4),a
 *   2f6e  c3 de 30     jp   0x30de
 */
export function loc_2f2f(m) {
  const { regs, mem } = m;

  // 2f2f  ld a,0x39
  regs.a = 0x39;
  m.step(0x2f31, 7);
  // 2f31  ld (0x80dc),a
  mem.write8(0x80dc, regs.a);
  m.step(0x2f34, 13);
  // 2f34  ld a,0x28
  regs.a = 0x28;
  m.step(0x2f36, 7);
  // 2f36  ld (0x80db),a
  mem.write8(0x80db, regs.a);
  m.step(0x2f39, 13);
  // 2f39  ld a,0x78
  regs.a = 0x78;
  m.step(0x2f3b, 7);
  // 2f3b  ld (0x80de),a
  mem.write8(0x80de, regs.a);
  m.step(0x2f3e, 13);
  // 2f3e  ld a,0xc0
  regs.a = 0xc0;
  m.step(0x2f40, 7);
  // 2f40  ld (0x80dd),a
  mem.write8(0x80dd, regs.a);
  m.step(0x2f43, 13);
  // 2f43  ld a,0x01
  regs.a = 0x01;
  m.step(0x2f45, 7);
  // 2f45  ld (0x80df),a
  mem.write8(0x80df, regs.a);
  m.step(0x2f48, 13);
  // 2f48  ld a,0xfc
  regs.a = 0xfc;
  m.step(0x2f4a, 7);
  // 2f4a  ld (0x80e0),a
  mem.write8(0x80e0, regs.a);
  m.step(0x2f4d, 13);
  // 2f4d  ld a,0x01
  regs.a = 0x01;
  m.step(0x2f4f, 7);
  // 2f4f  ld (0x80e3),a
  mem.write8(0x80e3, regs.a);
  m.step(0x2f52, 13);
  // 2f52  ld (0x80e5),a -- same A (0x01) reused as the second counter's reload
  mem.write8(0x80e5, regs.a);
  m.step(0x2f55, 13);
  // 2f55  ld a,0x00
  regs.a = 0x00;
  m.step(0x2f57, 7);
  // 2f57  ld (0x80e7),a
  mem.write8(0x80e7, regs.a);
  m.step(0x2f5a, 13);
  // 2f5a  ld a,0x96
  regs.a = 0x96;
  m.step(0x2f5c, 7);
  // 2f5c  ld (0x80e6),a
  mem.write8(0x80e6, regs.a);
  m.step(0x2f5f, 13);
  // 2f5f  ld a,(0x8028) -- the level/difficulty counter
  regs.a = mem.read8(0x8028);
  m.step(0x2f62, 13);
  // 2f62  inc a -- (inc8 leaves carry alone; the cp below sets it)
  regs.a = regs.inc8(regs.a);
  m.step(0x2f63, 4);
  // 2f63  cp 0x04 -- carry set iff A < 4
  regs.cp(0x04);
  m.step(0x2f65, 7);
  // 2f65  jr c,0x2f69 -- A<4: skip the cap; A>=4: clamp to 4
  if (regs.fC) {
    m.step(0x2f69, 12); // jr c taken -> loc_2f69
  } else {
    m.step(0x2f67, 7); // jr c NOT taken -- fall into the clamp
    // 2f67  ld a,0x04
    regs.a = 0x04;
    m.step(0x2f69, 7);
  }

  // loc_2f69:
  // 2f69  xor 0x07
  regs.xor(0x07);
  m.step(0x2f6b, 7);
  // 2f6b  ld (0x80e4),a -- the derived animation reload byte
  mem.write8(0x80e4, regs.a);
  m.step(0x2f6e, 13);
  // 2f6e  jp 0x30de -- unconditional tail-jump; loc_30de's ret returns to OUR caller
  m.step(0x30de, 10);
  return m.call(0x30de);
}
