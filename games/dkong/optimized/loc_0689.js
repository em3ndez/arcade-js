// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0689 — hand-optimized rewrite of the translated routine at ROM 0x0689,
 * proven equal to its oracle by the equivalence harness.
 *
 * One routine per file. loc_0689 is a LEAF: it calls nothing, so there is no
 * `m.call` here and nothing is imported from translated/. It writes two video-RAM
 * cells, which are hex here (VRAM tile cells, not work RAM) — ram.js names only
 * work RAM 0x6000-0x6BFF, so these stay hex with a comment, exactly as the other
 * optimized routines leave their VRAM stores (e.g. loc_0a8a's 0x76A3/0x7663).
 */

/**
 * loc_0689 -- the shared two-digit STAMP tail of loc_066a. [ROM 0x0689-0x0690]
 *
 *   0689  32 e6 74   ld (0x74e6),a   ; VRAM cell <- A (the high-digit tile)
 *   068c  78         ld a,b          ; A <- B (the low-digit tile loc_066a staged)
 *   068d  32 c6 74   ld (0x74c6),a   ; VRAM cell <- B
 *   0690  c9         ret
 *
 * WHAT IT DOES. loc_066a splits the packed two-nibble BCD byte at 0x638C into two
 * character tiles and hands loc_0689 the pair in A and B; loc_0689 stamps them
 * into the two video-RAM cells of that display field: A -> 0x74E6, then B ->
 * 0x74C6 (0x74E6 written FIRST, matching the oracle's order and the loc_066a note;
 * the two cells are 0x20 apart = one screen column on the rotated tilemap). No
 * data-dependent branch — a single straight-line path — so both loc_066a arms
 * (the jp-nz "high nibble nonzero" arm and the leading-zero-suppress fall-through
 * arm, which enters with A = 0x10) run these same four instructions; only the
 * register VALUES they bring differ.
 *
 * INPUTS: A = first tile, B = second tile (from loc_066a). No RAM read.
 * OUTPUTS: video RAM 0x74E6 <- (incoming A) and 0x74C6 <- B; register A ends = B
 *   (the `ld a,b`). Nothing downstream reads A after the return (loc_066a's caller
 *   proceeds to the task loop), but the unit gate compares the whole register file,
 *   so `A := B` is reproduced exactly.
 *
 * FLAGS: loc_0689 contains NO flag-affecting instruction — two `ld (nn),a`, one
 *   `ld a,b`, and `ret` all leave F untouched. The F handed back by the 0x0690 ret
 *   is therefore the flags loc_066a's arm left (`add a,b` @0x0685 on the suppress
 *   arm, `and 0x0f` @0x0673 on the jp-nz arm — see the loc_066a header). This
 *   rewrite performs no flag op, so that incoming F passes through byte-identical
 *   to the oracle; the unit gate's F comparison confirms it.
 *
 * CYCLES — COLLAPSED to one m.step for the whole straight-line body (no branch, so the
 *   whole routine is one basic block). loc_0689 is reached ONLY via loc_066a, and loc_066a
 *   is reached only from entry_062a — a MAIN-LOOP task (task-table entry 10, dispatched by
 *   dispatchTask with the NMI mask ENABLED), so a vblank NMI could in principle land inside
 *   this 3-instruction body; the whole-machine gate (see the test) is therefore the
 *   CONVERGENT one, not the strict byte-exact one, per the collapse-sweep brief's
 *   unconditional rule for a collapsed routine's whole-machine test. The two stores are
 *   VIDEO RAM, not 0x7Dxx hardware latches, so they carry no write-trace bus-cycle
 *   constraint (per loc_0a8a: video + work RAM collapse with no trace consequence) — nothing
 *   stops folding all three charges together. 13 (ld (0x74e6),a) + 4 (ld a,b) + 13
 *   (ld (0x74c6),a) = 30 t, exit 0x0690; the 10t `ret` stays separate (RET scaffolding).
 *   Memory-write ORDER is unchanged (0x74E6 still written before 0x74C6).
 */
export function loc_0689(m) {
  const { regs, mem } = m;

  // ld (0x74e6),a; ld a,b; ld (0x74c6),a.  13+4+13 = 30 t, exit 0x0690.
  // 0x74E6 (first tile, A) is a video-RAM tile cell (0x7400-0x77FF), written BEFORE
  // 0x74C6 (second tile, B) per the oracle; A ends = B (the `ld a,b`).
  mem.write8(0x74e6, regs.a);
  regs.a = regs.b;
  mem.write8(0x74c6, regs.a);
  m.step(0x0690, 30);

  m.ret(); // 0690 -- 10t; F is loc_066a's arm flags, passed through untouched.
}
