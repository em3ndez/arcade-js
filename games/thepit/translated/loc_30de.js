// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_30de  (ROM 0x30de-0x312c, The Pit) -- seeds a second block of subsystem
 * parameters/counters in work RAM (0x80e8-0x8109), derives one byte PAIR from the
 * level/difficulty counter (0x8028), then TAIL-JUMPS into loc_36fe.
 *
 * This is the tail-jump target of loc_2f2f (0x2f6e `jp 0x30de`), i.e. the second
 * half of the same parameter-seeding pass. It is entirely straight-line: NO
 * branches, so there is exactly one path (317 T).
 *
 * The straight-line block seeds fixed constants:
 *   (0x80e9)=0x09  (0x80e8)=0xec  (0x80eb)=0x23  (0x80ea)=0x04
 *   (0x80f5)=0x01  (0x80f0)=0x01  (0x80f8)=0x04
 *   (0x80fa)=0x09  (0x80fb)=0x04  (0x80f9)=0x00  (0x8106)=0x00
 *   (0x8101)=0x01  (0x8109)=0x05
 * (0x80f0) reuses A=0x01 from the (0x80f5) store; (0x8106) reuses A=0x00 from
 * the (0x80f9) store -- no reload between them.
 *
 * Then it derives the pair (0x80f6)/(0x8107) from bits 1-2 of (0x8028):
 *   B = (0x8028) & 0x06        -- keep only bits 1 and 2 (0,2,4,6)
 *   A = 0x07 - B               -- so the pair runs 0x07,0x05,0x03,0x01 as
 *                                 (0x8028) & 6 = 0,2,4,6
 *   (0x80f6) = (0x8107) = A    -- both bytes get the same derived value
 * B <= 6, so `sub b` never borrows: carry is clear at the tail-jump (N set).
 *
 * Finally `jp 0x36fe` -- an UNCONDITIONAL tail-jump; this routine has NO ret, so
 * loc_36fe's own ret returns to OUR caller. Modelled per the thepit convention
 * (loc_2f2f / loc_02a1 / loc_0066): `m.step(target,10); return m.call(target)`
 * with no trailing m.ret (a call+ret would push a spurious frame and double-pop).
 * A itself is overwritten after the derivation, so at the tail-jump A = 0x05
 * (the last constant loaded, for (0x8109)). Every store is to work RAM (0x80xx/
 * 0x81xx), which takes no write-bus offset.
 * (Role is best-effort from the code; the addresses, constants, arithmetic and
 * control flow are exact.)
 *
 * loc_30de:
 *   30de  3e 09        ld   a,0x09
 *   30e0  32 e9 80     ld   (0x80e9),a
 *   30e3  3e ec        ld   a,0xec
 *   30e5  32 e8 80     ld   (0x80e8),a
 *   30e8  3e 23        ld   a,0x23
 *   30ea  32 eb 80     ld   (0x80eb),a
 *   30ed  3e 04        ld   a,0x04
 *   30ef  32 ea 80     ld   (0x80ea),a
 *   30f2  3e 01        ld   a,0x01
 *   30f4  32 f5 80     ld   (0x80f5),a
 *   30f7  32 f0 80     ld   (0x80f0),a
 *   30fa  3e 04        ld   a,0x04
 *   30fc  32 f8 80     ld   (0x80f8),a
 *   30ff  3a 28 80     ld   a,(0x8028)
 *   3102  e6 06        and  0x06
 *   3104  47           ld   b,a
 *   3105  3e 07        ld   a,0x07
 *   3107  90           sub  b
 *   3108  32 f6 80     ld   (0x80f6),a
 *   310b  32 07 81     ld   (0x8107),a
 *   310e  3e 09        ld   a,0x09
 *   3110  32 fa 80     ld   (0x80fa),a
 *   3113  3e 04        ld   a,0x04
 *   3115  32 fb 80     ld   (0x80fb),a
 *   3118  3e 00        ld   a,0x00
 *   311a  32 f9 80     ld   (0x80f9),a
 *   311d  32 06 81     ld   (0x8106),a
 *   3120  3e 01        ld   a,0x01
 *   3122  32 01 81     ld   (0x8101),a
 *   3125  3e 05        ld   a,0x05
 *   3127  32 09 81     ld   (0x8109),a
 *   312a  c3 fe 36     jp   0x36fe
 */
