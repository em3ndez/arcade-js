// SPDX-License-Identifier: GPL-3.0-only
/**
 * descend_2284 — hand-optimized rewrite of the translated routine at ROM 0x2284,
 * proven equal to its oracle by the equivalence harness.
 *
 * Its one callee, sub_3fc0 (ROM 0x3fc0), is invoked through `m.call` — the routine
 * registry (games/dkong/routines.js) — so it resolves to the oracle or to
 * sub_3fc0's own optimized rewrite, never a copy here. Only the RAM *name* MARIO_Y
 * is imported (from ram.js).
 */

import { MARIO_Y } from "./ram.js";

/**
 * descend_2284 -- loc_2259's "one pixel DOWN" step for a descending object.
 * [ROM 0x2281-0x2289; the registry keys it 0x2284 — that is the `call 0x2284`
 * address loc_2259 uses — even though the routine's first instruction physically
 * sits at 0x2281. The oracle is keyed the same way; this rewrite matches it.]
 *
 *   2281  21 05 62     ld   hl,0x6205      ; HL = &MARIO_Y
 *   2284  34           inc  (hl)           ; MARIO_Y++  (logical Y: one pixel DOWN)
 *   2285  cd c0 3f     call 0x3fc0         ; sub_3fc0: (0x694d)=3, and LEAVES HL=0x694f
 *   2288  34           inc  (hl)           ; inc (0x694f) -- the SPRITE-Y byte, NOT MARIO_Y
 *   2289  c9           ret
 *
 * WHAT IT DOES. loc_2259 (a state arm of the board-2 object animation dispatched
 * from the 0x197a per-frame cascade) calls this to advance a
 * descending object by one pixel. It:
 *   1. increments the LOGICAL Y (MARIO_Y, 0x6205) — the object drops one pixel;
 *   2. calls sub_3fc0, which stamps the object's sprite CODE byte (0x694d) to 0x03
 *      (the descent sprite frame) AND, as its deliberate side effect, walks HL to
 *      0x694f — the sprite-Y byte (+3) of the 4-byte sprite record based at
 *      MARIO_SPRITE_RECORD (0x694C: +0 X, +1 code, +2 attr, +3 Y); then
 *   3. increments (HL) — i.e. (0x694f), the SPRITE Y — so the drawn sprite drops too.
 *
 * ⚠ THE SUBTLETY (which the oracle's translation comment "Y++" obscures): the two
 * `inc (hl)` do NOT touch the same byte. sub_3fc0 CLOBBERS HL (0x6205 -> 0x694f),
 * so the first inc bumps MARIO_Y (0x6205) and the second bumps the sprite-Y byte
 * (0x694f). This routine's correctness DEPENDS on sub_3fc0's HL side effect — that
 * is exactly why HL is read back from `m.call(0x3fc0)` here rather than being a
 * fixed pointer: whatever sub_3fc0's implementation (oracle or optimized) leaves in
 * HL is what the second inc uses. (Verified against a real dispatched entry: MARIO_Y
 * 0x40 -> 0x41 [+1, NOT +2], 0x694d -> 0x03, 0x694f 0xf0 -> 0xf1.)
 *
 * INPUTS  : RAM MARIO_Y (0x6205) and the sprite-Y byte at 0x694f reached via
 *           sub_3fc0. The stack (a caller return address). No register inputs are
 *           read (HL is loaded immediately; A/BC/DE/IX/IY pass through this routine
 *           untouched, though sub_3fc0 loads HL).
 * OUTPUTS : MARIO_Y += 1; sub_3fc0's effects ((0x694d)=3, HL:=0x694f); (0x694f) += 1.
 *           Register file on return: HL=0x694f, F from the final inc8, A/BC/DE/IX/IY
 *           as sub_3fc0 left them; SP + PC balanced by the ret. No boolean returned.
 *
 * FLAGS -- KEPT VERBATIM. Both `inc (hl)` use `regs.inc8`, setting the exact flags
 * the oracle's INC (HL) does; the last inc8 is the last flag-writer before the ret,
 * so the exit F must match — the unit gate compares the whole register file. There
 * is no droppable flag churn (nothing here branches on a flag).
 *
 * CYCLES -- KEPT PER-INSTRUCTION (the oracle's exact charge distribution: 10, 11,
 * 17[call], 11, 10[ret]; own total 59 t, + sub_3fc0's 38 t = 97 t whole). NOT
 * collapsed. WHY: this routine is reached ONLY through the 0x197a cascade
 * (sub_2207_body -> loc_2259 -> here), which runs ATOMIC inside the vblank NMI
 * (measured: io.nmiMask is 0 at every 0x197a/entry_1ac3/sub_2207 dispatch, and no NMI
 * pushed-PC lands in the 0x1900-0x2FFF cascade range) — so the NMI cannot land inside
 * it, and total-preservation would license a collapse as for any atomic routine. It is
 * nonetheless kept per-instruction for a SEPARATE reason: it has 0 natural whole-machine
 * dispatches — it fires only via an identical-both-sides poke (a board-2 confluence),
 * ~1x, and a single wrong total does not fork the PRNG persistently under that poking —
 * so a collapse cannot be whole-machine verified (docs/decompiler-pipeline's per-instruction frontier
 * case; measured — the convergent gate does NOT catch a cycle-broken twin here). The
 * de-scaffolding win is therefore entirely NAMES, STRUCTURE and this docstring (which
 * corrects the HL-clobber semantics); the two pre-call charges stay separate so the
 * distribution is byte-identical to the oracle. The `call 0x3fc0` stays a
 * boundary (m.push16 + m.step + m.call); no hardware-latch write occurs anywhere
 * (0x6205 and 0x694x are work RAM), so there is no write-trace pin.
 */
export function descend_2284(m) {
  const { regs, mem } = m;

  // 1) MARIO_Y++ -- the descending object drops one pixel (logical Y).
  regs.hl = MARIO_Y; // 0x6205
  m.step(0x2284, 10); // ld hl,0x6205
  mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl)));
  m.step(0x2285, 11); // inc (hl)

  // 2) sub_3fc0: stamp the sprite CODE (0x694d)=3 AND leave HL = 0x694f (sprite Y).
  //    HL is CLOBBERED here — the next inc uses THAT pointer, not &MARIO_Y.
  m.push16(0x2288);
  m.step(0x3fc0, 17); // call 0x3fc0
  m.call(0x3fc0);

  // 3) inc the sprite-Y byte sub_3fc0 left HL pointing at (0x694f) — draw one down.
  mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl)));
  m.step(0x2289, 11); // inc (hl)
  m.ret(10);
}
