// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1c33 — hand-optimized rewrite of the translated routine at ROM 0x1C33,
 * proven equal to its oracle by the equivalence harness.
 *
 * A tiny tail step of Mario's per-frame update tree. Its two callees are reached
 * through `m.call` (the routine registry, games/dkong/routines.js), so they
 * resolve to the oracle or to their own optimized rewrites — never a copy here.
 * The routine touches no named RAM, so it imports nothing from ram.js.
 */

/**
 * loc_1c33 -- roll-over hook + tail to the player sprite copy.  [ROM 0x1C33-0x1C39,
 * then TAIL-JUMPS into entry_1da6 @ 0x1DA6]
 *
 *   1c33  3c           inc  a            ; Z set iff A was 0xFF (wraps to 0x00)
 *   1c34  cc 54 29     call z,0x2954     ; on roll-over only -> entry_2954
 *   1c37  c3 a6 1d     jp   0x1da6       ; TAIL jump: player sprite -> display buffer
 *
 * WHAT IT DOES. This is the convergence tail of one arm of Mario's airborne/walk
 * update state machine (loc_1bb2 -> ... -> entry_1bf2 -> entry_1c05, which `jp nz`s
 * here at 0x1C1A). It is entered with A holding a phase value:
 *
 *   - From entry_1c05 (the common entry): A = (0x6214) - 0x14, i.e. the player
 *     phase counter 0x6214 biased by 0x14. `inc a` then wraps 0xFF->0x00 exactly
 *     when 0x6214 == 0x13 (one step below the 0x14 the caller special-cases), and
 *     that roll-over is the trigger: `call z,0x2954` fires entry_2954, the
 *     state/sound event routine (it sets 0x6218/0x6085 and dispatches via 0x2974).
 *     On every other phase value the call is skipped.
 *   - From the 0x1C23 live block, A = 0x01 (so `inc a` -> 0x02, never a roll-over).
 *
 * Unconditionally it then TAIL-JUMPS to entry_1da6, which copies the player fields
 * (0x6203/0x6207/0x6208/0x6205) into the display buffer at 0x694C..0x694F. Because
 * the `jp` is a tail jump (no return address pushed), entry_1da6's own `ret`
 * returns to loc_1c33's caller, not to here.
 *
 * INPUTS  : register A (the phase value, per the entry paths above). The stack
 *           (a caller return address for the tail's `ret` to land on).
 * OUTPUTS : on the roll-over path only, entry_2954's effects (0x6218/0x6085/...).
 *           On every path, entry_1da6's sprite-buffer copy (0x694C..0x694F) and the
 *           register file it leaves. loc_1c33's own register contribution is A and F
 *           from `inc a`, both consumed downstream (the branch reads Z; A flows into
 *           the callees, where entry_1da6 immediately overwrites it) plus SP/PC.
 *
 * FLAGS -- `inc a` is KEPT VERBATIM: it produces the Z flag the branch reads, and
 * the A/F it leaves are the register file that flows into the callees, which the
 * unit gate compares byte-for-byte. There is no dead register churn to drop here;
 * this routine's readability win is the docstring, the structured if/else in place
 * of the oracle's flag-scaffolded branch, and the cycle collapse below.
 *
 * CYCLES -- COLLAPSED to one m.step per branch TOTAL, each equal to the oracle's:
 *   - roll-over (Z) path: inc a (4) folded into the taken `call z` charge (17) = 21 t
 *     charged at 0x2954 (AFTER the push16 return-address boundary, which stays put),
 *     then the callee, then the tail `jp` (10 t) at 0x1DA6 before entry_1da6.
 *   - normal (NZ) path: inc a (4) + not-taken `call z` (10) + `jp` (10) = 24 t as a
 *     single lump before the tail — no push16/call/ret boundary sits between them.
 * loc_1c33 is a callee of loc_197a, the per-frame update cascade docs/06 names as
 * INTERRUPTIBLE in gameplay ("the NMI routinely lands mid-cascade"). On the path this
 * routine is ACTUALLY reached — the attract demo — the NMI mask is measured OFF for
 * every one of its 39 invocations, so no NMI lands inside it there and the collapse is
 * byte-exact in attract. But atomicity is a property of EVERY call path, not the
 * routine alone (docs/06): loc_1c33 could be interrupted if reached under the
 * mask-enabled gameplay cascade, so the collapse is LICENSED by the CONVERGENT gate
 * (equivalence-1c33.test.js uses convergentGate, not the strict whole-machine gate),
 * which is safe either way. Total-preservation keeps the main loop's spin count
 * (0x6019, the PRNG entropy) deterministic; the collapse's only possible observable
 * effect is what a byte-exact gate false-fails on — a mistimed NMI pushing the coarse
 * block-exit PC into the DEAD stack (excluded) and at most a single-frame sub-tile
 * raster tear that heals next frame. The `jp 0x1da6` is a TAIL jump with NO push16.
 */
export function loc_1c33(m) {
  const { regs } = m;

  // inc a -- Z set iff A was 0xFF (the phase counter rolled over).
  regs.a = regs.inc8(regs.a);

  if (regs.fZ) {
    // Roll-over: `call z,0x2954` TAKEN. inc a (4) + call-taken (17) = 21 t before the
    // transfer; push16 keeps the return-address boundary; entry_2954 runs live.
    m.push16(0x1c37);
    m.step(0x2954, 21);
    m.call(0x2954);
    // ...then fall into the tail jump.
    m.step(0x1da6, 10); // jp 0x1da6
    return m.call(0x1da6);
  }

  // Normal phase: `call z` NOT taken. inc a (4) + not-taken (10) + jp (10) = 24 t.
  m.step(0x1da6, 24);
  return m.call(0x1da6);
}
