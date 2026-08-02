// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_333d  (ROM 0x333D–0x33A0) — movement/collision state machine on (ix+0x0d).
 *
 *   333d  dd 7e 0d     ld   a,(ix+0x0d)
 *   3340  fe 08        cp   0x08
 *   3342  ca 71 33     jp   z,0x3371       ; state 8 -> entry_3371
 *   3345  fe 04        cp   0x04
 *   3347  ca 8a 33     jp   z,0x338a       ; state 4 -> loc_338a
 *   334a  cd a1 33     call 0x33a1         ; MAY SPLICE (skip-capable) -- guarded
 *   334d  dd 7e 0f     ld   a,(ix+0x0f)
 *   3350  c6 08        add  a,0x08
 *   3352  57           ld   d,a            ; D = (ix+0x0f)+8
 *   3353  dd 7e 0e     ld   a,(ix+0x0e)    ; A = (ix+0x0e) (search key)
 *   3356  01 15 00     ld   bc,0x0015
 *   3359  cd 6e 23     call 0x236e         ; MISS-UNWINDS (skip-capable) -- guarded
 *   335c  a7           and  a
 *   335d  ca 99 33     jp   z,0x3399       ; 236e result A==0 -> entry_3399
 *   3360  dd 70 1f     ld   (ix+0x1f),b
 *   3363  3a 05 62     ld   a,(0x6205)
 *   3366  47           ld   b,a
 *   3367  dd 7e 0f     ld   a,(ix+0x0f)
 *   336a  90           sub  b
 *   336b  d0           ret  nc             ; (ix+0x0f) >= (0x6205) -> stay
 *   336c  dd 36 0d 04  ld   (ix+0x0d),0x04 ; else advance to state 4
 *   3370  c9           ret
 *   3371  dd 7e 0f     ld   a,(ix+0x0f)    ; entry_3371 (state 8)
 *   3374  c6 08        add  a,0x08
 *   3376  dd 46 1f     ld   b,(ix+0x1f)
 *   3379  b8           cp   b
 *   337a  c0           ret  nz             ; not at target -> wait
 *   337b  dd 36 0d 00  ld   (ix+0x0d),0x00 ; reached -> state 0
 *   337f  dd 7e 19     ld   a,(ix+0x19)
 *   3382  fe 02        cp   0x02
 *   3384  c0           ret  nz
 *   3385  dd 36 1d 01  ld   (ix+0x1d),0x01 ; (ix+0x19)==2 tail (entry_3371 ONLY)
 *   3389  c9           ret
 *   338a  dd 7e 0f     ld   a,(ix+0x0f)    ; loc_338a (state 4) -- twin, no tail
 *   338d  c6 08        add  a,0x08
 *   338f  dd 46 1f     ld   b,(ix+0x1f)
 *   3392  b8           cp   b
 *   3393  c0           ret  nz
 *   3394  dd 36 0d 00  ld   (ix+0x0d),0x00
 *   3398  c9           ret
 *   3399  dd 70 1f     ld   (ix+0x1f),b    ; entry_3399 (236e A==0)
 *   339c  dd 36 0d 08  ld   (ix+0x0d),0x08
 *   33a0  c9           ret
 *
 * Translated for completeness; not yet wired into the live dispatcher.
 * Not yet wired into the live dispatcher: called from 0x3230 (entry_3202, untranslated);
 * nothing in translated src invokes loc_333d. IX live-in. A 3-way state machine
 * on (ix+0x0d): 8 -> entry_3371, 4 -> loc_338a, else -> the movement path.
 *
 * TWO SKIP-CAPABLE MOVEMENT-PATH CALLEES, both boolean-guarded:
 *   0x334A call sub_33a1 (mine) -- a rst-0x30 dispatcher that, on (ix+0x0f) < 0x59,
 *     does `inc sp / inc sp / ret` and unwinds to loc_333d's CALLER, returning
 *     false. Guard: `if (!m.call(0x33a1)) return;`.
 *  0x3359 call sub_236e (< 0x3000) -- on its cpir-miss path does
 *     `pop hl / ret` at 0x239A and unwinds to loc_333d's CALLER, returning
 *     false. Guard: `if (!m.call(0x236e)) return;`. On the FOUND path it returns
 *     A (0/1, steering the `and a / jp z`) and B (stored to (ix+0x1f)).
 * A plain call at either site would let this JS keep running after the machine
 * already returned to entry_3202 -- double execution, the 216d defect class.
 *
 * entry_3371 and loc_338a are NEAR-IDENTICAL (both: (ix+0x0f)+8 cp (ix+0x1f) /
 * ret nz / (ix+0x0d)=0); entry_3371 alone adds the (ix+0x19)==2 -> (ix+0x1d)=1
 * tail -- written from their own bytes, not copied. Interior labels reached only
 * by internal jp z. Object fields / 0x6205 / movement semantics not interpreted.
 */
