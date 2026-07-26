// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_4ca5  (ROM 0x4CA5-0x4CBE, The Pit) -- the shared sound-request ENQUEUE tail.
 *
 * Sets bit 7 on the sound-command index already in A (`or 0x80`), then appends that
 * byte to the 8-entry sound ring buffer at 0x8020, indexed by the write pointer at
 * 0x801E. The write uses the CURRENT pointer, then advances it `(0x801E + 1) & 0x07`
 * so the next request lands in the next slot (wrapping after 8). DE and HL are saved
 * and restored, so the routine clobbers only A/F and the two RAM cells it owns.
 *
 * Entered two ways: ~20 sibling stubs at 0x4C1F..0x4CA3 each seed A with a distinct
 * command index and `jr`/fall through into here (e.g. loc_4c9b seeds 0x13, loc_4ca3
 * falls straight in with 0x15). Whatever index is in A on entry becomes 0x80|index in
 * the ring. (Role read from the code; addresses, flags and control flow are exact.)
 *
 *   4ca5  f6 80        or   0x80          ; set bit 7 of the command index in A
 *   4ca7  d5           push de
 *   4ca8  e5           push hl
 *   4ca9  57           ld   d,a           ; stash the command byte in D
 *   4caa  3a 1e 80     ld   a,(0x801e)    ; A = ring write pointer (0..7)
 *   4cad  5f           ld   e,a           ; E = current pointer (the slot to write)
 *   4cae  3c           inc  a
 *   4caf  e6 07        and  0x07          ; wrap the advanced pointer mod 8
 *   4cb1  32 1e 80     ld   (0x801e),a    ; store the advanced pointer
 *   4cb4  21 20 80     ld   hl,0x8020     ; ring base
 *   4cb7  7a           ld   a,d           ; A = the command byte again
 *   4cb8  16 00        ld   d,0x00        ; DE = current pointer (D=0, E=slot)
 *   4cba  19           add  hl,de         ; HL = 0x8020 + slot
 *   4cbb  77           ld   (hl),a        ; ring[slot] = 0x80|index
 *   4cbc  e1           pop  hl
 *   4cbd  d1           pop  de
 *   4cbe  c9           ret
 */
export function loc_4ca5(m) {
  const { regs, mem } = m;

  // 4ca5  or 0x80 -- set bit 7 of the command index (0x13 -> 0x93)
  regs.or(0x80);
  m.step(0x4ca7, 7);
  // 4ca7  push de -- saved across the routine
  m.push16(regs.de);
  m.step(0x4ca8, 11);
  // 4ca8  push hl
  m.push16(regs.hl);
  m.step(0x4ca9, 11);
  // 4ca9  ld d,a -- stash the command byte
  regs.d = regs.a;
  m.step(0x4caa, 4);
  // 4caa  ld a,(0x801e) -- current ring write pointer (0..7)
  regs.a = mem.read8(0x801e);
  m.step(0x4cad, 13);
  // 4cad  ld e,a -- E = the slot to write into (the pre-advance pointer)
  regs.e = regs.a;
  m.step(0x4cae, 4);
  // 4cae  inc a -- advance the pointer (inc8: sets S/Z/H/PV, carry preserved)
  regs.a = regs.inc8(regs.a);
  m.step(0x4caf, 4);
  // 4caf  and 0x07 -- wrap mod 8
  regs.and(0x07);
  m.step(0x4cb1, 7);
  // 4cb1  ld (0x801e),a -- store the advanced+wrapped pointer
  mem.write8(0x801e, regs.a);
  m.step(0x4cb4, 13);
  // 4cb4  ld hl,0x8020 -- sound ring base
  regs.hl = 0x8020;
  m.step(0x4cb7, 10);
  // 4cb7  ld a,d -- recover the command byte into A for the store
  regs.a = regs.d;
  m.step(0x4cb8, 4);
  // 4cb8  ld d,0x00 -- DE = the current slot index (D=0, E=slot)
  regs.d = 0x00;
  m.step(0x4cba, 7);
  // 4cba  add hl,de -- HL = 0x8020 + slot (addHl: only H/N/C, S/Z/PV preserved)
  regs.addHl(regs.de);
  m.step(0x4cbb, 11);
  // 4cbb  ld (hl),a -- ring[slot] = the command byte with bit 7 set
  mem.write8(regs.hl, regs.a);
  m.step(0x4cbc, 7);
  // 4cbc  pop hl -- restore HL
  regs.hl = m.pop16();
  m.step(0x4cbd, 10);
  // 4cbd  pop de -- restore DE
  regs.de = m.pop16();
  m.step(0x4cbe, 10);
  // 4cbe  ret -- back to the sibling stub's caller
  m.ret();
}
