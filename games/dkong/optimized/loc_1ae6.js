// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1ae6 — hand-optimized rewrite of the translated routine at ROM 0x1AE6,
 * proven equal to its oracle by the equivalence harness.
 *
 * Its ONLY absolute-address access is a READ of 0x6010 (the per-frame player-input
 * shadow, ram.js name P1_INPUT — written by the input-copy at ROM 0x00AC, consumed by
 * entry_1ac3). Per this sweep's convention the address is kept hex with a comment
 * rather than imported, so this file imports nothing from ram.js. Every other operand
 * is a CPU register (A, D, E) the callee sub_241f / the caller set up. It takes a
 * SECOND parameter R — the caller's IX-relative address helper — and threads it,
 * unchanged, into the loc_1af5 tail call (arms A and C), exactly as the oracle does.
 */

/**
 * loc_1ae6 -- WALK/CLIMB direction pick, FIRST direction, gated by sub_241f's (D,E).
 * [ROM 0x1AE6-0x1AF4, tail-continuing into loc_1af5 at 0x1AF5]
 *
 *   1ae6  cd 1f 24     call 0x241f        ; sub_241f -> position gate (D,E); pushes 0x1AE9
 *   1ae9  3a 10 60     ld a,(0x6010)      ; A = player input (P1_INPUT)
 *   1aec  1d           dec e              ; E = sub_241f's E-gate value
 *   1aed  ca f5 1a     jp z,0x1af5        ; E was 1 -> gate off: skip input test, go 2nd dir
 *   1af0  cb 47        bit 0,a            ; else test player-input bit 0 (this direction)
 *   1af2  c2 8f 1c     jp nz,0x1c8f       ; input bit 0 pressed -> movement handler 0x1C8F
 *                      (fall through)     ; else -> second-direction gate loc_1af5
 *
 * WHAT IT DOES. This is the FIRST of the two mirrored direction gates in the walk/climb
 * direction pick (loc_1af5 is the SECOND, one gate down). sub_241f returns a (D,E) pair
 * describing which horizontal moves are legal from the player's position; loc_1ae6
 * consumes the E-gate and input bit 0, loc_1af5 consumes the D-gate and input bit 1:
 *   - E == 1 on entry (`dec e` -> 0, Z): this direction is not applicable this frame, so
 *     jump straight to the second-direction gate loc_1af5 (no input test).
 *   - E != 1: test player-input bit 0. Set -> hand off to the movement handler at 0x1C8F.
 *     Clear -> fall through to loc_1af5.
 * Both `jp` transfers are TAIL jumps (no push): loc_1af5 / loc_1c8f run and their own
 * `ret` returns to loc_1ae6's CALLER, so they are `return m.call(...)` here. The mid-body
 * `call 0x241f` is a REAL call (pushes its 0x1AE9 return address) and IS kept verbatim.
 *
 * THE R-PASSTHROUGH CONTRACT (the one non-obvious thing to get right). loc_1ae6 is
 * entered as `loc_1ae6(m, R)` where R is the caller's IX-relative address closure
 * (entry_1ac3's `R = d => (regs.ix + d) & 0xffff`). It is threaded to the loc_1af5 tail
 * call ONLY -- `m.call(0x1af5, R)` on both arms that reach it (A and C) -- because
 * loc_1af5's own spine (loc_1afe) addresses the player record through the caller's IX
 * regime via R. It is NOT passed to `m.call(0x241f)` (sub_241f takes no R) nor to
 * `m.call(0x1c8f)` (the movement handler sets up its own addressing; oracle passes none).
 * Getting any of these wrong would silently change which memory the tail routine reads.
 *
 * INPUTS  : R (caller's IX-relative helper, forwarded to loc_1af5). RAM 0x6010 (P1_INPUT).
 *           sub_241f's outputs D,E (D untouched here, passed through to loc_1af5). The
 *           stack (a caller return address for the tail callee's `ret`).
 * OUTPUTS : A := (0x6010); E decremented; F set by `dec e` (arm A) or `bit 0,a` (arms
 *           B,C); D unchanged; then the tail/mid callees' full effects. PC/SP via the
 *           call + tail call. sub_241f writes NO memory and loc_1ae6 writes none either.
 *
 * FLAGS -- both flag-writers are KEPT verbatim; neither is droppable churn, and both are
 * the branch conditions:
 *   - `dec e` writes E (an output register) and sets S/Z/H/P-V/N; Z is the arm-A test AND
 *     E is the value loc_1af5 receives, so it stays.
 *   - `bit 0,a` sets Z (:= (A & 0x01)==0), H:=1, N:=0, and the undocumented F3/F5 from A.
 *     It is the arm-B/C branch condition, and it is the last flag-writer on both the move
 *     arm and the fall-through arm, so keeping it verbatim makes the exit F bit-identical
 *     to the oracle for free (the unit gate compares the whole register file incl. F3/F5).
 *   There is essentially NO churn to drop here -- the two register ops ARE the logic. The
 *   readability win is named intent, flat early-return control flow (vs the oracle's nested
 *   if/else), the docstring, and the cycle collapse below.
 *
 * CYCLES -- COLLAPSED to ONE m.step per branch, per the decompiler-pipeline doc. The mid-body `call 0x241f`
 * is a BOUNDARY (the callee runs between the charge and the next instruction) so its 17 t
 * charge stays verbatim BEFORE m.call(0x241f) and is NOT folded across; the post-call
 * straight-line run is then folded once per arm at the arm's exit PC:
 *   - gate-off arm  (E==1):    call(17) + [ld a(13) + dec e(4) + jp z taken(10) = 27]      = 44 t, exit 0x1AF5.
 *   - move arm      (bit0 set): call(17) + [13 + 4 + jp z not-taken(10) + bit(12)
 *                                           + jp nz taken(10) = 49]                          = 66 t, exit 0x1C8F.
 *   - fall-through  (bit0 clr): call(17) + [13 + 4 + jp z not-taken(10) + bit(12) = 39]      = 56 t, exit 0x1AF2.
 * These totals equal the oracle's exactly. There is NO hardware-latch write anywhere in
 * loc_1ae6 (only a work-RAM READ of 0x6010) and none in sub_241f (a pure read-only query),
 * so no bus-cycle boundary is pinned inside the fold. Preserving each branch total keeps
 * the frame's cycle budget -- hence the main-loop spin count 0x6019/SPIN_COUNT (the PRNG
 * entropy) -- unchanged.
 *
 *   ** The fall-through arm rests PC at 0x1AF2, not 0x1AF5, and charges NO jp-nz not-taken
 *   cost -- deliberately matching the oracle, NOT textbook Z80. ** The oracle emits no
 *   m.step for the `jp nz,0x1c8f` not-taken transfer into loc_1af5; the codebase convention
 *   is that a fall-through into the NEXT labeled routine reached via `m.call` is uncharged
 *   (loc_1af5's own fall-through into loc_1afe does the same). loc_1af5's first op
 *   (`dec d`, m.step(0x1af6,4)) overwrites PC unconditionally, so the 0x1AF2 entry PC never
 *   survives; the load-bearing invariant is the 39 t post-call total, preserved exactly.
 *   Do not "fix" this to 0x1AF5/+10 t -- it would diverge from the oracle.
 *
 * REACHABILITY / ATOMICITY (MEASURED; why the collapse is licensed under the STRICT gate).
 * loc_1ae6 is dispatched from the per-frame movement cascade under loc_197a
 * (entry_1ac3 -> loc_1ae6). Probed over 1400 attract frames: 622 entries (first once the
 * attract demo starts PLAYING 25m, ~frame 626). It is ATOMIC: every one of those 622
 * entries occurs with io.nmiMask CLEARED -- i.e. INSIDE the vblank NMI (622/622 in-NMI,
 * 0 out), where the handler cleared the mask on entry so the NMI cannot re-enter -- and
 * the NMI's pushed PC NEVER lands in [0x1AE6,0x1AF5) (0 landings over 1394 NMIs; all land
 * in the 0x02BD-0x0372 main-loop band). So the older "loc_197a cascade is interruptible"
 * docstrings are STALE for this routine: no NMI lands inside it, an atomic collapse pushes
 * no mistimed PC and tears no raster, and it passes the BYTE-EXACT whole-machine gate
 * directly (no convergent gate needed). See equivalence-1ae6.test.js.
 *
 * Naturally reached in attract: the move arm (bit0-set, 335x) and the fall-through arm
 * (bit0-clear, 287x -- these are exactly loc_1af5's 287 entries, since arm C is its
 * feeder). The gate-off arm (E==1, the sub_241f far-right-edge (0,1) case) is NOT reached
 * in attract, so the test SYNTHESISES it with cycle teeth (docs/decompiler-pipeline full-branch coverage).
 */