export function loc_333d(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;

  regs.a = mem.read8(R(0x0d));
  m.step(0x3340, 19); // ld a,(ix+0x0d)
  regs.cp(0x08);
  m.step(0x3342, 7); // cp 0x08
  if (regs.fZ) {
    // entry_3371 -- (ix+0x0d) == 8
    m.step(0x3371, 10); // jp z,0x3371 taken
    regs.a = mem.read8(R(0x0f));
    m.step(0x3374, 19); // ld a,(ix+0x0f)
    regs.add(0x08);
    m.step(0x3376, 7); // add a,0x08
    regs.b = mem.read8(R(0x1f));
    m.step(0x3379, 19); // ld b,(ix+0x1f)
    regs.cp(regs.b);
    m.step(0x337a, 4); // cp b
    if (regs.fNZ) {
      m.ret(11); // ret nz -- not at target
      return;
    }
    m.step(0x337b, 5); // ret nz NOT taken
    mem.write8(R(0x0d), 0x00);
    m.step(0x337f, 19); // ld (ix+0x0d),0x00
    regs.a = mem.read8(R(0x19));
    m.step(0x3382, 19); // ld a,(ix+0x19)
    regs.cp(0x02);
    m.step(0x3384, 7); // cp 0x02
    if (regs.fNZ) {
      m.ret(11); // ret nz
      return;
    }
    m.step(0x3385, 5); // ret nz NOT taken
    mem.write8(R(0x1d), 0x01);
    m.step(0x3389, 19); // ld (ix+0x1d),0x01 -- entry_3371-only tail
    m.ret(); // 3389
    return;
  }
  m.step(0x3345, 10); // jp z,0x3371 NOT taken
  regs.cp(0x04);
  m.step(0x3347, 7); // cp 0x04
  if (regs.fZ) {
    // loc_338a -- (ix+0x0d) == 4 (twin of entry_3371, no tail)
    m.step(0x338a, 10); // jp z,0x338a taken
    regs.a = mem.read8(R(0x0f));
    m.step(0x338d, 19); // ld a,(ix+0x0f)
    regs.add(0x08);
    m.step(0x338f, 7); // add a,0x08
    regs.b = mem.read8(R(0x1f));
    m.step(0x3392, 19); // ld b,(ix+0x1f)
    regs.cp(regs.b);
    m.step(0x3393, 4); // cp b
    if (regs.fNZ) {
      m.ret(11); // ret nz -- not at target
      return;
    }
    m.step(0x3394, 5); // ret nz NOT taken
    mem.write8(R(0x0d), 0x00);
    m.step(0x3398, 19); // ld (ix+0x0d),0x00
    m.ret(); // 3398
    return;
  }
  m.step(0x334a, 10); // jp z,0x338a NOT taken

  // -- movement path (0x334A) --
  m.push16(0x334d);
  m.step(0x33a1, 17); // call 0x33a1
  if (!m.call(0x33a1)) return; // sub_33a1 spliced (inc sp/inc sp/ret) -> 333d skipped

  regs.a = mem.read8(R(0x0f));
  m.step(0x3350, 19); // ld a,(ix+0x0f)
  regs.add(0x08);
  m.step(0x3352, 7); // add a,0x08
  regs.d = regs.a;
  m.step(0x3353, 4); // ld d,a -- D = (ix+0x0f)+8
  regs.a = mem.read8(R(0x0e));
  m.step(0x3356, 19); // ld a,(ix+0x0e) -- search key
  regs.bc = 0x0015;
  m.step(0x3359, 10); // ld bc,0x0015

  m.push16(0x335c);
  m.step(0x236e, 17); // call 0x236e
  if (!m.call(0x236e)) return; // 236e cpir-miss unwound -> 333d skipped (HL = 0x335C)

  regs.and(regs.a);
  m.step(0x335d, 4); // and a -- test 236e's result A
  if (regs.fZ) {
    // entry_3399 -- 236e returned A == 0
    m.step(0x3399, 10); // jp z,0x3399 taken
    mem.write8(R(0x1f), regs.b);
    m.step(0x339c, 19); // ld (ix+0x1f),b
    mem.write8(R(0x0d), 0x08);
    m.step(0x33a0, 19); // ld (ix+0x0d),0x08
    m.ret(); // 33a0
    return;
  }
  m.step(0x3360, 10); // jp z,0x3399 NOT taken

  mem.write8(R(0x1f), regs.b);
  m.step(0x3363, 19); // ld (ix+0x1f),b
  regs.a = mem.read8(0x6205);
  m.step(0x3366, 13); // ld a,(0x6205)
  regs.b = regs.a;
  m.step(0x3367, 4); // ld b,a
  regs.a = mem.read8(R(0x0f));
  m.step(0x336a, 19); // ld a,(ix+0x0f)
  regs.sub(regs.b);
  m.step(0x336b, 4); // sub b -- carry = unsigned borrow
  if (regs.fNC) {
    m.ret(11); // ret nc -- (ix+0x0f) >= (0x6205), stay
    return;
  }
  m.step(0x336c, 5); // ret nc NOT taken
  mem.write8(R(0x0d), 0x04);
  m.step(0x3370, 19); // ld (ix+0x0d),0x04 -- advance to state 4
  m.ret(); // 3370
}
