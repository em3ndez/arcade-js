// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_4c67  (ROM 0x4C67-0x4CBE) — enqueue command 0x06 into the 8-slot ring at
 * 0x8020, advancing the head pointer at 0x801e (mod 8).
 *
 *   4c67  3e 06        ld   a,0x06        ; this entry's command id
 *   4c69  18 3a        jr   0x4ca5        ; -> shared tail loc_4ca5
 *
 *   ---- loc_4ca5 : the shared enqueue tail (16 sibling entries jr here) ----
 *   4ca5  f6 80        or   0x80          ; set bit 7 -- the "slot full" marker
 *   4ca7  d5           push de
 *   4ca8  e5           push hl
 *   4ca9  57           ld   d,a           ; stash the command byte in D
 *   4caa  3a 1e 80     ld   a,(0x801e)    ; A = head index
 *   4cad  5f           ld   e,a           ; E = head index (the slot to fill)
 *   4cae  3c           inc  a
 *   4caf  e6 07        and  0x07          ; (head+1) mod 8
 *   4cb1  32 1e 80     ld   (0x801e),a    ; store the advanced head
 *   4cb4  21 20 80     ld   hl,0x8020     ; ring base
 *   4cb7  7a           ld   a,d           ; A = command byte again
 *   4cb8  16 00        ld   d,0x00        ; DE = old head index (D=0, E=index)
 *   4cba  19           add  hl,de         ; HL = 0x8020 + old head
 *   4cbb  77           ld   (hl),a        ; write the command into the slot
 *   4cbc  e1           pop  hl
 *   4cbd  d1           pop  de
 *   4cbe  c9           ret
 *
 * WHAT IT DOES: this is the PRODUCER side of a command ring. It writes
 * 0x06 | 0x80 = 0x86 into ring slot 0x8020[head] and bumps the head pointer at
 * 0x801e mod 8. The `or 0x80` sets bit 7 so a filled slot is distinguishable
 * from an empty (0x00) one -- the NMI consumer at loc_0066 dequeues via the
 * tail pointer 0x801f and tests exactly that bit (`bit 7,a`) before acting.
 *
 * ONE OF A 16-ENTRY FAMILY: loc_4c67..sub_4ca3 each `ld a,<id>` (0x06..0x15)
 * and `jr 0x4ca5` into this common tail; sub_4ca3 falls straight through. Only
 * the command id differs, so the tail is inlined here rather than shared as a
 * separate registered routine (nothing outside the family targets loc_4ca5).
 *
 * DE AND HL ARE PRESERVED: the push de / push hl at entry are undone by the
 * pop hl / pop de before the ret, so the caller's DE and HL survive the call.
 * A is left holding the 0x86 command byte, and F holds the `add hl,de` flags.
 */
export function loc_4c67(m) {
  const { regs, mem } = m;

  regs.a = 0x06; // ld a,0x06 -- this entry's command id
  m.step(0x4c69, 7);
  m.step(0x4ca5, 12); // jr 0x4ca5 (unconditional) -> shared tail

  // ---- loc_4ca5 : shared enqueue tail ----
  regs.or(0x80); // or 0x80 -- set the slot-full marker bit 7 -> A = 0x86
  m.step(0x4ca7, 7);
  m.push16(regs.de); // push de -- preserve caller DE
  m.step(0x4ca8, 11);
  m.push16(regs.hl); // push hl -- preserve caller HL
  m.step(0x4ca9, 11);
  regs.d = regs.a; // ld d,a -- stash the command byte
  m.step(0x4caa, 4);
  regs.a = mem.read8(0x801e); // ld a,(0x801e) -- head index
  m.step(0x4cad, 13);
  regs.e = regs.a; // ld e,a -- E = old head (the slot to fill)
  m.step(0x4cae, 4);
  regs.a = regs.inc8(regs.a); // inc a
  m.step(0x4caf, 4);
  regs.and(0x07); // and 0x07 -- wrap the head mod 8
  m.step(0x4cb1, 7);
  mem.write8(0x801e, regs.a); // ld (0x801e),a -- store advanced head
  m.step(0x4cb4, 13);
  regs.hl = 0x8020; // ld hl,0x8020 -- ring base
  m.step(0x4cb7, 10);
  regs.a = regs.d; // ld a,d -- A = command byte again
  m.step(0x4cb8, 4);
  regs.d = 0x00; // ld d,0x00 -- DE = old head index (D=0, E=index)
  m.step(0x4cba, 7);
  regs.addHl(regs.de); // add hl,de -- HL = 0x8020 + old head
  m.step(0x4cbb, 11);
  mem.write8(regs.hl, regs.a); // ld (hl),a -- write command into the slot
  m.step(0x4cbc, 7);
  regs.hl = m.pop16(); // pop hl -- restore caller HL
  m.step(0x4cbd, 10);
  regs.de = m.pop16(); // pop de -- restore caller DE
  m.step(0x4cbe, 10);

  m.ret(); // 4cbe -- 10 T
}
