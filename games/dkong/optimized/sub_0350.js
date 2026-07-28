// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_0350 — hand-optimized rewrite of the translated routine at ROM 0x0350,
 * proven equal to its oracle by the equivalence harness.
 *
 * One routine per file. Its one callee (0x06b8 = entry_06b8, reached by the tail
 * jump) is invoked through `m.call`, the routine registry (games/dkong/routines.js),
 * so it resolves to the oracle or to entry_06b8's own optimized rewrite — never a
 * copied implementation here. Only RAM *names* are imported (from ram.js).
 */

import { BONUS_LIFE_AWARDED, CURRENT_PLAYER, DIP_BONUS_LIFE, LIVES } from "./ram.js";

/**
 * sub_0350 -- the once-per-player EXTRA-LIFE award check.  [ROM 0x0350-0x037E,
 * then TAIL-JUMPS into entry_06b8 @ 0x06b8]
 *
 *   0350  3a 2d 62     ld   a,(0x622d)   ; A = BONUS_LIFE_AWARDED
 *   0353  a7           and  a
 *   0354  c0           ret  nz           ; already granted this player -> done
 *   0355  21 b3 60     ld   hl,0x60b3    ; P1 score, middle BCD pair
 *   0358  3a 0d 60     ld   a,(0x600d)   ; A = CURRENT_PLAYER
 *   035b  a7           and  a
 *   035c  28 03        jr   z,0x0361     ; P1 (0) keeps 0x60b3; P2 falls through
 *   035e  21 b6 60     ld   hl,0x60b6    ; P2 score, middle BCD pair
 *   0361  7e           ld   a,(hl)       ; loc_0361: middle pair (thousands in hi nibble)
 *   0362  e6 f0        and  0xf0
 *   0364  47           ld   b,a
 *   0365  23           inc  hl           ; -> MSB pair (ten-thousands in lo nibble)
 *   0366  7e           ld   a,(hl)
 *   0367  e6 0f        and  0x0f
 *   0369  b0           or   b            ; A = tttt.TTTT  (T=ten-thousands, t=thousands)
 *   036a  0f 0f 0f 0f  rrca x4           ; rotate down 4 -> A = TTTT.tttt (thousands BCD pair)
 *   036e  21 21 60     ld   hl,0x6021    ; DIP_BONUS_LIFE threshold (BCD thousands)
 *   0371  be           cp   (hl)
 *   0372  d8           ret  c            ; score's thousands below threshold -> done
 *   0373  3e 01        ld   a,0x01
 *   0375  32 2d 62     ld   (0x622d),a   ; latch BONUS_LIFE_AWARDED = 1
 *   0378  21 28 62     ld   hl,0x6228
 *   037b  34           inc  (hl)         ; LIVES += 1
 *   037c  c3 b8 06     jp   0x06b8       ; TAIL jump: redraw lives indicator
 *
 * WHAT IT DOES. Runs once per main-loop pass (mainLoop's per-frame work path,
 * ROM 0x02CA). It grants the score-threshold EXTRA LIFE at most once per player:
 *
 *   1. BONUS_LIFE_AWARDED (0x622D) is a one-shot latch. If already set, `ret nz`
 *      does nothing — the life was granted, so never grant it again.
 *   2. Otherwise it reads the up-player's score. Scores are 3-byte little-endian
 *      packed BCD; sub_0350 wants the *thousands* pair. That pair lives split
 *      across two bytes: the THOUSANDS digit is the high nibble of the middle
 *      pair (0x60b3 P1 / 0x60b6 P2), and the TEN-THOUSANDS digit is the low
 *      nibble of the MSB pair (0x60b4 / 0x60b7). It ORs them into one byte
 *      (ten-thousands:thousands) and `rrca` x4 swaps the nibbles to the natural
 *      BCD order (thousands pair = value/1000 in BCD).
 *   3. It compares that against DIP_BONUS_LIFE (0x6021), the threshold in BCD
 *      thousands (7000/10000/15000/20000). Below threshold -> `ret c`, done.
 *   4. At/above threshold: latch 0x622D=1, `inc (LIVES)`, and TAIL-JUMP to
 *      entry_06b8, which redraws the on-screen lives indicator.
 *
 * INPUTS  : RAM 0x622D (BONUS_LIFE_AWARDED), 0x600D (CURRENT_PLAYER), the up
 *           player's score bytes 0x60b3/0x60b4 (P1) or 0x60b6/0x60b7 (P2),
 *           0x6021 (DIP_BONUS_LIFE). The stack (a caller return address to ret to).
 * OUTPUTS : on the award path only — RAM 0x622D := 1 and 0x6228 (LIVES) += 1,
 *           then entry_06b8's effects (lives-indicator VRAM). Register file:
 *           A, B, HL, F, SP, PC on every path. No boolean is returned; the caller
 *           (mainLoop) ignores the value, so the tail jump's result is inert but
 *           `return`ed for hygiene (matches the oracle).
 *
 * The two hex score pointers 0x60b3 / 0x60b6 stay hex on purpose: they are the
 * +1 MIDDLE byte of the named score bases P1_SCORE (0x60B2) / P2_SCORE (0x60B5),
 * not fields in their own right — the same reason handler_05c6 keeps 0x60B4/B7/BA
 * hex. The MSB byte reached by `inc hl` (0x60b4 / 0x60b7) is likewise the score's
 * +2 pair, left implicit in the pointer walk.
 *
 * FLAGS -- KEPT VERBATIM, every operation. `and`, `rrca`, `cp`, `inc8` set the
 * exact flags the oracle does; the register churn (`ld b,a`, the pointer loads) is
 * preserved so the register file on return (F, B, HL, A) matches the oracle byte
 * for byte — the unit gate compares the whole file.
 *
 * CYCLES -- COLLAPSED to one m.step per basic block (the per-instruction charges of
 * each straight-line run folded into a single charge at the block's exit PC). Each
 * branch's TOTAL is the oracle's, EXACTLY (ret-nz 28 t; P1 ret-c 147 t; P2 ret-c
 * 152 t; P1 award 192 t of prologue before the entry_06b8 tail; P2 award 197 t) --
 * total-preservation keeps the main loop's spin count (0x6019, the PRNG entropy)
 * deterministic. sub_0350 is NOT atomic: it is called every frame from the main
 * loop (mask enabled, ROM 0x02CA `m.call(0x0350)`), and the vblank NMI lands inside
 * it heavily in real gameplay -- so the collapse is LICENSED by the CONVERGENT gate
 * (docs/decompiler-pipeline; equivalence-0350.test.js uses convergentEquivalence, not the strict
 * whole-machine gate). The collapse's only observable effect is what a strict
 * byte-exact gate false-fails on: a mistimed NMI pushes the coarse block-exit PC
 * into the DEAD stack (excluded) and can leave a single-frame <=6px raster tear that
 * heals next frame. Non-stack RAM stays byte-identical; nothing persistent survives.
 *
 * The award path's `jp 0x06b8` is a TAIL jump with NO push16: entry_06b8's own
 * `ret` (or its rst-0x08 skip in attract) returns to sub_0350's caller, not to
 * here. entry_06b8 is reached via `m.call(0x06b8)` so it resolves to the oracle
 * or to its own optimized rewrite; it is left per-instruction because IT is
 * interruptible too.
 */
