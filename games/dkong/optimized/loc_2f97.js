// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2f97 — hand-optimized rewrite of the translated routine at ROM 0x2F97,
 * proven equal to its oracle by the equivalence harness.
 *
 * WHAT IT DOES. loc_2f97 is the `(0x6217) bit0 clear` tail of entry_2ed4, the two-object
 * sprite-state updater dispatched inside loc_197a's per-frame NMI cascade. entry_2ed4
 * reaches here via `jp nc,0x2f97` when MARIO_HAMMER_ACTIVE (0x6217) bit0 is clear — the
 * hammer is not in its active-attribute phase. loc_2f97 then makes a one-bit decision on
 * MARIO_HAMMER_PENDING (0x6218):
 *
 *   - bit0 CLEAR (overwhelmingly the common case): nothing to build — `ret` (EXIT-2).
 *   - bit0 SET: build the alternate sprite-attribute pair B/C for this object, mirror the
 *     current BGM latch (SND_BGM 0x6089 -> SCRATCH_6389 0x6389), and fall through
 *     (`jp 0x2f7c`) into loc_2f7c, THE shared record write (x/B/C/y written through
 *     DE->HL, with x/y also mirrored to (ix+3)/(ix+5)).
 *
 * The B/C build: `ld (ix+9),6` / `ld (ix+a),3` set the object's frame counters; then
 * A = MARIO_SPRITE_CODE (0x6207) is `rlca`'d so its bit7 lands in CARRY, and that carry is
 * rotated into bit7 of the literal 0x3C by `ld a,0x3c / rra` — so B becomes 0x1E with
 * bit7 = the object's facing (sprite-code bit7). C is the constant 0x07.
 *
 * INPUTS  : IX = the object record base (0x6680 or 0x6690, set by entry_2ed4); DE = the
 *           record destination (0x6A18/0x6A1C) consumed by loc_2f7c; MARIO_HAMMER_PENDING
 *           (0x6218) — the deciding bit; on the build arm also MARIO_SPRITE_CODE (0x6207),
 *           SND_BGM (0x6089), and (for loc_2f7c) MARIO_X/Y (0x6203/0x6205) and (ix+0e/0f).
 * OUTPUTS : ret arm — early return, no work-RAM write (only A/F from the read+rrca change).
 *           build arm — (ix+9)=6, (ix+a)=3, SCRATCH_6389 := SND_BGM, B/C set, then
 *           loc_2f7c's record write; control tail-jumps into loc_2f7c and returns through
 *           ITS `ret` to entry_2ed4's caller (0x199B in loc_197a).
 *
 * FLAGS. The one flag this routine's OWN control reads is CARRY, set by `rrca` and read by
 * `ret nc` — kept verbatim (regs.rrca / regs.fNC). On the build arm the exit F is whatever
 * `rra` (0x2FAB) left (C = bit0 of 0x3C = 0, H=0, N=0; S/Z/P unchanged); nothing after it
 * touches flags before the jp, so keeping regs.rlca/regs.rra reproduces the boundary F that
 * m.call(0x2f7c) then hands to loc_2f7c. No flag is dropped.
 *
 * GATE — STRICT (byte-exact whole-machine), because loc_2f97 is ATOMIC. MEASURED over a
 * 1200-frame attract run: 616 dispatches, io.nmiMask == 0 at 616/616 (it runs only inside
 * loc_197a's NMI cascade, where entry_0066 has cleared the NMI mask, so the vblank NMI
 * cannot re-enter), and the NMI's pushed PC never lands in [0x2F97,0x2FB5) (0 landings; none
 * anywhere in 0x2Fxx — all in the 0x02BD-0x0372 main-loop band). entry_2ed4 (0x2ED4) has a
 * SINGLE caller (loc_197a @0x1998) and no dispatch-table entry, so there is no mask-enabled
 * call path; atomicity holds on EVERY path. An atomic routine whose collapse preserves each
 * arm's exact cycle TOTAL pushes no mistimed PC and tears no raster, so it passes the strict
 * byte-exact gate directly and does NOT need the convergent gate.
 *
 * COLLAPSE (the decompiler-pipeline doc). No hardware-latch write occurs — every write is work RAM: (ix+9)/(ix+a)
 * at 0x6689/0x668A (or 0x6699/0x669A) and SCRATCH_6389; none in 0x7800-0f/0x7c00/0x7c80/
 * 0x7d00-07/0x7d80-87 — so straight-line runs fold freely; only the `ret` and the `jp`
 * boundary (m.call) are kept. Per-arm OWN totals (excluding loc_2f7c):
 *   - Block 1 (pre-branch): ld a,(0x6218) 13 + rrca 4 = 17 t, exit 0x2F9B.
 *   - RET arm (0x6218 bit0=0): 17 + `ret nc` taken 11 = 28 t. Self-contained, no callee.
 *   - BUILD arm (bit0=1): 17 + [`ret nc` not-taken 5 + body 0x2F9C..0x2FB4 incl `jp` =
 *     19+19+13+4+7+4+4+7+13+13+10 = 113] = 17 + 118 = 135 t, exit 0x2F7C, then m.call.
 *     Full arm incl loc_2f7c = 135 + 162 = 297 t (both verified against the oracle).
 *
 * BRANCH COVERAGE. Attract exercises ONLY the RET arm (measured 616/616 — MARIO_HAMMER_PENDING
 * bit0 is 0 there, no hammer object pending), so the strict whole-machine gate covers it and
 * proves total-preservation live. The BUILD arm is unreached in the attract/gameplay windows,
 * so equivalence-2f97.test.js SYNTHESISES it (identical-both-sides seed: 0x6218=1, IX=0x6680,
 * DE=0x6A18) and pins it EQUAL over RAM + full register file + pc + SP AND its exact cycle
 * total (297 t) against the oracle, with a dropped-charge twin as the teeth.
 *
 * NAMES: MARIO_HAMMER_PENDING (0x6218), MARIO_SPRITE_CODE (0x6207), SND_BGM (0x6089) are
 * imported from ram.js. 0x6389 is only a `SCRATCH_6389` placeholder in ram.js's reverse map
 * (no evidenced meaning yet), so it stays hex with a comment — matching sub_2a22's treatment
 * of 0x6600. The ix offsets (+9/+a) stay hex — a record offset, not an absolute address (the
 * record-offset trap).
 */
