// SPDX-License-Identifier: GPL-3.0-only
/**
 * loop_0583 — hand-optimized rewrite of the translated routine at ROM 0x0583,
 * proven equal to its oracle by the equivalence harness.
 *
 * One routine per file. Its one callee (0x0593, the single-digit renderer) is
 * reached through `m.call`, the routine registry (games/dkong/routines.js), so it
 * resolves to the oracle or to a future optimized rewrite — never a copy. Nothing
 * is imported from ram.js: this routine addresses VRAM and the score buffer only
 * through register pointers (HL/IX) that its two callers set up, so it has no
 * fixed work-RAM operand to name. The digit-renderer's ROM address is given a
 * local name for readability.
 */

// sub_0593: masks A to one BCD nibble, stores it at (IX), then advances IX by DE.
// A ROM entry point reached by address, NOT a work-RAM cell — so it is a local
// const here, not a ram.js name.
const RENDER_DIGIT = 0x0593;

/**
 * loop_0583 -- expand a run of packed-BCD bytes into on-screen digits.
 * [ROM 0x0583-0x0592]  A shared loop with THREE entry points into the same code:
 *   - draw_0578 (0x0578) falls in after `ld ix,0x7641 / ex de,hl / ld de,-32 /
 *     ld bc,0x0304` — render a 3-byte score (B = 3 bytes).
 *   - draw_056b (0x056b) reaches it through draw_0578 with a different IX column.
 *   - sub_0616 (0x0616) TAIL-JUMPS here (`jp 0x0583`) with its own HL/DE/IX and
 *     B = 1 — expand the single credits byte at 0x6001. A tail jump, so this
 *     routine's `ret` returns to sub_0616's caller, not to sub_0616.
 * Because those callers share no prologue, the loop is factored into its own
 * routine (the oracle's note) rather than gated behind another entry flag.
 *
 * WHAT IT DOES. For each of B source bytes, walking HL DOWNWARD:
 *   1. read (HL), rotate it right four times — a NIBBLE SWAP, not a shift: the
 *      four `rrca`s move the HIGH nibble into the low nibble (sub_0593 then masks
 *      0x0F), so the HIGH digit is emitted first;
 *   2. RENDER_DIGIT (0x0593) stores that nibble at (IX) and steps IX by DE;
 *   3. re-read (HL) unrotated and render again — the LOW digit;
 *   4. dec HL, `djnz` back for the next source byte.
 * Two digits per byte, high first, high source byte last: HL descending against
 * IX stepping by DE (its callers pass DE = -32, one tilemap row) is what turns
 * little-endian source order into top-to-bottom display order in the rotated
 * tilemap.
 *
 * INPUTS  : B = source-byte count (loop trips); HL = address of the HIGH source
 *           byte (walked down); IX = first VRAM cell; DE = per-digit VRAM step
 *           (callers pass 0xFFE0 = -32). Reads (HL) twice per byte.
 * OUTPUTS : 2*B digit cells written by RENDER_DIGIT via (IX), IX advanced by DE
 *           each. At exit HL = HL_in - B, B = 0, and A / IX / F are whatever the
 *           final RENDER_DIGIT left (A = last low nibble, IX = past the last cell,
 *           F from sub_0593's `add ix,de`). The unit gate compares the whole
 *           register file, F included, so every one of those is preserved.
 *
 * FLAGS. Nothing this routine computes is read by anything it hands control to:
 *   - each `rrca`'s flags are immediately overwritten by RENDER_DIGIT's `and 0x0f`;
 *   - `dec hl` is the 16-bit form (modelled as a masked subtract) and sets no flags;
 *   - `djnz` sets no flags on the Z80.
 * So the observable F at exit comes entirely from the last RENDER_DIGIT call,
 * which runs through m.call to the oracle (or its own rewrite) — identical either
 * way. The `rrca`s are kept as four real operations regardless, both to preserve
 * A entering the renderer and because the per-instruction cycle decision below
 * forbids folding them into one value.
 *
 * LADDER STATUS -- rung 5 (idiomatic), cycles COLLAPSED to one m.step per basic
 * block within each loop iteration (the per-instruction charges of each
 * straight-line run folded into a single charge at the block's exit PC). Per
 * iteration: the read + four-rotate nibble-swap folds to 23 t (exit 0x0588, the
 * `call 0x0593` for the HIGH digit); that call keeps its own push16/step/m.call
 * scaffolding (17 t, untouched); the LOW-digit re-read is already a single
 * instruction sandwiched between two calls, so nothing folds there (7 t, exit
 * 0x058c); the second call likewise keeps its scaffolding untouched; `dec hl` plus
 * the data-dependent `djnz` charge folds to ONE per-branch total -- 19 t (exit
 * 0x0583, loop continues) or 14 t (exit 0x0592, loop exits). Every fold's TOTAL is
 * the oracle's, EXACTLY -- total-preservation keeps the main loop's spin count
 * (0x6019, the PRNG entropy) deterministic. Both RENDER_DIGIT calls still reach
 * their callee through m.call (the registry).
 *
 * loop_0583 is NOT ATOMIC on either call path (atomicity is per-call-path):
 *   (a) sub_0616 tail-jumps here on the SAME frame-6 chain whose earlier link,
 *       handler_05e9, is documented to be INTERRUPTED by the vblank NMI mid-loop
 *       (handler_05e9.js: it pushes PC 0x060d onto diffed work RAM). loop_0583 is
 *       reached from that interruptible cascade — a "reached via a tail" NOT-atomic
 *       path.
 *   (b) draw_0578/draw_056b reach it as an in-game main-loop TASK (handler_05c6,
 *       mask ENABLED), and the loop is data-dependent: `djnz` entered with B = 0
 *       runs 256 trips (~14k cycles, most of a frame), long enough for the NMI to
 *       land INSIDE it.
 * So the collapse coarsens where an in-flight NMI's PC would land (a block-exit
 * address, not the exact instruction) -- the CONVERGENT gate's license (docs/decompiler-pipeline);
 * see equivalence-0583.test.js, which gates the whole-machine job with
 * convergentGate rather than a strict comparison. The per-iteration branch/cycle
 * totals are unchanged by the fold: B=1 190t, B=2 375t, B=3 560t; +185t per extra
 * trip.
 */
