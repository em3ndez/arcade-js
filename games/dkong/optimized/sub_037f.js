// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_037f — hand-optimized rewrite of the translated routine at ROM 0x037F,
 * proven equal to its oracle by the equivalence harness.
 *
 * One routine per file. sub_037f has NO callees — it is a pure work-RAM leaf, so
 * nothing here goes through `m.call`; only RAM *names* are imported (from ram.js).
 */

import { DIFFICULTY, DIFFICULTY_CLOCK, DIFFICULTY_PRESCALER, LEVEL } from "./ram.js";

/**
 * sub_037f -- per-frame DIFFICULTY recompute behind two nested rate dividers.
 * [ROM 0x037F-0x03A1, called ONCE PER SERVICED FRAME from mainLoop @ ROM 0x02DB]
 *
 *   037f  ld   hl,0x6384      ; DIFFICULTY_PRESCALER
 *   0382  ld   a,(hl)         ; A = OLD prescaler (read BEFORE the inc)
 *   0383  inc  (hl)           ; prescaler++
 *   0384  and  a             ; Z <- (old prescaler == 0)
 *   0385  ret  nz            ; -- divider 1: body runs 1 frame in 256
 *   0386  ld   hl,0x6381      ; DIFFICULTY_CLOCK
 *   0389  ld   a,(hl)         ; A = OLD clock
 *   038a  ld   b,a            ; B = OLD clock (kept for the shift below)
 *   038b  inc  (hl)           ; clock++
 *   038c  and  0x07           ; Z <- (old clock % 8 == 0)
 *   038e  ret  nz            ; -- divider 2: body runs every 8th tick
 *   038f  ld   a,b            ; A = old clock
 *   0390  rrca / rrca / rrca  ; A = old clock >> 3  (low 3 bits are 0 here)
 *   0393  ld   b,a            ; B = clock >> 3
 *   0394  ld   a,(0x6229)     ; A = LEVEL
 *   0397  add  a,b            ; A = LEVEL + (clock >> 3)
 *   0398  cp   0x05
 *   039a  jr   c,0x039e       ; keep if < 5 ...
 *   039c  ld   a,0x05         ; ... else clamp to 5
 *   039e  ld   (0x6380),a     ; DIFFICULTY
 *   03a1  ret
 *
 * WHAT IT DOES. Two nested rate dividers throttle a difficulty recompute. The
 * outer divider (DIFFICULTY_PRESCALER, 0x6384) increments every serviced frame
 * and, because the value is read BEFORE the `inc`, passes only the frame it is 0
 * -- i.e. once every 256 frames. The inner divider (DIFFICULTY_CLOCK, 0x6381)
 * then increments and passes only every 8th time (`and 0x07`). When both pass,
 * DIFFICULTY (0x6380) := min(LEVEL + (DIFFICULTY_CLOCK >> 3), 5): difficulty
 * ramps with the level number AND with time on the board, clamped to 5. The `>>3`
 * is exact via three `rrca` because the inner gate guarantees the low 3 bits are 0.
 *
 * INPUTS  (RAM read):  0x6384 prescaler, 0x6381 clock, 0x6229 LEVEL.
 * OUTPUTS (RAM writ.): 0x6384 (always +1), 0x6381 (+1 on the every-256 frame),
 *                      0x6380 DIFFICULTY (only on the every-256-and-8th frame).
 * No hardware latch is touched -- every store is work RAM.
 *
 * CYCLE / ATOMICITY DECISION -- COLLAPSED to one m.step per basic block.
 * The ONLY caller is mainLoop (ROM 0x02DB `call 0x037f`), which runs with the
 * vblank NMI mask ENABLED, so the NMI CAN land inside this routine on its one
 * call path -- it is NOT atomic (the brief's ATOMICITY-IS-PER-CALL-PATH rule).
 * A cycle collapse moves where a mid-routine NMI lands (its pushed PC / the F it
 * stacks now diverge in work RAM at a coarser granularity), so this collapse is
 * INTERRUPTIBLE and is licensed by the CONVERGENT gate, not the strict
 * whole-machine gate (see the accompanying equivalence test). Each branch's
 * TOTAL is preserved EXACTLY (A 43t, B 87t, C-keep 160t, C-clamp 162t) -- folded
 * into one m.step per basic block (each ending at the branch's own conditional),
 * matching sub_0350's template.
 *
 * FLAGS / REGISTERS. No caller consumes a flag (mainLoop's next act is an
 * unconditional `call 0x03a2`), but the unit gate compares the WHOLE register
 * file (incl. F) at the routine's exit. Every register write and flag-setting
 * helper (`inc8`, `and`, `rrca`, `add`, `cp`) is kept at its oracle VALUE and
 * ORDER (only the m.step charge granularity changed); there is no dead register
 * churn to drop (the routine's whole output IS the register/RAM arithmetic).
 */
