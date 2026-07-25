// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_32d6  (ROM 0x32D6–0x330E) — 57 bytes, 20 instructions.
 *
 *   32d6  dd 7e 1c     ld   a,(ix+0x1c)
 *   32d9  fe 00        cp   0x00
 *   32db  c2 fd 32     jp   nz,0x32fd
 *   32de  dd 7e 1d     ld   a,(ix+0x1d)
 *   32e1  fe 01        cp   0x01
 *   32e3  c2 0b 33     jp   nz,0x330b
 *   32e6  dd 36 1d 00  ld   (ix+0x1d),0x00
 *   32ea  3a 05 62     ld   a,(0x6205)
 *   32ed  dd 46 0f     ld   b,(ix+0x0f)
 *   32f0  90           sub  b               ; carry = UNSIGNED borrow
 *   32f1  da 03 33     jp   c,0x3303
 *   32f4  dd 36 1c ff  ld   (ix+0x1c),0xff  ; reload counter
 *   32f8  dd 36 0d 00  ld   (ix+0x0d),0x00  ; loc_32f8 (JOIN)
 *   32fc  c9           ret
 *   32fd  dd 35 1c     dec  (ix+0x1c)       ; loc_32fd
 *   3300  c2 f8 32     jp   nz,0x32f8       ; READS the dec's Z flag
 *   3303  dd 36 19 00  ld   (ix+0x19),0x00  ; loc_3303 (JOIN)
 *   3307  dd 36 1c 00  ld   (ix+0x1c),0x00
 *   330b  cd 0f 33     call 0x330f          ; loc_330b (JOIN)
 *   330e  c9           ret
 *
 * Translated for completeness; not yet wired into the live dispatcher.
 * Not yet wired into the live dispatcher: called from 0x327E (entry_3202, untranslated).
 * Unblocked by drain #14 (its only callee, entry_330f). IX live-in.
 *
 * An object down-counter with reload: (ix+0x1c) counts down; on reaching 0 (or
 * when armed via (ix+0x1d) == 1) it compares 0x6205 against (ix+0x0f), then
 * either reloads (ix+0x1c) to 0xFF or zeroes (ix+0x19)/(ix+0x1c), and calls
 * entry_330f. Object fields / 0x6205 not interpreted.
 *
 * THIS IS THE CASE THE SHARED PRIMITIVE WAS BUILT FOR. `dec (ix+0x1c)` at 0x32FD
 * is a memory RMW whose Z flag is READ by the `jp nz` at 0x3300 -- the first
 * consumer where dropping the flags changes CONTROL FLOW rather than leaving a
 * dead flag. regs.decMem8 sets S/Z/H/PV (carry preserved); the open-coded
 * `(v-1)&0xff` would leave the branch reading a STALE Z from the earlier
 * `cp 0x00`, which is always NZ on this path -- so the counter would never take
 * the hit-zero branch. Pinned by TEST 3.
 *
 * `sub b` (0x32F0) sets carry as the UNSIGNED borrow (A < (ix+0x0f)), read by
 * `jp c` -- regs.sub, not a bare subtraction.
 *
 * Three joins are written out inline because the ROM reaches them from multiple
 * predecessors: loc_32f8 (no-borrow fall-through and the jp nz), loc_3303 (jp c
 * and the dec-hit-zero fall-through), loc_330b (jp nz at 0x32E3 and the 0x3303
 * fall-through). Each copy emits the identical step sequence.
 */
export function sub_32d6(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;

  // loc_330b -- call 0x330f then ret; reached from two predecessors.
  const tail_330b = () => {
    m.push16(0x330e);
    m.step(0x330f, 17); // call 0x330f
    m.call(0x330f);
    m.ret(); // 330e
  };
  // loc_3303 -- zero two fields, then fall into loc_330b.
  const tail_3303 = () => {
    mem.write8(R(0x19), 0x00);
    m.step(0x3307, 19); // ld (ix+0x19),0x00
    mem.write8(R(0x1c), 0x00);
    m.step(0x330b, 19); // ld (ix+0x1c),0x00
    tail_330b();
  };

  regs.a = mem.read8(R(0x1c));
  m.step(0x32d9, 19); // ld a,(ix+0x1c)
  regs.cp(0x00);
  m.step(0x32db, 7); // cp 0x00
  if (regs.fNZ) {
    // loc_32fd -- counter non-zero: decrement it
    m.step(0x32fd, 10); // jp nz,0x32fd TAKEN
    regs.decMem8(mem, R(0x1c)); // dec (ix+0x1c) -- SETS the Z the jp nz reads
    m.step(0x3300, 23); // dec (ix+0x1c)
    if (regs.fNZ) {
      // loc_32f8 -- still counting
      m.step(0x32f8, 10); // jp nz,0x32f8 TAKEN
      mem.write8(R(0x0d), 0x00);
      m.step(0x32fc, 19); // ld (ix+0x0d),0x00
      m.ret(); // 32fc
      return;
    }
    m.step(0x3303, 10); // jp nz NOT taken -- counter hit zero, fall into loc_3303
    tail_3303();
    return;
  }
  m.step(0x32de, 10); // jp nz NOT taken -- counter already zero

  regs.a = mem.read8(R(0x1d));
  m.step(0x32e1, 19); // ld a,(ix+0x1d)
  regs.cp(0x01);
  m.step(0x32e3, 7); // cp 0x01
  if (regs.fNZ) {
    m.step(0x330b, 10); // jp nz,0x330b TAKEN -- not armed
    tail_330b();
    return;
  }
  m.step(0x32e6, 10); // jp nz NOT taken -- armed ((ix+0x1d) == 1)

  mem.write8(R(0x1d), 0x00);
  m.step(0x32ea, 19); // ld (ix+0x1d),0x00
  regs.a = mem.read8(0x6205);
  m.step(0x32ed, 13); // ld a,(0x6205)
  regs.b = mem.read8(R(0x0f));
  m.step(0x32f0, 19); // ld b,(ix+0x0f)
  regs.sub(regs.b); // sub b -- carry = unsigned borrow
  m.step(0x32f1, 4); // sub b
  if (regs.fC) {
    m.step(0x3303, 10); // jp c,0x3303 TAKEN -- borrow
    tail_3303();
    return;
  }
  m.step(0x32f4, 10); // jp c NOT taken -- no borrow

  mem.write8(R(0x1c), 0xff);
  m.step(0x32f8, 19); // ld (ix+0x1c),0xff -- reload
  mem.write8(R(0x0d), 0x00);
  m.step(0x32fc, 19); // ld (ix+0x0d),0x00
  m.ret(); // 32fc
}