export function sub_0350(m) {
  const { regs, mem } = m;

  // Block A: ld a,(BONUS_LIFE_AWARDED); and a  -- once-per-player guard.  13+4 = 17 t
  regs.a = mem.read8(BONUS_LIFE_AWARDED);
  regs.and(regs.a);
  m.step(0x0354, 17);
  if (regs.fNZ) {
    m.ret(11); // ret nz -- the extra life was already granted this player. (total 28 t)
    return;
  }
  m.step(0x0355, 5); // jr past the ret

  // Block B: ld hl,0x60b3; ld a,(CURRENT_PLAYER); and a  -- pick the up player.  10+13+4 = 27 t
  regs.hl = 0x60b3; // P1_SCORE (0x60B2) + 1 -- the middle BCD pair.
  regs.a = mem.read8(CURRENT_PLAYER);
  regs.and(regs.a);
  m.step(0x035c, 27);
  if (regs.fZ) {
    m.step(0x0361, 12); // jr z taken -- P1, keep 0x60b3.
  } else {
    // Block C: (jr not taken 7) ld hl,0x60b6 (10)  -- P2.  17 t
    regs.hl = 0x60b6; // P2_SCORE (0x60B5) + 1.
    m.step(0x0361, 17);
  }

  // Block D: loc_0361 -- pack the score's thousands BCD pair, cp DIP_BONUS_LIFE.
  //   ld a,(hl)[7] and 0xf0[7] ld b,a[4] inc hl[6] ld a,(hl)[7] and 0x0f[7] or b[4]
  //   rrca x4[16] ld hl,0x6021[10] cp (hl)[7]  = 75 t, exit 0x0372
  regs.a = mem.read8(regs.hl); // middle pair -- thousands in the high nibble.
  regs.and(0xf0);
  regs.b = regs.a;
  regs.hl = (regs.hl + 1) & 0xffff; // -> MSB pair (0x60b4 / 0x60b7).
  regs.a = mem.read8(regs.hl); // ten-thousands in the low nibble.
  regs.and(0x0f);
  regs.or(regs.b); // A = tttt.TTTT
  regs.rrca(); regs.rrca(); regs.rrca(); regs.rrca(); // -> TTTT.tttt (thousands BCD pair)
  regs.hl = DIP_BONUS_LIFE;
  regs.cp(mem.read8(regs.hl));
  m.step(0x0372, 75);
  if (regs.fC) {
    m.ret(11); // ret c -- score's thousands pair is below the threshold. (P1 147 t / P2 152 t)
    return;
  }
  m.step(0x0373, 5); // jr past the ret

  // Block E: award -- latch the one-shot flag, bump lives, tail-jump to redraw.
  //   ld a,1[7] ld (0x622d),a[13] ld hl,0x6228[10] inc (hl)[11] jp 0x06b8[10] = 51 t, exit 0x06b8
  regs.a = 0x01;
  mem.write8(BONUS_LIFE_AWARDED, regs.a); // latch = 1
  regs.hl = LIVES;
  mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl))); // inc (LIVES)
  m.step(0x06b8, 51);
  // jp 0x06b8 -- TAIL jump: NO push16, so entry_06b8's ret returns to OUR caller.
  // `return` propagates its answer (inert today; keeps a future reader honest).
  return m.call(0x06b8);
}
