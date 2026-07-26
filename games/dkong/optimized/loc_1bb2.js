// SPDX-License-Identifier: GPL-3.0-only
import { MARIO_X, MARIO_Y } from "./ram.js";

/**
 * loc_1bb2 — hand-optimized rewrite of the translated routine at ROM 0x1BB2, the
 * AIRBORNE (0x6216==1) movement-update HEAD, proven equal to its oracle by the
 * equivalence harness.
 *
 * WHAT IT DOES. This is the entry the movement machine reaches once Mario is airborne
 * (entry_1ac3's `dec a ; jp z` on MARIO_AIRBORNE). It (1) sets up its OWN IX regime,
 * (2) snapshots this frame's start X/Y into the airborne record, (3) runs the ballistic
 * integrator (call 0x239c) and the direction gate (call 0x241f, which returns D,E), then
 * (4) decrements the FIRST gate value D and forks:
 *   - D != 1 (jp nz): hand off to entry_1bf2 (the SECOND direction-gate, ROM 0x1BF2),
 *     forwarding the IX-relative address helper X. No record write on this arm.
 *   - D == 1 (fall-through): latch the airborne record MIRROR (ix+0x10)=0x00,
 *     (ix+0x11)=0x80, `set 7,(ix+0x07)`, then fall into loc_1bd8 (landing/gravity).
 * entry_1bf2 is the airborne TWIN of this fork (it does the same three writes on its
 * own gate-OFF arm but with 0x10=0xff and `res 7` instead of `set 7`); see optimized/
 * entry_1bf2.js — this routine is its caller/originator.
 *
 * THE X CONTRACT — loc_1bb2 is the X *ORIGINATOR*, not a passthrough recipient. Unlike
 * entry_1bf2 (which THREADS a caller-supplied X), loc_1bb2 builds X ITSELF: it does
 * `ld ix,0x6200` and defines `X(d) = (ix + d) & 0xffff` over that regime, then threads
 * that SAME X UNCHANGED to both tail callees (`m.call(0x1bf2, X)`, `m.call(0x1bd8, X)`)
 * and uses it for its own record writes. So its signature is `loc_1bb2(m)` — NO incoming
 * X param — and it must be preserved. The incoming ix is IRRELEVANT and is overwritten:
 * measured over attract, ix on entry is garbage (0x7525 / 0x66a0), and loc_1bb2 forces
 * 0x6200 every time. (Contrast entry_1bf2, whose ix must FOLLOW the caller's; here the
 * X-threading proof is that loc_1bb2 IGNORES the incoming ix and builds X over 0x6200.)
 *
 *   1bb2  dd 21 00 62   ld ix,0x6200      ; loc_1bb2's OWN IX regime (base of Mario's record)
 *   1bb6  3a 03 62      ld a,(0x6203)     ; A = MARIO_X
 *   1bb9  dd 77 0b      ld (ix+0x0b),a    ; snapshot -> MARIO_AIR_PREV_X (0x620B)
 *   1bbc  3a 05 62      ld a,(0x6205)     ; A = MARIO_Y
 *   1bbf  dd 77 0c      ld (ix+0x0c),a    ; snapshot -> MARIO_AIR_PREV_Y (0x620C)
 *   1bc2  cd 9c 23      call 0x239c       ; ballistic integrator (gravity/velocity)
 *   1bc5  cd 1f 24      call 0x241f       ; direction gate -> returns (D,E)
 *   1bc8  15            dec d             ; FIRST gate value
 *   1bc9  c2 f2 1b      jp nz,0x1bf2      ; D != 1 -> entry_1bf2 (2nd gate)
 *   1bcc  dd 36 10 00   ld (ix+0x10),0x00 ; else: airborne record MIRROR
 *   1bd0  dd 36 11 80   ld (ix+0x11),0x80
 *   1bd4  dd cb 07 fe   set 7,(ix+0x07)   ; set bit 7 of the sprite/flag field
 *   1bd8  ...           (falls into loc_1bd8)
 *
 * NAMES. The two READS are ABSOLUTE addresses -> imported from ram.js: 0x6203 = MARIO_X,
 * 0x6205 = MARIO_Y. The five WRITES/RMW are IX-relative RECORD fields reached through X
 * (0x0b/0x0c/0x10/0x11/0x07) and stay HEX — the record-offset trap (the same offset means
 * a different field in other object records), exactly as entry_1bf2 keeps 0x10/0x11/0x07.
 * For THIS routine's fixed ix=0x6200 they happen to be MARIO_AIR_PREV_X/Y (0x620B/0x620C),
 * MARIO_AIR_VX_HI/LO (0x6210/0x6211) and MARIO_SPRITE_CODE (0x6207); noted in comments.
 *
 * FLAGS. The only flag-writer that matters is `dec d` (regs.dec8) — BOTH the gate
 * decrement (D is not threaded onward here, but its flags select the arm) AND the branch
 * condition (Z/NZ). It is KEPT verbatim. `ld` and `set` are flag-neutral (regs.set: "Flags:
 * none"), so the exit F on BOTH arms is `dec d`'s — preserved bit-for-bit. The tail callee
 * then sets its own F. No droppable flag churn; the readability win is named intent, the
 * flat early-return control flow, the docstring, and the cycle collapse below.
 *
 * CYCLES — COLLAPSED to ONE m.step per straight-line block; the two CALLs stay verbatim.
 *   HEAD block (0x1BB2-0x1BC1): the 5 setup instructions are all IX-relative / absolute
 *     WORK RAM (ix=0x6200 -> 0x620B/0x620C; reads 0x6203/0x6205), NO hardware latch
 *     (0x78xx/0x7Cxx/0x7Dxx), so they fold to a single charge at the block exit PC 0x1BC2:
 *       ld ix(14) + ld a(13) + ld(ix+0x0b)(19) + ld a(13) + ld(ix+0x0c)(19) = 78 t.
 *   CALL 0x239c and CALL 0x241f are BOUNDARIES and are NOT folded across: push16 + the
 *     call's own 17 t (m.step) + m.call stay verbatim for each.
 *   TAIL fork (after 0x241f returns): `dec d` folds into each arm's total:
 *     - gate-ON arm  (D != 1): dec d(4) + jp nz taken(10)                    = 14 t, exit 0x1BF2.
 *     - gate-OFF arm (D == 1): dec d(4) + jp nz NOT-taken(5) + ld(ix+0x10)(19)
 *                              + ld(ix+0x11)(19) + set 7,(ix+0x07)(23)        = 70 t, exit 0x1BD8.
 *   These equal the oracle's per-instruction sums EXACTLY (78 + 14 and 78 + 70, plus the
 *   two identical 17 t call charges). Note the gate-OFF arm has NO trailing `jp` — 0x1BD8
 *   is the next byte after `set`, a FALL-THROUGH into loc_1bd8 (that is why it is 70 t, not
 *   entry_1bf2's mirror 80 t which has an explicit jp). The not-taken `jp nz` is charged
 *   5 t (matching the oracle's `m.step(0x1bcc, 5)`, not textbook Z80's 10 t) — do NOT
 *   "correct" it; the load-bearing invariant is the 70 t arm total. Preserving each branch
 *   total keeps the frame's cycle budget, hence the spin count 0x6019 (PRNG entropy) and
 *   where a later NMI's pushed PC lands, unchanged.
 *
 * GATE — STRICT (byte-exact whole-machine), because loc_1bb2 is ATOMIC. Measured over
 * 5000 attract frames: 360 entries (83 by frame 1200), and EVERY ONE with io.nmiMask
 * CLEARED — i.e. INSIDE the vblank NMI (360/360 in-NMI, 0 out), where the handler cleared
 * the mask on entry so the NMI cannot re-enter. So no NMI lands inside this routine: the
 * head-block fold pushes no mistimed PC, and it passes the byte-exact whole-machine gate
 * directly — NOT the convergent gate (which is for interruptible collapses). It shares the
 * loc_197a -> entry_1ac3 -> loc_1bb2 cascade with its atomic callee entry_1bf2.
 *
 * BRANCH COVERAGE. Only the gate-ON arm (D != 1 -> 0x1BF2) is reached naturally in attract
 * (360/360; entry_1bf2 fires exactly as often). The gate-OFF arm (D == 1) is never
 * dispatched, so the test SYNTHESISES it with cycle teeth and explicit record-write
 * assertions (docs/06 full-branch coverage). See equivalence-1bb2.test.js.
 */
