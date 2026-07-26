// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_3096 — hand-optimized rewrite of the translated routine at ROM 0x3096,
 * proven equal to its oracle by the equivalence harness.
 *
 * A leaf helper: XOR a mask into TWO strided bytes (a fixed 2-iteration RMW loop).
 * It literals NO address — its three live-ins (HL dest, C mask, DE stride) come from
 * the caller sub_306f — so it imports nothing from ram.js. See the naming candidate
 * reported with this rewrite for the 0x6908 sprite-object block the caller aims it at.
 */

/**
 * sub_3096 -- XOR mask C into 2 bytes at HL, stride DE.  [ROM 0x3096-0x309E]
 *
 *   3096  06 02        ld   b,0x02
 *   3098  79           ld   a,c           ; loc_3098 -- the djnz target
 *   3099  ae           xor  (hl)
 *   309a  77           ld   (hl),a
 *   309b  19           add  hl,de
 *   309c  10 fa        djnz 0x3098
 *   309e  c9           ret
 *
 * WHAT IT DOES. A 3-live-in RMW loop with a FIXED trip count. B is loaded with the
 * constant 2 and never touched by data inside the loop, so the body runs EXACTLY
 * twice. Each pass reloads the mask (A := C), XORs it into the EXISTING byte at HL
 * (a read-modify-write -- the read of (HL) is load-bearing; writing C directly would
 * give a different result), stores the result back, then strides HL by DE.
 *
 * The only caller is sub_306f (ROM 0x306F), which invokes it twice per 8th-frame
 * tick during the loc_0ae8 intro/cutscene: once with HL=0x6909, once with HL=0x691D,
 * both C=0x81, DE=0x0004 (DE is a side effect of loc_0038's `ld de,0x0004` up the
 * chain -- neither routine writes DE). 0x6909/0x690D and 0x691D/0x6921 are byte +1 of
 * consecutive 4-byte records in the sprite-object block (ram.js SPRITE_OBJ_BLOCK,
 * 0x6908-0x692F); XOR 0x81 toggles bits 7 and 0 of the sprite attribute/code byte,
 * flickering those sprites -- the animation the every-8th-frame gate in sub_306f
 * drives. (Measured: both HL configs are the routine's ONLY two live entries.)
 *
 * INPUTS  : HL (dest, mutated), C (mask), DE (stride), and the two bytes read at HL
 *           and HL+DE. B is set internally (2).
 * OUTPUTS : RAM -- mem[HL0] ^= C, mem[HL0+DE] ^= C (two work-RAM stores). Registers on
 *           return: A = C ^ old(mem[HL0+DE]) (OBSERVABLE, register file compared);
 *           B = 0 (djnz drained); HL = HL0 + 2*DE (the two `add hl,de`, carry escapes);
 *           C/DE unchanged. F = the exit flags (see below). SP/PC via `ret`.
 *
 * FLAGS -- KEPT via the verbatim flag-producing ops. `xor (hl)` sets S/Z/PV and clears
 * H/N/C; `add hl,de` then sets H/N/C and preserves S/Z/PV; `djnz` touches NO flags.
 * So the exit F is `xor`'s S/Z/PV over the last `add hl,de`'s H/N/C (plus the 16-bit
 * add's F5/F3) -- reproduced exactly because regs.xor and regs.addHl run in the oracle's
 * order; nothing here reads a flag, but the unit gate compares the whole F, so they are
 * kept, not dropped. B is set with a plain `regs.b = 0` (djnz sets no flags to preserve).
 *
 * CYCLES -- COLLAPSED per-block (the sub_13ca fixed-trip-loop idiom): the 4-instruction
 * loop body folds into ONE m.step (4+7+7+11 = 29 t) at the block's exit PC 0x309C, and
 * each djnz's OWN branch charge (13 taken / 8 not-taken) stays a separate step -- the
 * loop register is a fixed count, so only the body folds. `ld b,0x02` (7 t) and the
 * trailing `ret` (10 t) are their own charges. Path total is preserved EXACTLY:
 * 7 + (29+13) + (29+8) + 10 = 96 t (measured against the oracle). No hardware-latch
 * write occurs -- both stores land in 0x69xx work RAM (SPRITE_OBJ_BLOCK), not a
 * 0x7Dxx/0x7C00/0x7800 latch -- so nothing pins a bus-cycle boundary and the full body
 * fold is licensed.
 *
 * GATE -- STRICT WHOLE-MACHINE (byte-exact), driven. sub_3096 is DRIVEN-REACHABLE:
 * measured 62 dispatches over a coin+start gameplay run (loc_0ae8 <- sub_306f, the
 * intro cutscene) -- NOT the "unreachable frontier" its stale oracle docstring claims.
 * And it is ATOMIC: io.nmiMask == 0 at 100% of those 62 dispatches (measured), because
 * loc_0ae8 runs inside the NMI game-state cascade (mask cleared on NMI entry), so the
 * vblank NMI cannot land inside it and the per-block fold cannot push a coarse PC. An
 * atomic byte-exact collapse passes the ordinary strict gate (docs/06), which -- being
 * non-vacuous (62 invocations) -- also covers the cycle total through the spin-count /
 * stack channel; a unit crafted-entry pair (both HL configs) localizes it and pins the
 * 96 t total explicitly for belt-and-suspenders.
 *
 * FULL-BRANCH COVERAGE. There is NO data-dependent branch: B=2 is a compile-time
 * constant, so the djnz is a fixed 2-count and the routine has a SINGLE path. Both
 * caller configs (HL=0x6909, HL=0x691D) run that same path and are both covered
 * (whole-machine hits both; the unit test asserts both).
 */
export function sub_3096(m) {
  const { regs, mem } = m;

  // ld b,0x02 -- fixed trip count (never modified by data in the loop). 7 t.
  regs.b = 0x02;
  m.step(0x3098, 7);

  do {
    // Loop body, one basic block folded to a single charge (exit PC 0x309C):
    // ld a,c (4) + xor (hl) (7) + ld (hl),a (7) + add hl,de (11) = 29 t.
    regs.a = regs.c; // reload the mask each pass
    regs.xor(mem.read8(regs.hl)); // RMW -- XOR the EXISTING byte (load-bearing read)
    mem.write8(regs.hl, regs.a); // store back to work RAM (SPRITE_OBJ_BLOCK, no latch)
    regs.addHl(regs.de); // stride HL by DE; the 16-bit add's H/N/C escape to the caller
    m.step(0x309c, 29);

    regs.djnz(); // B-- (no flags); B: 2 -> 1 -> 0
    m.step(regs.b !== 0 ? 0x3098 : 0x309e, regs.b !== 0 ? 13 : 8);
  } while (regs.b !== 0);

  m.ret(); // 309e, 10 t
}
