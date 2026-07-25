// SPDX-License-Identifier: GPL-3.0-only

/**
 * entry_3009  (ROM 0x3009–0x3049) — 65 bytes, 40 instructions.
 *
 *   3009  57           ld   d,a          ; save the input in D
 *   300a  0f           rrca
 *   300b  da 22 30     jp   c,0x3022
 *   300e  0e 93        ld   c,0x93
 *   3010  0f           rrca
 *   3011  0f           rrca
 *   3012  d2 17 30     jp   nc,0x3017
 *   3015  0e 6c        ld   c,0x6c
 *   3017  07           rlca                ; loc_3017
 *   3018  da 31 30     jp   c,0x3031
 *   301b  79           ld   a,c
 *   301c  e6 f0        and  0xf0
 *   301e  4f           ld   c,a
 *   301f  c3 31 30     jp   0x3031
 *   3022  0e b4        ld   c,0xb4          ; entry_3022 -- INTERIOR label, see below
 *   3024  0f           rrca
 *   3025  0f           rrca
 *   3026  d2 2b 30     jp   nc,0x302b
 *   3029  0e 1e        ld   c,0x1e
 *   302b  cb 50        bit  2,b             ; loc_302b
 *   302d  ca 31 30     jp   z,0x3031
 *   3030  05           dec  b
 *   3031  79           ld   a,c             ; loc_3031 -- 3-way JOIN + LOOP HEAD
 *   3032  0f           rrca
 *   3033  0f           rrca
 *   3034  4f           ld   c,a
 *   3035  e6 03        and  0x03
 *   3037  b8           cp   b
 *   3038  c2 31 30     jp   nz,0x3031       ; loop while low2(C ror 2) != B
 *   303b  79           ld   a,c
 *   303c  0f           rrca
 *   303d  0f           rrca
 *   303e  e6 03        and  0x03
 *   3040  fe 03        cp   0x03
 *   3042  c0           ret  nz
 *   3043  cb 92        res  2,d
 *   3045  15           dec  d
 *   3046  c0           ret  nz
 *   3047  3e 04        ld   a,0x04
 *   3049  c9           ret
 *
 * Translated for completeness; not yet wired into the live dispatcher. Its
 * three call sites (0x1C9E, 0x1CBA, 0x23F4) all live in the untranslated
 * 1977 subtree.
 *
 * A and B are LIVE-IN. D holds the ORIGINAL input across the whole routine
 * (`ld d,a` at 0x3009, then nothing writes D until `res 2,d`/`dec d` at the
 * exit) -- a reuse of D in between would corrupt the exit test.
 *
 * WHAT IT DOES (mechanism only; the constants 0x93/0x6C/0xB4/0x1E are data I did
 * not interpret):
 *   0x3009-0x3030  bit-extract dispatch. rrca/rlca rotate the input; each
 *                  `jp c`/`jp nc` reads the ROTATE'S CARRY-OUT to select one of
 *                  the C constants. rrca/rlca MUST set carry from the rotated-out
 *                  bit (regs.rrca/rlca do); a plain >>/<< breaks every branch.
 *   0x3031-0x3038  the rotate-to-match LOOP. `ld a,c / rrca rrca / ld c,a` sets
 *                  C = C ror 2 each pass; `and 0x03 / cp b` stops when C's low
 *                  two bits equal B. rrca rrca is an 8-bit ror-by-2, so after 4
 *                  passes C returns to its start: the loop scans C's four 2-bit
 *                  fields for a match to B.
 *   0x303b-0x3049  two-stage exit. (C ror 2)&3 vs 3: `ret nz` returns early with
 *                  A = that value and CARRY from `cp 0x03` (0x23F7 reads it with
 *                  `rra`). Otherwise clear bit 2 of the saved input, `dec d`;
 *                  `ret nz` if non-zero, else return A = 0x04.
 *
 * FAITHFUL NON-TERMINATION: if no 2-bit field of C equals B, the
 * loop never terminates. B is live-in (and `dec`'d at 0x3030 on the bit-2 path).
 * A `for(;;)` reproduces the ROM's own hang exactly. NO iteration guard is
 * added -- the ROM has none, and a `for(i<4)` cap would silently turn the hang
 * into a wrong-but-terminating result, invisible to every terminating input.
 *
 * `res 2,d` (0x3043) is now expressible: cpu.js gained `res`/`set` in b7f5da0
 * (the draft predated it and marked this line the sole blocker). regs.res leaves
 * ALL flags unchanged, which matters here: `dec d` at 0x3045 sets the Z that the
 * `ret nz` at 0x3046 reads, so a res that clobbered a flag would be a
 * compensating-error shape -- correct D, corrupt control flow.
 *
 * `entry_3022` is an INTERIOR label despite the `entry_` prefix (a tracer
 * artifact: a run boundary observed mid-routine). Its only reference is the
 * `jp c,0x3022` at 0x300B -- no call, no external jp, no table slot. Likewise
 * loc_3017 and loc_3031 are purely internal; 0x3031 is a 3-way forward join
 * (0x3018/0x301F/0x302D) AND the loop back-edge (0x3038).
 *
 * STEP TARGET: `cp b` at 0x3037 is one byte, so its next instruction is 0x3038;
 * `m.step(0x3038, 4)` -- NOT the jp's destination (0x303B/0x3031), which would
 * skip the `jp nz` at 0x3038. Both are valid instruction boundaries, so the
 * correct target was confirmed by hand-auditing every step against the listing.
 */
