// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_348b  (ROM 0x348b-0x34d9, The Pit) -- the fourth of four velocity-preset
 * entry points into a shared object-mover tail at 0x3490. Each entry loads a BC
 * velocity pair (C = X delta added to the position byte 0x8086, B = the axis
 * whose bit 0 gates the sprite-orientation update and whose bit 7 selects the
 * mirror) and a direction index D, then converges at 0x3490. This entry,
 * loc_348b, presets BC=0xff00 (C=0x00 = NO X step, B=0xff) and D=0x03. Unlike
 * the other three, loc_348b has NO `jr 0x3490` -- it is the entry immediately
 * above 0x3490 and simply FALLS THROUGH into the shared tail. The other three
 * entries are 0x3476 (BC=0x00ff,D=0), 0x347d (BC=0x0100,D=1) and 0x3484
 * (BC=0x0001,D=2) -- separate routines that jump into the same 0x3490 tail;
 * they are NOT part of loc_348b.
 *
 * Shared tail 0x3490: decrement the frame counter at 0x808b. While it is still
 * non-zero, skip straight to 0x34d2 (position-only update). The frame it reaches
 * zero, reload the counter from 0x8091, store the direction index D to 0x8092,
 * and -- ONLY if bit 0 of B is set -- recompute an orientation/sprite code from
 * (0x8083)+B into E via the (A&0x06) selector (0x17/0x14/0x15/0x16), optionally
 * XOR bit 7 by bit 7 of B, and store it to 0x8084. 0x34d2 (reached on every
 * path) adds C to the position byte 0x8086 and returns.
 *
 * FROM THE loc_348b ENTRY THE SPRITE BRANCH IS LIVE (like loc_347d): B is 0xff,
 * so bit 0 of B is SET -- `bit 0,b` at 0x34a3 clears Z and `jr z,0x34d2` at
 * 0x34a5 is NOT taken, so the orientation recompute at 0x34a7-0x34cf DOES run on
 * the counter-zero frame. But UNLIKE loc_347d, bit 7 of B is also SET (B=0xff):
 * `bit 7,b` at 0x34c9 clears Z, `jr nz,0x34cf` at 0x34cb IS taken, and the
 * `xor 0x80` at 0x34cd is SKIPPED -- the sprite code is stored WITHOUT its bit 7
 * flipped (no mirror). C=0x00 means this entry adds NOTHING to the X position at
 * 0x34d2 -- it only advances the counter/orientation. D=0x03 is the direction
 * index published to 0x8092 on the counter-expiry frame.
 *
 *   ---- alternate entries into the shared tail (separate routines) ----
 *   3476  01 ff 00     ld   bc,0x00ff   ; loc_3476
 *   3479  16 00        ld   d,0x00
 *   347b  18 13        jr   0x3490
 *   347d  01 00 01     ld   bc,0x0100   ; loc_347d
 *   3480  16 01        ld   d,0x01
 *   3482  18 0c        jr   0x3490
 *   3484  01 01 00     ld   bc,0x0001   ; loc_3484
 *   3487  16 02        ld   d,0x02
 *   3489  18 05        jr   0x3490
 * loc_348b:
 *   348b  01 00 ff     ld   bc,0xff00
 *   348e  16 03        ld   d,0x03          ; falls through -- NO jr
 *   ---- shared tail ----
 * loc_3490:
 *   3490  3a 8b 80     ld   a,(0x808b)
 *   3493  3d           dec  a
 *   3494  32 8b 80     ld   (0x808b),a
 *   3497  20 39        jr   nz,0x34d2       ; counter still running -> position only
 *   3499  3a 91 80     ld   a,(0x8091)
 *   349c  32 8b 80     ld   (0x808b),a      ; reload the counter
 *   349f  7a           ld   a,d
 *   34a0  32 92 80     ld   (0x8092),a      ; publish the direction index
 *   34a3  cb 40        bit  0,b
 *   34a5  28 2b        jr   z,0x34d2        ; bit0(B)=0 -> skip sprite update
 *   34a7  3a 83 80     ld   a,(0x8083)
 *   34aa  80           add  a,b
 *   34ab  32 83 80     ld   (0x8083),a
 *   34ae  c6 04        add  a,0x04
 *   34b0  e6 06        and  0x06            ; selector in {0,2,4,6}
 *   34b2  20 02        jr   nz,0x34b6
 *   34b4  1e 17        ld   e,0x17          ; selector 0
 * loc_34b6:
 *   34b6  fe 02        cp   0x02
 *   34b8  20 02        jr   nz,0x34bc
 *   34ba  1e 14        ld   e,0x14          ; selector 2
 * loc_34bc:
 *   34bc  fe 04        cp   0x04
 *   34be  20 02        jr   nz,0x34c2
 *   34c0  1e 15        ld   e,0x15          ; selector 4
 * loc_34c2:
 *   34c2  fe 06        cp   0x06
 *   34c4  20 02        jr   nz,0x34c8
 *   34c6  1e 16        ld   e,0x16          ; selector 6
 * loc_34c8:
 *   34c8  7b           ld   a,e
 *   34c9  cb 78        bit  7,b
 *   34cb  20 02        jr   nz,0x34cf       ; bit7(B)=1 -> keep as-is (no mirror)
 *   34cd  ee 80        xor  0x80            ; else flip bit 7 (mirror the sprite)
 * loc_34cf:
 *   34cf  32 84 80     ld   (0x8084),a
 * loc_34d2:
 *   34d2  3a 86 80     ld   a,(0x8086)
 *   34d5  81           add  a,c
 *   34d6  32 86 80     ld   (0x8086),a      ; advance the X position by C
 *   34d9  c9           ret
 *
 * The Z tested by both `jr nz`/`jr z` at 0x3497/0x34a5 is `dec a`'s / `bit 0,b`'s
 * respectively -- the `ld (nn),a` stores between them touch no flags. In the
 * selector chain, `and 0x06` fixes A to {0,2,4,6} and the three `cp` compares do
 * NOT modify A, so A survives unchanged through 0x34c8's `ld a,e` reload (E, not
 * A, is what each `ld e,n` writes). `add a,0x04`/`add a,b` set flags that only
 * the following `and`/`add` consume. Cycle costs are the Z80's: jr taken 12 / not
 * 7, ret 10, bit n,r 8.
 *
 * MODELLING NOTE. The body is a graph of basic blocks (the loc_* labels) linked
 * by forward jumps and fall-through, so it is driven by a label-dispatch loop
 * exactly like the sibling loc_3484: `next` holds the ROM address of the block to
 * run; each block runs its instructions and ends by returning (ret) or by setting
 * `next`. The loop charges NO T-states -- only m.step does. The 0x3490 tail below
 * is byte-identical to loc_3484's; it is inlined here (not m.call'd) because
 * 0x3490 is not a routine of its own -- it is reachable only by fall-through and
 * `jr` from the four entry points, exactly as the siblings model it. loc_348b's
 * entry block, having no `jr`, falls straight into the 0x3490 case with no jr
 * cycle charged.
 */
