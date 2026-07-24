// SPDX-License-Identifier: GPL-3.0-only
/**
 * entry_2913 — hand-optimized rewrite of the translated routine at ROM 0x2913,
 * proven equal to its oracle by the equivalence harness. A read-only collision query over
 * IX object records; it writes no work RAM and names none.
 */

/**
 * entry_2913 -- proximity/collision test: is the IY subject inside any active IX record's
 * box?  [ROM 0x2913-0x2954]
 *
 * Eight callers (wrappers like sub_2a22 that preset B/DE/IX). It walks B records at stride
 * DE from IX, and for each ACTIVE one (bit 0 of ix+0x00 set) tests whether the subject's
 * position falls inside the record's box:
 *   - X: |C - (ix+5)| + 1, compared against L (near span) then (ix+0x0A) (far span),
 *   - Y: |(iy+3) - (ix+3)|, compared against H then (ix+0x09).
 * `neg` forms the absolute difference; `sub`/carry do the span comparisons.
 *
 * THE EXITS FOLLOW THE sub_0008 SKIP CONVENTION:
 *   - HIT (0x2945): A=1, restore IX, then `inc sp` TWICE to DISCARD this routine's own
 *     return address and `ret` to the CALLER'S CALLER -- returns `false` (SKIPPED).
 *   - list exhausted (0x2950): A=0, restore IX, normal `ret` -- returns `true` (NORMAL).
 * Callers branch on that boolean (`if (!m.call(0x2913)) { ... }`), so the return value is
 * load-bearing and reproduced exactly.
 *
 * The `bit 0,(ix+0x00)` uses the indexed-addressing F3/F5 source (the effective-address
 * high byte, cpu.js's third `bit` argument), not the operand -- preserved verbatim.
 *
 * CYCLES -- COLLAPSED to one m.step per basic block (the per-instruction charges of each
 * straight-line run folded into a single charge at the block's exit PC); every block total
 * below is the exact SUM of the oracle's per-instruction charges for that block (verified
 * against the ROM comment above): bit+jpz 30 t; ld-a,c+sub+jpnc 33 t; neg 8 t (its own block --
 * 0x2925 is a jump target); inc-a+sub-l+jpc 18 t; sub+jpnc 29 t; ld+sub+jpnc 48 t; neg 8 t
 * (0x293b is a jump target); sub-h+jpc 14 t; sub+jpnc 29 t; the HIT tail (ld a,1 + pop ix +
 * inc sp x2) 33 t before `m.ret()`; add-ix,de+djnz 28 t (taken) / 23 t (not taken); the
 * exhausted tail (xor a + pop ix) 18 t before `m.ret()`. `m.ret()` charges its own 10 t
 * internally (machine.js), so it is never folded into a preceding block's total. It
 * manipulates SP directly (the HIT exit's double `inc sp`, discarding this routine's own
 * return address) -- that stack mechanic is reproduced exactly, unchanged by the collapse;
 * only the m.step charge GRANULARITY changed.
 */
export function entry_2913(m) {
  const { regs, mem } = m;

  m.push16(regs.ix); // push ix -- OUTSIDE the loop (djnz targets 0x2915)
  m.step(0x2915, 15);

  for (;;) {
    // `advance` = the ROM's 0x294C target: every "not a match" jump lands there.
    advance: {
      // Block: bit 0,(ix+0x00) [20] + jp z,0x294c [10] = 30 t
      const ea2915 = (regs.ix + 0x00) & 0xffff;
      regs.bit(0, mem.read8(ea2915), (ea2915 >> 8) & 0xff); // F3/F5 from EA high byte
      if (regs.fZ) {
        m.step(0x294c, 30); // slot inactive
        break advance;
      }
      m.step(0x291c, 30);

      // Block: ld a,c [4] + sub (ix+0x05) [19] + jp nc,0x2925 [10] = 33 t
      regs.a = regs.c;
      regs.sub(mem.read8((regs.ix + 0x05) & 0xffff));
      if (regs.fNC) {
        m.step(0x2925, 33);
      } else {
        m.step(0x2923, 33);
        regs.neg();
        m.step(0x2925, 8); // absolute difference -- lone instr: 0x2925 is a jump target
      }

      // Block: inc a [4] + sub l [4] + jp c,0x2930 [10] = 18 t
      regs.a = regs.inc8(regs.a);
      regs.sub(regs.l);
      if (regs.fC) {
        m.step(0x2930, 18); // within the near span
      } else {
        m.step(0x292a, 18);
        // Block: sub (ix+0x0a) [19] + jp nc,0x294c [10] = 29 t
        regs.sub(mem.read8((regs.ix + 0x0a) & 0xffff));
        if (regs.fNC) {
          m.step(0x294c, 29); // out of range
          break advance;
        }
        m.step(0x2930, 29);
      }

      // Block: ld a,(iy+3) [19] + sub (ix+3) [19] + jp nc,0x293b [10] = 48 t
      regs.a = mem.read8((regs.iy + 0x03) & 0xffff);
      regs.sub(mem.read8((regs.ix + 0x03) & 0xffff));
      if (regs.fNC) {
        m.step(0x293b, 48);
      } else {
        m.step(0x2939, 48);
        regs.neg();
        m.step(0x293b, 8); // absolute difference -- lone instr: 0x293b is a jump target
      }

      // Block: sub h [4] + jp c,0x2945 [10] = 14 t
      regs.sub(regs.h);
      if (regs.fC) {
        m.step(0x2945, 14); // HIT
      } else {
        m.step(0x293f, 14);
        // Block: sub (ix+0x09) [19] + jp nc,0x294c [10] = 29 t
        regs.sub(mem.read8((regs.ix + 0x09) & 0xffff));
        if (regs.fNC) {
          m.step(0x294c, 29); // out of range
          break advance;
        }
        m.step(0x2945, 29); // falls into the HIT exit
      }

      // ---- 0x2945 HIT: A=1, restore IX, DISCARD our return address, ret ----
      // Block: ld a,0x01 [7] + pop ix [14] + inc sp [6] + inc sp [6] = 33 t
      regs.a = 0x01;
      regs.ix = m.pop16();
      regs.sp = (regs.sp + 1) & 0xffff; // inc sp
      regs.sp = (regs.sp + 1) & 0xffff; // inc sp -- our return address is now discarded
      m.step(0x294b, 33);
      m.ret(); // ret -> the CALLER'S CALLER
      return false; // SKIPPED (sub_0008 convention)
    }

    // ---- 0x294C: advance to the next record and loop ----
    // Block: add ix,de [15] + djnz [13 taken / 8 not taken]
    regs.addIx(regs.de);
    regs.djnz();
    m.step(regs.b !== 0 ? 0x2915 : 0x2950, regs.b !== 0 ? 28 : 23);
    if (regs.b === 0) break;
  }

  // ---- 0x2950: list exhausted -- A=0, restore IX, NORMAL return ----
  // Block: xor a [4] + pop ix [14] = 18 t
  regs.xor(regs.a);
  regs.ix = m.pop16();
  m.step(0x2953, 18);
  m.ret(); // ret -> the caller
  return true; // returned NORMALLY (sub_0008 convention)
}