export function entry_3009(m) {
  const { regs } = m;

  regs.d = regs.a; // save the input; D is untouched until the exit test
  m.step(0x300a, 4); // ld d,a
  regs.rrca();
  m.step(0x300b, 4); // rrca -- carry = old bit 0

  if (regs.fC) {
    m.step(0x3022, 10); // jp c,0x3022 TAKEN
    regs.c = 0xb4;
    m.step(0x3024, 7); // ld c,0xb4
    regs.rrca();
    m.step(0x3025, 4); // rrca
    regs.rrca();
    m.step(0x3026, 4); // rrca
    if (regs.fNC) {
      m.step(0x302b, 10); // jp nc,0x302b TAKEN
    } else {
      m.step(0x3029, 10); // jp nc,0x302b NOT taken -- fall through
      regs.c = 0x1e;
      m.step(0x302b, 7); // ld c,0x1e
    }
    // loc_302b
    regs.bit(2, regs.b); // sets Z = !bit2(B); B is unchanged
    m.step(0x302d, 8); // bit 2,b
    if (regs.fZ) {
      m.step(0x3031, 10); // jp z,0x3031 TAKEN -> join
    } else {
      m.step(0x3030, 10); // jp z,0x3031 NOT taken -- fall through
      regs.b = regs.dec8(regs.b);
      m.step(0x3031, 4); // dec b -- the loop matches against B-1 on this path
    }
  } else {
    m.step(0x300e, 10); // jp c,0x3022 NOT taken -- fall through
    regs.c = 0x93;
    m.step(0x3010, 7); // ld c,0x93
    regs.rrca();
    m.step(0x3011, 4); // rrca
    regs.rrca();
    m.step(0x3012, 4); // rrca
    if (regs.fC) {
      m.step(0x3015, 10); // jp nc,0x3017 NOT taken -- fall through
      regs.c = 0x6c;
      m.step(0x3017, 7); // ld c,0x6c
    } else {
      m.step(0x3017, 10); // jp nc,0x3017 TAKEN
    }
    // loc_3017
    regs.rlca();
    m.step(0x3018, 4); // rlca -- carry = old bit 7
    if (regs.fC) {
      m.step(0x3031, 10); // jp c,0x3031 TAKEN -> join
    } else {
      m.step(0x301b, 10); // jp c,0x3031 NOT taken -- fall through
      regs.a = regs.c;
      m.step(0x301c, 4); // ld a,c
      regs.and(0xf0);
      m.step(0x301e, 7); // and 0xf0
      regs.c = regs.a;
      m.step(0x301f, 4); // ld c,a
      m.step(0x3031, 10); // jp 0x3031 -> join
    }
  }

  // loc_3031 -- 3-way JOIN and LOOP HEAD. Rotate C right 2 per pass; stop when
  // its low 2 bits equal B. FAITHFUL non-termination if no field of C matches B.
  for (;;) {
    regs.a = regs.c;
    m.step(0x3032, 4); // ld a,c
    regs.rrca();
    m.step(0x3033, 4); // rrca
    regs.rrca();
    m.step(0x3034, 4); // rrca -- A = C ror 2
    regs.c = regs.a;
    m.step(0x3035, 4); // ld c,a
    regs.and(0x03);
    m.step(0x3037, 7); // and 0x03 -- A = (C ror 2) & 3
    regs.cp(regs.b);
    m.step(0x3038, 4); // cp b -- next instr is the jp nz at 0x3038 (STEP FIX)
    if (regs.fNZ) {
      m.step(0x3031, 10); // jp nz,0x3031 TAKEN -- loop back
      continue;
    }
    m.step(0x303b, 10); // jp nz,0x3031 NOT taken -- fall through, C holds the match
    break;
  }

  regs.a = regs.c;
  m.step(0x303c, 4); // ld a,c
  regs.rrca();
  m.step(0x303d, 4); // rrca
  regs.rrca();
  m.step(0x303e, 4); // rrca -- A = C ror 2
  regs.and(0x03);
  m.step(0x3040, 7); // and 0x03
  regs.cp(0x03);
  m.step(0x3042, 7); // cp 0x03
  if (regs.fNZ) {
    m.ret(11); // ret nz TAKEN -- returns A = (C ror 2)&3, CARRY from `cp 0x03`
    return;
  }
  m.step(0x3043, 5); // ret nz NOT taken -- fall through

  regs.d = regs.res(2, regs.d); // res 2,d -- clear bit 2 of the saved input; NO flags
  m.step(0x3045, 8); // res 2,d
  regs.d = regs.dec8(regs.d);
  m.step(0x3046, 4); // dec d -- sets the Z the next ret nz reads
  if (regs.fNZ) {
    m.ret(11); // ret nz TAKEN
    return;
  }
  m.step(0x3047, 5); // ret nz NOT taken -- fall through

  regs.a = 0x04;
  m.step(0x3049, 7); // ld a,0x04
  m.ret(); // 3049 -- returns A = 0x04
}