export function loop_0583(m) {
  const { regs, mem } = m;

  do {
    // Block A: read the source byte and rotate its high nibble down (nibble
    // swap -- the high nibble ends up low).  7 + 4*4 = 23 t.
    regs.a = mem.read8(regs.hl);
    for (let i = 0; i < 4; i++) regs.rrca();
    m.step(0x0588, 23);
    m.push16(0x058b);
    m.step(RENDER_DIGIT, 17); // call 0x0593 -- store the HIGH nibble at (IX)
    m.call(RENDER_DIGIT);

    // Low digit: re-read the same source byte, unrotated. Sandwiched between two
    // calls -- already a single instruction, nothing to fold.
    regs.a = mem.read8(regs.hl);
    m.step(0x058c, 7); // ld a,(hl)
    m.push16(0x058f);
    m.step(RENDER_DIGIT, 17); // call 0x0593 -- store the LOW nibble at (IX)
    m.call(RENDER_DIGIT);

    // Block B: advance to the next source byte (one address LOWER) and test djnz.
    //   dec hl(6) + djnz(13 taken / 8 not) = 19 / 14 t.
    regs.hl = (regs.hl - 1) & 0xffff;
    regs.djnz();
    m.step(regs.b !== 0 ? 0x0583 : 0x0592, regs.b !== 0 ? 19 : 14);
  } while (regs.b !== 0);

  m.ret(); // 0592: ret -- to the ROUTINE's caller (sub_0616's caller on the tail path)
}
