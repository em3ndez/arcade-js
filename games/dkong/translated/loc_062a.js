// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_062a  (ROM 0x062A–0x06B7) — task entry 10: divides (0x62B0) by ten and renders the BCD digits (142 bytes, 74 instructions).
 *
 * The five loc_ blocks are written out from the listing, and every m.step
 * target was checked against the listing's own instruction boundaries.
 *
 * A IS A LIVE-IN -- `and a` at 0x062A tests it before anything sets it. It is
 * the task-dispatch payload. C IS ALSO LIVE-IN, but only on the 0x0691 arm:
 * `push bc` at 0x0697 reads C and nothing on the path 0x062A -> 0x0691 -> 0x0697
 * sets it. B *is* set one instruction earlier at 0x0694, which is exactly what
 * makes C easy to miss.
 *
 * THREE EXITS, THREE DIFFERENT SEMANTICS:
 *   0x0639  `ret nz`     CONDITIONAL -- falls through when Z
 *   0x0690  `ret`        unconditional
 *   0x06A5  `jp 0x051c`  TAIL JUMP -- nothing pushed, never reaches a `ret`
 *
 * BC IS PRESERVED ACROSS THE CALL FOR THIS ROUTINE, NOT FOR THE CALLER.
 * `push bc` / `pop bc` bracket the 0x0698 call because entry_051c's first
 * instruction is `ld c,a`, which clobbers it. loc_062a preserves NOTHING for
 * its own caller -- A, BC, DE, HL, IX and flags are all clobbered on some path.
 * That is a fourth sense of "preserved": SAVED FOR SELF, distinct from SAVED
 * FOR CALLER (sub_122a's HL), INVISIBLE (sub_122a's IX) and NEVER-WRITTEN.
 *
 * THE 0x0690 `ret` HANDS BACK TWO DIFFERENT FLAG STATES depending on which arm
 * reached it -- `add a,b` at 0x0685 on the fallthrough, `and 0x0f` at 0x0673
 * via `jp nz,0x0689`. Nothing between either and the exit writes flags.
 *
 * loc_066a and loc_0691 ARE A TWIN PAIR WITH INVERTED REGISTER ROLES, thirty-
 * nine bytes apart -- both split (0x638C) into nibbles; loc_066a keeps the
 * original in C and the low nibble in B, loc_0691 keeps the original in B and
 * leaves the low nibble in A. The 11ec/122a shape inside one routine, and the
 * reason neither block may be factored into a shared helper.
 *
 * All five loc_ labels are PHANTOM -- 0 call sites, jump targets only. They are
 * written as functions for readability; loc_066a is a genuine JOIN, reached by
 * fallthrough from 0x0667 and by `jp 0x066a` from 0x06B5.
 */