import { MARIO_HAMMER_PENDING, MARIO_SPRITE_CODE, SND_BGM } from "./ram.js";

export function loc_2f97(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff; // object record base (IX = 0x6680/0x6690)

  // Block 1: ld a,(0x6218) [13] + rrca [4] = 17 t. rrca drops MARIO_HAMMER_PENDING bit0
  // into CARRY, which `ret nc` reads. exit 0x2F9B.
  regs.a = mem.read8(MARIO_HAMMER_PENDING);
  regs.rrca();
  m.step(0x2f9b, 17);

  // ret nc — MARIO_HAMMER_PENDING bit0 clear: nothing to build, return (EXIT-2, 11 t).
  if (regs.fNC) {
    m.ret(11);
    return;
  }

  // BUILD arm (bit0 set). ret-nc not-taken [5] + the whole 0x2F9C..0x2FB4 body incl the
  // `jp 0x2f7c` [113] = 118 t — one basic block, no latch write, no call boundary until the
  // jp. Fold to a single m.step at the jp target, then hand off to loc_2f7c.
  mem.write8(R(0x09), 0x06);          // ld (ix+0x09),0x06  — object frame counter
  mem.write8(R(0x0a), 0x03);          // ld (ix+0x0a),0x03
  regs.a = mem.read8(MARIO_SPRITE_CODE);
  regs.rlca();                        // CARRY <- sprite-code bit7 (facing)
  regs.a = 0x3c;
  regs.rra();                         // A = 0x3C>>1 with that facing bit rotated into bit7
  regs.b = regs.a;                    // B = attribute byte (0x1E | facing<<7)
  regs.c = 0x07;                      // C = constant 0x07
  regs.a = mem.read8(SND_BGM);
  mem.write8(0x6389, regs.a);         // ld (0x6389),a -- SCRATCH_6389 (ram.js placeholder): mirror BGM for loc_2f7c
  m.step(0x2f7c, 118);

  return m.call(0x2f7c);              // jp 0x2f7c — the shared record write (convergence)
}