export function loc_1ae6(m, R) {
  const { regs, mem } = m;

  // call 0x241f -- position gate; pushes 0x1AE9, charges the CALL's 17 t, then runs
  // sub_241f (read-only) which returns the (D,E) legal-move pair. NOT passed R.
  m.push16(0x1ae9);
  m.step(0x241f, 17);
  m.call(0x241f);

  // ld a,(0x6010): A = this frame's player input (P1_INPUT). dec e: E is sub_241f's
  // E-gate; Z means this direction is inapplicable (E was 1). Both fold into the arms.
  regs.a = mem.read8(0x6010); // P1_INPUT
  regs.e = regs.dec8(regs.e);
  if (regs.fZ) {
    // gate off -> skip the input test, go straight to the second-direction gate.
    m.step(0x1af5, 27); // ld a(13) + dec e(4) + jp z,0x1af5 taken(10)
    return m.call(0x1af5, R);
  }

  // E active -> test player-input bit 0 (Z := (A & 0x01) == 0); kept verbatim so the
  // exit F matches the oracle bit-for-bit.
  regs.bit(0, regs.a);
  if (regs.fNZ) {
    // input bit 0 pressed -> hand off to the movement handler at 0x1C8F (no R).
    m.step(0x1c8f, 49); // 13 + 4 + jp z not-taken(10) + bit 0,a(12) + jp nz taken(10)
    return m.call(0x1c8f);
  }

  // input bit 0 clear -> fall through to the second-direction gate loc_1af5.
  // NOTE: exit PC 0x1AF2 and no jp-nz not-taken charge -- exactly the oracle (see docstring).
  m.step(0x1af2, 39); // 13 + 4 + jp z not-taken(10) + bit 0,a(12)
  return m.call(0x1af5, R);
}
