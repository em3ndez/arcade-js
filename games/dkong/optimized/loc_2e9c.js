// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2e9c — hand-optimized rewrite of the translated routine at ROM 0x2E9C,
 * proven equal to its oracle by the equivalence harness.
 *
 * One routine per file. Its one callee (0x2e4b = loc_2e4b, reached by the tail
 * jump) is invoked through `m.call`, the routine registry (games/dkong/routines.js),
 * so it resolves to the oracle or to loc_2e4b's own optimized rewrite — never a
 * copied implementation here. No RAM names are imported: the only address this
 * routine touches, 0x6083, has no evidenced name (it is a placeholder in the
 * sound-latch span, see below), so it is kept hex.
 */

// The animation/sound "string" the per-object updater walks lives in ROM at
// 0x39AA; walking it byte-by-byte drives each object's Y advance + sound. When
// the walk hits the 0x7F terminator, this routine rewinds the read pointer to
// this base so the string loops. (ROM constant, not a RAM name.)
const ANIM_STRING_BASE = 0x39aa;

// 0x6083 is one byte of the 0x6080-0x6087 sound-request span (the SND_TRIGGER
// block the audio layer reads). The individual latches in that span are NOT
// evidenced by name (ram.js keeps 0x6083 as SCRATCH_6083), so the address stays
// hex here. Writing 0x03 requests this object family's animation sound.
const SND_LATCH = 0x6083;
const SND_REQUEST = 0x03;

/**
 * loc_2e9c -- the animation-string TERMINATOR handler for the per-object updater
 * (entry_2e04 / obj_2e12).  [ROM 0x2E9C-0x2EA6, then TAIL-JUMPS into loc_2e4b @ 0x2e4b]
 *
 *   2e9c  21 aa 39     ld   hl,0x39aa    ; HL = ANIM_STRING_BASE (rewind the walk pointer)
 *   2e9f  3e 03        ld   a,0x03
 *   2ea1  32 83 60     ld   (0x6083),a   ; request the animation sound
 *   2ea4  c3 4b 2e     jp   0x2e4b       ; TAIL jump: store the pointer + handle the boundary
 *
 * WHAT IT DOES. obj_2e12 walks a per-object cursor (ix+0e/0f) through the 0x39xx
 * animation string, reading one byte per frame. When that byte is the 0x7F
 * terminator, obj_2e12 jumps here (0x2E41 `cp 0x7f` / `jp z,0x2e9c`) instead of
 * advancing the cursor. loc_2e9c REWINDS the cursor to the string base (HL :=
 * 0x39AA) so the animation loops, requests the object's sound (0x6083 := 3),
 * and falls straight into loc_2e4b, which stores HL back into (ix+0e/0f) and
 * runs the usual boundary check. loc_2e4b is entered here with C still holding
 * the 0x7F terminator byte obj_2e12 loaded (used by loc_2e4b's `ld a,c; cp 0x7f`
 * boundary test), so C is deliberately left untouched.
 *
 * INPUTS  : C = the 0x7F string byte (from obj_2e12, consumed by loc_2e4b).
 *           IX = the object record, IY = its sprite record (both consumed by the
 *           loc_2e4b tail chain). The stack is NOT used (the whole tail chain
 *           loc_2e4b -> loc_2e6c -> loc_2e78 tail-jumps and returns without a ret).
 * OUTPUTS : RAM 0x6083 := 3. Register file: HL := 0x39AA, A := 3, F/C/IX/IY
 *           unchanged by this routine, then loc_2e4b's effects (which store HL
 *           into (ix+0e/0f) and may re-write 0x6083). No boolean is returned;
 *           the tail jump's result is inert but `return`ed for hygiene (matches
 *           the oracle, and mirrors obj_2e12's `return m.call(0x2e9c)`).
 *
 * FLAGS -- NOTHING TO PRESERVE OR DROP. Every instruction here (ld rr,nn / ld r,n
 * / ld (nn),a / jp) leaves the Z80 flags untouched, so F simply passes through
 * unchanged on both sides. There is likewise no dead register churn to drop: HL
 * and A are both live into the store / into loc_2e4b. The readability win is
 * entirely names + docstring, not deletion.
 *
 * CYCLES -- KEPT PER-INSTRUCTION (NOT collapsed). This routine is reached only
 * through loc_197a, the per-frame update cascade, which runs ATOMIC inside the
 * vblank NMI: the NMI handler clears the mask on entry so it cannot re-enter, and
 * measured, no NMI pushed-PC ever lands in the 0x1900-0x2FFF cascade range
 * (io.nmiMask is 0 at every loc_197a dispatch). So it is atomic, and
 * total-preservation alone would license a collapse. It is kept per-instruction
 * for a SEPARATE reason: it has 0 whole-machine dispatches in attract or driven
 * 25m gameplay (its object loop is board-gated by entry_2e04's rst-30/rst-10 skip
 * gates), so there is NO whole-machine run to convergent-verify a collapse
 * against. Per docs/06 ("when in doubt, keep per-instruction"), the charges stay
 * one-per-instruction, exact.
 * Total-preservation is therefore trivial (identical charges to the oracle), and
 * the crafted-entry test pins the total explicitly for insurance. The tail
 * `jp 0x2e4b` is a jump with NO push16, so loc_2e4b's own return goes to OUR
 * caller (obj_2e12), not back here; loc_2e4b resolves through m.call, oracle or
 * its own optimized rewrite.
 */
export function loc_2e9c(m) {
  const { regs, mem } = m;

  regs.hl = ANIM_STRING_BASE; // rewind the animation-string read pointer
  m.step(0x2e9f, 10); // ld hl,0x39aa

  regs.a = SND_REQUEST;
  m.step(0x2ea1, 7); // ld a,0x03

  mem.write8(SND_LATCH, regs.a); // request the animation sound
  m.step(0x2ea4, 13); // ld (0x6083),a

  // TAIL jump into loc_2e4b (NO push16): it stores HL back into (ix+0e/0f) and
  // runs the boundary check; its ret returns to obj_2e12, not here.
  m.step(0x2e4b, 10); // jp 0x2e4b
  return m.call(0x2e4b);
}