export function loc_30de(m) {
  const { regs, mem } = m;

  // 30de  ld a,0x09
  regs.a = 0x09;
  m.step(0x30e0, 7);
  // 30e0  ld (0x80e9),a
  mem.write8(0x80e9, regs.a);
  m.step(0x30e3, 13);
  // 30e3  ld a,0xec
  regs.a = 0xec;
  m.step(0x30e5, 7);
  // 30e5  ld (0x80e8),a
  mem.write8(0x80e8, regs.a);
  m.step(0x30e8, 13);
  // 30e8  ld a,0x23
  regs.a = 0x23;
  m.step(0x30ea, 7);
  // 30ea  ld (0x80eb),a
  mem.write8(0x80eb, regs.a);
  m.step(0x30ed, 13);
  // 30ed  ld a,0x04
  regs.a = 0x04;
  m.step(0x30ef, 7);
  // 30ef  ld (0x80ea),a
  mem.write8(0x80ea, regs.a);
  m.step(0x30f2, 13);
  // 30f2  ld a,0x01
  regs.a = 0x01;
  m.step(0x30f4, 7);
  // 30f4  ld (0x80f5),a
  mem.write8(0x80f5, regs.a);
  m.step(0x30f7, 13);
  // 30f7  ld (0x80f0),a -- same A (0x01) reused
  mem.write8(0x80f0, regs.a);
  m.step(0x30fa, 13);
  // 30fa  ld a,0x04
  regs.a = 0x04;
  m.step(0x30fc, 7);
  // 30fc  ld (0x80f8),a
  mem.write8(0x80f8, regs.a);
  m.step(0x30ff, 13);
  // 30ff  ld a,(0x8028) -- the level/difficulty counter
  regs.a = mem.read8(0x8028);
  m.step(0x3102, 13);
  // 3102  and 0x06 -- keep only bits 1 and 2 (H set, N=0, C=0, S/Z/PV from result)
  regs.and(0x06);
  m.step(0x3104, 7);
  // 3104  ld b,a -- B = (0x8028) & 0x06
  regs.b = regs.a;
  m.step(0x3105, 4);
  // 3105  ld a,0x07
  regs.a = 0x07;
  m.step(0x3107, 7);
  // 3107  sub b -- A = 0x07 - B (B<=6 so no borrow; C clear, N set)
  regs.sub(regs.b);
  m.step(0x3108, 4);
  // 3108  ld (0x80f6),a -- derived byte
  mem.write8(0x80f6, regs.a);
  m.step(0x310b, 13);
  // 310b  ld (0x8107),a -- same derived byte, mirrored
  mem.write8(0x8107, regs.a);
  m.step(0x310e, 13);
  // 310e  ld a,0x09
  regs.a = 0x09;
  m.step(0x3110, 7);
  // 3110  ld (0x80fa),a
  mem.write8(0x80fa, regs.a);
  m.step(0x3113, 13);
  // 3113  ld a,0x04
  regs.a = 0x04;
  m.step(0x3115, 7);
  // 3115  ld (0x80fb),a
  mem.write8(0x80fb, regs.a);
  m.step(0x3118, 13);
  // 3118  ld a,0x00
  regs.a = 0x00;
  m.step(0x311a, 7);
  // 311a  ld (0x80f9),a
  mem.write8(0x80f9, regs.a);
  m.step(0x311d, 13);
  // 311d  ld (0x8106),a -- same A (0x00) reused
  mem.write8(0x8106, regs.a);
  m.step(0x3120, 13);
  // 3120  ld a,0x01
  regs.a = 0x01;
  m.step(0x3122, 7);
  // 3122  ld (0x8101),a
  mem.write8(0x8101, regs.a);
  m.step(0x3125, 13);
  // 3125  ld a,0x05
  regs.a = 0x05;
  m.step(0x3127, 7);
  // 3127  ld (0x8109),a
  mem.write8(0x8109, regs.a);
  m.step(0x312a, 13);
  // 312a  jp 0x36fe -- unconditional tail-jump; loc_36fe's ret returns to OUR caller
  m.step(0x36fe, 10);
  return m.call(0x36fe);
}