export function loc_348b(m) {
  const { regs, mem } = m;

  let next = 0x348b;
  for (;;) {
    switch (next) {
      case 0x348b: {
        regs.bc = 0xff00; m.step(0x348e, 10); // 348b  ld bc,0xff00 -- C=0 (no X step), B=0xff (bit0 set -> sprite live; bit7 set -> no mirror)
        regs.d = 0x03; m.step(0x3490, 7); // 348e  ld d,0x03 -- direction index 3
        next = 0x3490; break; // fall through into 0x3490 (no jr -- no cycle charged)
      }
      case 0x3490: {
        regs.a = mem.read8(0x808b); m.step(0x3493, 13); // 3490  ld a,(0x808b) -- frame counter
        regs.a = regs.dec8(regs.a); m.step(0x3494, 4); // 3493  dec a -- Z set iff it just hit 0
        mem.write8(0x808b, regs.a); m.step(0x3497, 13); // 3494  ld (0x808b),a -- store back (no flags)
        if (regs.fNZ) { m.step(0x34d2, 12); next = 0x34d2; break; } // 3497  jr nz,0x34d2 (taken)
        m.step(0x3499, 7); // 3497  jr nz,0x34d2 (not taken)
        regs.a = mem.read8(0x8091); m.step(0x349c, 13); // 3499  ld a,(0x8091) -- counter reload value
        mem.write8(0x808b, regs.a); m.step(0x349f, 13); // 349c  ld (0x808b),a -- reload the counter
        regs.a = regs.d; m.step(0x34a0, 4); // 349f  ld a,d
        mem.write8(0x8092, regs.a); m.step(0x34a3, 13); // 34a0  ld (0x8092),a -- publish direction index (D=3)
        regs.bit(0, regs.b); m.step(0x34a5, 8); // 34a3  bit 0,b -- Z = !(bit0 of B)
        if (regs.fZ) { m.step(0x34d2, 12); next = 0x34d2; break; } // 34a5  jr z,0x34d2 (not taken; for B=0xff the sprite branch runs)
        m.step(0x34a7, 7); // 34a5  jr z,0x34d2 (not taken -- live from loc_348b, B=0xff)
        regs.a = mem.read8(0x8083); m.step(0x34aa, 13); // 34a7  ld a,(0x8083)
        regs.add(regs.b); m.step(0x34ab, 4); // 34aa  add a,b
        mem.write8(0x8083, regs.a); m.step(0x34ae, 13); // 34ab  ld (0x8083),a
        regs.add(0x04); m.step(0x34b0, 7); // 34ae  add a,0x04
        regs.and(0x06); m.step(0x34b2, 7); // 34b0  and 0x06 -- selector in {0,2,4,6}
        if (regs.fNZ) { m.step(0x34b6, 12); next = 0x34b6; break; } // 34b2  jr nz,0x34b6 (taken)
        m.step(0x34b4, 7); // 34b2  jr nz,0x34b6 (not taken)
        regs.e = 0x17; m.step(0x34b6, 7); // 34b4  ld e,0x17 -- selector 0
        next = 0x34b6; break;
      }
      case 0x34b6: {
        regs.cp(0x02); m.step(0x34b8, 7); // 34b6  cp 0x02 (A unchanged)
        if (regs.fNZ) { m.step(0x34bc, 12); next = 0x34bc; break; } // 34b8  jr nz,0x34bc (taken)
        m.step(0x34ba, 7); // 34b8  jr nz,0x34bc (not taken)
        regs.e = 0x14; m.step(0x34bc, 7); // 34ba  ld e,0x14 -- selector 2
        next = 0x34bc; break;
      }
      case 0x34bc: {
        regs.cp(0x04); m.step(0x34be, 7); // 34bc  cp 0x04 (A unchanged)
        if (regs.fNZ) { m.step(0x34c2, 12); next = 0x34c2; break; } // 34be  jr nz,0x34c2 (taken)
        m.step(0x34c0, 7); // 34be  jr nz,0x34c2 (not taken)
        regs.e = 0x15; m.step(0x34c2, 7); // 34c0  ld e,0x15 -- selector 4
        next = 0x34c2; break;
      }
      case 0x34c2: {
        regs.cp(0x06); m.step(0x34c4, 7); // 34c2  cp 0x06 (A unchanged)
        if (regs.fNZ) { m.step(0x34c8, 12); next = 0x34c8; break; } // 34c4  jr nz,0x34c8 (taken)
        m.step(0x34c6, 7); // 34c4  jr nz,0x34c8 (not taken)
        regs.e = 0x16; m.step(0x34c8, 7); // 34c6  ld e,0x16 -- selector 6
        next = 0x34c8; break;
      }
      case 0x34c8: {
        regs.a = regs.e; m.step(0x34c9, 4); // 34c8  ld a,e -- the chosen orientation code
        regs.bit(7, regs.b); m.step(0x34cb, 8); // 34c9  bit 7,b -- Z = !(bit7 of B)
        if (regs.fNZ) { m.step(0x34cf, 12); next = 0x34cf; break; } // 34cb  jr nz,0x34cf (taken; for B=0xff bit7=1 -> xor SKIPPED)
        m.step(0x34cd, 7); // 34cb  jr nz,0x34cf (not taken)
        regs.xor(0x80); m.step(0x34cf, 7); // 34cd  xor 0x80 -- mirror (flip bit 7) -- DEAD from loc_348b (B bit7 set)
        next = 0x34cf; break;
      }
      case 0x34cf: {
        mem.write8(0x8084, regs.a); m.step(0x34d2, 13); // 34cf  ld (0x8084),a -- store sprite code
        next = 0x34d2; break;
      }
      case 0x34d2: {
        regs.a = mem.read8(0x8086); m.step(0x34d5, 13); // 34d2  ld a,(0x8086) -- X position
        regs.add(regs.c); m.step(0x34d6, 4); // 34d5  add a,c -- advance by the X delta (C=0 here -> unchanged)
        mem.write8(0x8086, regs.a); m.step(0x34d9, 13); // 34d6  ld (0x8086),a
        m.ret(); return; // 34d9  ret
      }
      default:
        throw new Error(
          "loc_348b: dispatch to non-block address 0x" + next.toString(16),
        );
    }
  }
}