export function loc_062a(m) {
  const { regs, mem } = m;

  regs.and(regs.a); // reads the LIVE-IN A
  m.step(0x062b, 4); // and a
  if (regs.fZ) {
    m.step(0x0691, 10); // jp z,0x0691 taken
    return m.call(0x0691);
  }
  m.step(0x062e, 10); // jp z not taken

  regs.a = mem.read8(0x638c);
  m.step(0x0631, 13); // ld a,(0x638c)
  regs.and(regs.a);
  m.step(0x0632, 4); // and a
  if (regs.fNZ) {
    m.step(0x06a8, 10); // jp nz,0x06a8 taken
    return m.call(0x06a8);
  }
  m.step(0x0635, 10); // jp nz not taken

  regs.a = mem.read8(0x63b8);
  m.step(0x0638, 13); // ld a,(0x63b8)
  regs.and(regs.a);
  m.step(0x0639, 4); // and a
  if (regs.fNZ) {
    m.ret(11); // ret nz taken -- a CONDITIONAL exit
    return;
  }
  m.step(0x063a, 5); // ret nz not taken

  // DIVIDE (0x62B0) BY TEN BY REPEATED SUBTRACTION, counting in B.
  //
  // THIS LOOP DOES NOT TERMINATE FOR EVERY INPUT, and there is no iteration
  // guard in the ROM. It exits only when A reaches EXACTLY zero, and A moves in
  // steps of 10 modulo 256; gcd(10, 256) = 2, so an ODD value at 0x62B0 never
  // hits zero and the CPU spins forever. A = 0 does not exit immediately
  // either -- it needs 128 passes back around to zero.
  //
  // NO GUARD IS ADDED. The ROM has none, and adding one would convert a hang
  // into a silently wrong answer -- the hang is the faithful behaviour and it
  // is loud. Recorded as a predicted failure mode with a named trigger:
  // sub_0f56 computes 0x62B0 as min(((0x6229)*10 + 0x28) mod 256, 0x50), and
  // that clamp DOES NOT DETECT WRAP, so a wrapped value can be odd. Two drafts
  // reached this from opposite ends -- the clamp's structure and gcd(10,256) --
  // which is corroboration rather than one observation counted twice. Neither
  // claims it fires on any tape we hold.
  regs.a = mem.read8(0x62b0);
  m.step(0x063d, 13); // ld a,(0x62b0)
  regs.bc = 0x000a; // B = 0 (the quotient), C = 10 (the divisor)
  m.step(0x0640, 10); // ld bc,0x000a
  do {
    regs.b = regs.inc8(regs.b);
    m.step(0x0641, 4); // inc b
    regs.sub(regs.c);
    m.step(0x0642, 4); // sub c
    m.step(regs.fNZ ? 0x0640 : 0x0645, 10); // jp nz,0x0640
  } while (regs.fNZ);

  regs.a = regs.b; // the quotient
  m.step(0x0646, 4); // ld a,b
  for (const next of [0x0647, 0x0648, 0x0649, 0x064a]) {
    regs.rlca(); // four rotates = move the low nibble to the high nibble
    m.step(next, 4); // rlca
  }
  mem.write8(0x638c, regs.a);
  m.step(0x064d, 13); // ld (0x638c),a

  regs.hl = 0x384a;
  m.step(0x0650, 10); // ld hl,0x384a
  regs.de = 0x7465;
  m.step(0x0653, 10); // ld de,0x7465
  regs.a = 0x06;
  m.step(0x0655, 7); // ld a,0x06

  // `ld ix,0x001d` IS INSIDE THE LOOP -- `jp nz,0x0655` lands ON it, so IX is
  // reloaded every pass and the routine uses it as a fresh STRIDE each time,
  // not as a running pointer. Hoisting it out is the sub_3fa6 trap: the second
  // and later passes would add an already-advanced IX to DE. Note IX here is a
  // CONSTANT 0x001D being added to DE, i.e. `add ix,de` computes DE + 0x1D and
  // the push/pop moves it back into DE -- a 16-bit add with no `add de,rr`
  // instruction available.
  do {
    regs.ix = 0x001d; // LOOP BODY, not setup
    m.step(0x0659, 14); // ld ix,0x001d
    regs.bc = 0x0003;
    m.step(0x065c, 10); // ld bc,0x0003
    m.ldirAt(0x065c, 0x065e);
    regs.addIx(regs.de); // writes H, N, C
    m.step(0x0660, 15); // add ix,de
    m.push16(regs.ix);
    m.step(0x0662, 15); // push ix
    regs.de = m.pop16(); // push ix / pop de == a 16-bit IX -> DE move
    m.step(0x0663, 10); // pop de
    regs.a = regs.dec8(regs.a);
    m.step(0x0664, 4); // dec a
    m.step(regs.fNZ ? 0x0655 : 0x0667, 10); // jp nz,0x0655
  } while (regs.fNZ);

  regs.a = mem.read8(0x638c);
  m.step(0x066a, 13); // ld a,(0x638c)
  return m.call(0x066a);
}