export function loc_1bb2(m) {
  const { regs, mem } = m;

  // HEAD (0x1BB2-0x1BC1): set loc_1bb2's OWN IX regime and snapshot start X/Y.
  // ld ix,0x6200 -- do NOT inherit the caller's ix (measured garbage on entry); X indexes
  // Mario's record off 0x6200 and is threaded UNCHANGED to both tail callees below.
  regs.ix = 0x6200;
  const X = (d) => (regs.ix + d) & 0xffff;
  regs.a = mem.read8(MARIO_X); // ld a,(0x6203)
  mem.write8(X(0x0b), regs.a); // ld (ix+0x0b),a -- MARIO_AIR_PREV_X (0x620B) snapshot
  regs.a = mem.read8(MARIO_Y); // ld a,(0x6205)
  mem.write8(X(0x0c), regs.a); // ld (ix+0x0c),a -- MARIO_AIR_PREV_Y (0x620C) snapshot
  m.step(0x1bc2, 78); // ld ix(14)+ld a(13)+ld(19)+ld a(13)+ld(19); exit 0x1BC2

  // call 0x239c -- ballistic integrator (gravity/velocity). Boundary: verbatim.
  m.push16(0x1bc5);
  m.step(0x239c, 17);
  m.call(0x239c);

  // call 0x241f -- direction gate; returns (D,E). Boundary: verbatim.
  m.push16(0x1bc8);
  m.step(0x241f, 17);
  m.call(0x241f);

  // dec d ; jp nz,0x1bf2 -- FIRST direction gate. `dec d` kept verbatim (decrement +
  // branch condition + exit F for both arms).
  regs.d = regs.dec8(regs.d);
  if (regs.fNZ) {
    // gate ON (D was != 1): hand the airborne update to entry_1bf2 (the 2nd gate). No write.
    m.step(0x1bf2, 14); // dec d(4) + jp nz,0x1bf2 taken(10)
    return m.call(0x1bf2, X); // X threaded UNCHANGED
  }

  // gate OFF (D was 1 -> 0): latch the airborne record MIRROR, then FALL into loc_1bd8.
  // All three stores are IX-relative WORK RAM (0x6210/0x6211/0x6207) -> one folded block.
  mem.write8(X(0x10), 0x00); // ld (ix+0x10),0x00 -- MARIO_AIR_VX_HI (0x6210)
  mem.write8(X(0x11), 0x80); // ld (ix+0x11),0x80 -- MARIO_AIR_VX_LO (0x6211)
  mem.write8(X(0x07), regs.set(7, mem.read8(X(0x07)))); // set 7,(ix+0x07) -- MARIO_SPRITE_CODE (0x6207)
  m.step(0x1bd8, 70); // dec d(4)+jp nz nt(5)+ld(19)+ld(19)+set(23); exit 0x1BD8 (fall-through)
  return m.call(0x1bd8, X); // X threaded UNCHANGED
}
