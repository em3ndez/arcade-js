// SPDX-License-Identifier: GPL-3.0-only

/**
 * entry_34f3  (ROM 0x34F3–0x3528) — 54 bytes, 40 instructions.
 *
 *   34f3  21 00 64     ld   hl,0x6400     ; source base (5 objects, stride 0x20)
 *   34f6  11 d0 69     ld   de,0x69d0     ; dest base (4-byte records)
 *   34f9  06 05        ld   b,0x05
 *   34fb  7e           ld   a,(hl)        ; loc_34fb -- occupancy flag (offset 0)
 *   34fc  a7           and  a
 *   34fd  ca 1e 35     jp   z,0x351e      ; empty -> skip copy, still advance
 *   ... non-empty: dest[0..3] = mem[P+3], mem[P+7], mem[P+8], mem[P+5] ...
 *   3516  13           inc  de            ; commit record (16-bit)
 *   3517  3e 1b/85/6f  ld a,0x1b/add a,l/ld l,a ; loc_3517 -- L += 0x1B (net +0x20)
 *   351b  10 de        djnz 0x34fb
 *   351d  c9           ret                ; NORMAL ret (no splice)
 *   351e  3e 05/85/6f/3e 04/83/5f/c3 17 35  loc_351e: L += 5, E += 4, jp 0x3517
 *
 * Translated for completeness; not yet wired into the live dispatcher.
 * Not yet wired into the live dispatcher: only caller is 0x30F6 (entry_30ed,
 * untranslated), nothing in translated src invokes entry_34f3. Calls NOTHING; a
 * normal ret, NOT a stack splice (the draft corrected the assignment on both).
 *
 * A scatter-gather: for each of 5 objects at stride 0x20 from 0x6400, if the
 * occupancy flag (offset 0) is non-zero, gather 4 bytes in the order
 * [+3, +7, +8, +5] into a 4-byte record at 0x69D0+. Offset 0 (the flag) is NOT
 * copied. An EMPTY object still advances both pointers (L by 0x20, DE by 4) so
 * records stay aligned. Object fields not interpreted.
 *
 * POINTER ARITHMETIC (the marquee): source HL advances by `inc l`/
 * `dec l` (8-bit -- L wraps within the page, no carry to H); dest DE advances by
 * three `inc e` (8-bit) then one `inc de` (16-bit, CAN carry). The 8/16-bit mix
 * is load-bearing; using inc de for all four (or inc e for all four) diverges at
 * a page boundary. Latent here (E from 0xD0, no wrap). The empty path advances
 * DE by 8-bit `add a,0x04 / ld e,a` -- same +4, different carry behaviour.
 *
 * Flag-correct ALU primitives (regs.add / inc8 / dec8) used throughout, matching
 * convention (boot.js) -- the inc/dec/add flags are overwritten by `add a,l`
 * (0x3519) before the ret, so behaviour is identical to bare masks, but the
 * escaping ret flags are faithful. `inc de` (0x3516) is the one 16-bit inc and
 * sets no flags: bare `(de+1)&0xffff`.
 */
export function entry_34f3(m) {
  const { regs, mem } = m;

  regs.hl = 0x6400;
  m.step(0x34f6, 10); // ld hl,0x6400
  regs.de = 0x69d0;
  m.step(0x34f9, 10); // ld de,0x69d0
  regs.b = 0x05;
  m.step(0x34fb, 7); // ld b,0x05

  for (;;) {
    // loc_34fb
    regs.a = mem.read8(regs.hl);
    m.step(0x34fc, 7); // ld a,(hl) -- occupancy flag
    regs.and(regs.a); // and a -- sets Z; the jp z below reads it
    m.step(0x34fd, 4); // and a
    if (regs.fZ) {
      // loc_351e -- empty object: skip the copy, advance both pointers by +0x20/+4
      m.step(0x351e, 10); // jp z,0x351e TAKEN
      regs.a = 0x05;
      m.step(0x3520, 7); // ld a,0x05
      regs.add(regs.l);
      m.step(0x3521, 4); // add a,l
      regs.l = regs.a;
      m.step(0x3522, 4); // ld l,a -- L += 5
      regs.a = 0x04;
      m.step(0x3524, 7); // ld a,0x04
      regs.add(regs.e);
      m.step(0x3525, 4); // add a,e
      regs.e = regs.a; // E += 4 (8-bit -- NO carry to D, unlike inc de)
      m.step(0x3526, 4); // ld e,a
      m.step(0x3517, 10); // jp 0x3517
    } else {
      m.step(0x3500, 10); // jp z NOT taken -- non-empty
      // dest[0] = mem[P+3]
      regs.l = regs.inc8(regs.l);
      m.step(0x3501, 4); // inc l
      regs.l = regs.inc8(regs.l);
      m.step(0x3502, 4); // inc l
      regs.l = regs.inc8(regs.l);
      m.step(0x3503, 4); // inc l -- L = P+3
      regs.a = mem.read8(regs.hl);
      m.step(0x3504, 7); // ld a,(hl)
      mem.write8(regs.de, regs.a);
      m.step(0x3505, 7); // ld (de),a -- dest[0]
      // dest[1] = mem[P+7]
      regs.a = 0x04;
      m.step(0x3507, 7); // ld a,0x04
      regs.add(regs.l);
      m.step(0x3508, 4); // add a,l
      regs.l = regs.a; // L = P+7
      m.step(0x3509, 4); // ld l,a
      regs.e = regs.inc8(regs.e);
      m.step(0x350a, 4); // inc e (8-bit)
      regs.a = mem.read8(regs.hl);
      m.step(0x350b, 7); // ld a,(hl)
      mem.write8(regs.de, regs.a);
      m.step(0x350c, 7); // ld (de),a -- dest[1]
      // dest[2] = mem[P+8]
      regs.l = regs.inc8(regs.l);
      m.step(0x350d, 4); // inc l -- L = P+8
      regs.e = regs.inc8(regs.e);
      m.step(0x350e, 4); // inc e
      regs.a = mem.read8(regs.hl);
      m.step(0x350f, 7); // ld a,(hl)
      mem.write8(regs.de, regs.a);
      m.step(0x3510, 7); // ld (de),a -- dest[2]
      // dest[3] = mem[P+5]
      regs.l = regs.dec8(regs.l);
      m.step(0x3511, 4); // dec l
      regs.l = regs.dec8(regs.l);
      m.step(0x3512, 4); // dec l
      regs.l = regs.dec8(regs.l);
      m.step(0x3513, 4); // dec l -- L = P+5
      regs.e = regs.inc8(regs.e);
      m.step(0x3514, 4); // inc e
      regs.a = mem.read8(regs.hl);
      m.step(0x3515, 7); // ld a,(hl)
      mem.write8(regs.de, regs.a);
      m.step(0x3516, 7); // ld (de),a -- dest[3]
      regs.de = (regs.de + 1) & 0xffff; // inc de -- 16-bit, CAN carry to D, sets no flags
      m.step(0x3517, 6); // inc de
    }

    // loc_3517 -- advance L to the next object (net +0x20), loop
    regs.a = 0x1b;
    m.step(0x3519, 7); // ld a,0x1b
    regs.add(regs.l);
    m.step(0x351a, 4); // add a,l
    regs.l = regs.a; // L += 0x1B
    m.step(0x351b, 4); // ld l,a
    regs.djnz();
    m.step(regs.b !== 0 ? 0x34fb : 0x351d, regs.b !== 0 ? 13 : 8); // djnz 0x34fb
    if (regs.b === 0) break;
  }

  m.ret(); // 351d -- NORMAL ret
}