export function sub_037f(m) {
  const { regs, mem } = m;

  // ── Divider 1: DIFFICULTY_PRESCALER -- one tick per serviced frame ──────────
  // ld hl(10)+ld a,(hl)(7)+inc (hl)(11)+and a(4) = 32 t, exit @ the ret nz (0x0385).
  regs.hl = DIFFICULTY_PRESCALER;
  regs.a = mem.read8(regs.hl); // OLD prescaler
  mem.write8(regs.hl, regs.inc8(regs.a)); // inc (hl); inc8's flags are dead (overwritten by `and a`)
  regs.and(regs.a); // and a -- Z iff old prescaler was 0
  m.step(0x0385, 32);
  if (regs.fNZ) {
    m.ret(11); // ret nz -- not the 1-in-256 frame (Branch A total 43 t)
    return;
  }
  m.step(0x0386, 5); // ret nz NOT taken

  // ── Divider 2: DIFFICULTY_CLOCK -- one tick per 256 frames, passes every 8th ─
  // ld hl(10)+ld a,(hl)(7)+ld b,a(4)+inc (hl)(11)+and 0x07(7) = 39 t, exit @ ret nz (0x038e).
  regs.hl = DIFFICULTY_CLOCK;
  regs.a = mem.read8(regs.hl); // OLD clock
  regs.b = regs.a; // ld b,a -- keep the old clock for the shift
  mem.write8(regs.hl, regs.inc8(regs.a)); // inc (hl); flags dead (overwritten by `and 0x07`)
  regs.and(0x07); // and 0x07 -- Z iff old clock % 8 == 0
  m.step(0x038e, 39);
  if (regs.fNZ) {
    m.ret(11); // ret nz -- not an 8th tick (Branch B total 87 t)
    return;
  }
  m.step(0x038f, 5); // ret nz NOT taken

  // ── Recompute DIFFICULTY = min(LEVEL + (clock >> 3), 5) ─────────────────────
  // ld a,b(4)+rrca x3(12)+ld b,a(4)+ld a,(LEVEL)(13)+add a,b(4)+cp 0x05(7) = 44 t,
  // exit @ the jr c (0x039a).
  regs.a = regs.b; // ld a,b -- A = old clock
  regs.rrca(); regs.rrca(); regs.rrca(); // >>1 x3 -- exact >>3 (low 3 bits are 0)
  regs.b = regs.a; // ld b,a -- B = clock >> 3
  regs.a = mem.read8(LEVEL); // ld a,(0x6229)
  regs.add(regs.b); // add a,b -- A = LEVEL + (clock >> 3)
  regs.cp(0x05); // cp 0x05 -- sets carry consumed by the jr AND left as the exit F
  m.step(0x039a, 44);
  if (regs.fC) {
    m.step(0x039e, 12); // jr c taken -- A < 5, keep it
  } else {
    regs.a = 0x05; // ld a,0x05 -- clamp (no flag change)
    m.step(0x039e, 14); // jr c NOT taken(7) + ld a,0x05(7) = 14 t
  }
  mem.write8(DIFFICULTY, regs.a); // ld (0x6380),a
  m.ret(23); // ld (0x6380),a(13) + ret(10) = 23 t
}
