// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_4c57  (ROM 0x4c57-0x4c5a -> shared tail 0x4ca5-0x4cbe, The Pit) —
 * the A=0x02 door of a large fan-in of one-line entry points (loc_4c57..sub_4ca3
 * load A = 0x02..0x15) that all `jr 0x4ca5` into the common tail loc_4ca5. The
 * tail ENQUEUES a command byte — the entry code ORed with 0x80 — into an 8-slot
 * ring buffer at 0x8020, advancing the head index at 0x801e (mod 8), and PRESERVES
 * the caller's DE and HL (it push/pops both). For this door the queued byte is
 * 0x02 | 0x80 = 0x82.
 *
 *   4c57  3e 02        ld   a,0x02      ; this door's command code
 *   4c59  18 4a        jr   0x4ca5      ; unconditional -> shared tail loc_4ca5
 *
 * loc_4ca5: (shared by every loc_4c57..sub_4ca3 entry; sub_4ca3 falls through)
 *   4ca5  f6 80        or   0x80        ; A = code | 0x80  (0x02 -> 0x82)
 *   4ca7  d5           push de          ; preserve caller DE
 *   4ca8  e5           push hl          ; preserve caller HL
 *   4ca9  57           ld   d,a         ; D = command byte
 *   4caa  3a 1e 80     ld   a,(0x801e)  ; A = ring head index
 *   4cad  5f           ld   e,a         ; E = head index (the write offset)
 *   4cae  3c           inc  a
 *   4caf  e6 07        and  0x07        ; (index + 1) mod 8
 *   4cb1  32 1e 80     ld   (0x801e),a  ; store advanced head index
 *   4cb4  21 20 80     ld   hl,0x8020   ; ring buffer base
 *   4cb7  7a           ld   a,d         ; A = command byte again
 *   4cb8  16 00        ld   d,0x00      ; DE = 0x00:index  (uses the OLD index)
 *   4cba  19           add  hl,de       ; HL = 0x8020 + old index
 *   4cbb  77           ld   (hl),a      ; ring[old index] = command byte
 *   4cbc  e1           pop  hl          ; restore caller HL
 *   4cbd  d1           pop  de          ; restore caller DE
 *   4cbe  c9           ret
 *
 * The write uses the ORIGINAL head index (kept in E), while 0x801e is advanced to
 * (index+1)&7 — a classic single-producer ring enqueue. Because DE and HL are
 * push/popped around the body, the only lasting effects are: the ring slot write,
 * the head-index bump, and A = the queued command byte (D/E are clobbered mid-body
 * but restored; the flags are whatever `add hl,de` leaves).
 *
 * The `jr 0x4ca5` is an in-routine continuation into a shared tail that ends in
 * its own `ret`, so the tail is INLINED here (exactly as sibling loc_4c5b inlines
 * it) and the routine ends with m.ret — NOT `return m.call(0x4ca5)`, since 0x4ca5
 * is an internal label (the fall-through body of sub_4ca3), not a registered
 * routine. Calling it would throw "no routine at 0x4ca5" and drop command 0x02.
 */
export function loc_4c57(m) {
  const { regs, mem } = m;

  regs.a = 0x02; // 4c57  ld a,0x02 -- this door's command code
  m.step(0x4c59, 7);

  m.step(0x4ca5, 12); // 4c59  jr 0x4ca5 -- unconditional, into the shared tail

  // loc_4ca5: shared enqueue tail (A = command code on entry; 0x02 for this door).
  regs.or(0x80); // 4ca5  or 0x80 -- A = code | 0x80 (0x82)
  m.step(0x4ca7, 7);

  m.push16(regs.de); // 4ca7  push de -- preserve caller DE
  m.step(0x4ca8, 11);

  m.push16(regs.hl); // 4ca8  push hl -- preserve caller HL
  m.step(0x4ca9, 11);

  regs.d = regs.a; // 4ca9  ld d,a -- stash the command byte in D
  m.step(0x4caa, 4);

  regs.a = mem.read8(0x801e); // 4caa  ld a,(0x801e) -- ring head index
  m.step(0x4cad, 13);

  regs.e = regs.a; // 4cad  ld e,a -- E = old head index (the write offset)
  m.step(0x4cae, 4);

  regs.a = regs.inc8(regs.a); // 4cae  inc a
  m.step(0x4caf, 4);

  regs.and(0x07); // 4caf  and 0x07 -- (index + 1) mod 8
  m.step(0x4cb1, 7);

  mem.write8(0x801e, regs.a); // 4cb1  ld (0x801e),a -- store advanced head index
  m.step(0x4cb4, 13);

  regs.hl = 0x8020; // 4cb4  ld hl,0x8020 -- ring buffer base
  m.step(0x4cb7, 10);

  regs.a = regs.d; // 4cb7  ld a,d -- A = command byte again
  m.step(0x4cb8, 4);

  regs.d = 0x00; // 4cb8  ld d,0x00 -- DE = 0x00:old-index
  m.step(0x4cba, 7);

  regs.addHl(regs.de); // 4cba  add hl,de -- HL = 0x8020 + old index
  m.step(0x4cbb, 11);

  mem.write8(regs.hl, regs.a); // 4cbb  ld (hl),a -- ring[old index] = command byte
  m.step(0x4cbc, 7);

  regs.hl = m.pop16(); // 4cbc  pop hl -- restore caller HL
  m.step(0x4cbd, 10);

  regs.de = m.pop16(); // 4cbd  pop de -- restore caller DE
  m.step(0x4cbe, 10);

  m.ret(); // 4cbe  ret
}
