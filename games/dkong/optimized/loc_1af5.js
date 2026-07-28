// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1af5 — hand-optimized rewrite of the translated routine at ROM 0x1AF5,
 * proven equal to its oracle by the equivalence harness.
 *
 * It touches NO absolute RAM address — every operand is a CPU register (D, A) the
 * caller set up — so it imports nothing from ram.js. Register A is the player-input
 * byte the caller (loc_1ae6) loaded from P1_INPUT (0x6010); register D is the second
 * of the two direction-gate values sub_241f returns in (D,E).
 */

/**
 * loc_1af5 -- SECOND direction-gate of the walk/climb direction pick.
 * [ROM 0x1AF5-0x1AFD, falling into loc_1afe at 0x1AFE]
 *
 *   1af5  15            dec d              ; D = sub_241f's 2nd gate value
 *   1af6  ca fe 1a      jp z,0x1afe        ; D was 1 -> gate off, skip to climb-collision
 *   1af9  cb 4f         bit 1,a            ; else test player-input bit 1
 *   1afb  c2 ab 1c      jp nz,0x1cab       ; input bit 1 pressed -> movement handler 0x1CAB
 *                       (fall through)     ; else -> climb-collision spine loc_1afe
 *
 * WHAT IT DOES. This is the twin of loc_1ae6 one gate down. loc_1ae6 handled the
 * FIRST direction: `dec e ; jp z,0x1af5 ; bit 0,a ; jp nz,0x1c8f`, i.e. if sub_241f's
 * E-gate is off skip the bit-0 test, else pressing input bit 0 hands off to 0x1C8F.
 * loc_1af5 does the mirror for the SECOND direction with the D-gate and input bit 1:
 *   - D == 1 on entry (`dec d` -> 0, Z): this direction is not applicable this frame,
 *     so jump straight to the climb-collision spine loc_1afe (no input test).
 *   - D != 1: test player-input bit 1. Set -> hand off to the movement handler at
 *     0x1CAB. Clear -> fall through to loc_1afe.
 * Both `jp` transfers are TAIL jumps (no push): loc_1afe / loc_1cab run and their
 * own `ret` returns to loc_1af5's CALLER, so they are `return m.call(...)` here.
 *
 * INPUTS  : D (sub_241f's 2nd direction-gate value), A (player input, P1_INPUT
 *           0x6010, loaded by loc_1ae6), R (the IX-relative address helper the
 *           entry_1ac3 -> loc_1ae6 chain threads through -- forwarded to loc_1afe,
 *           which uses the caller's IX regime). The stack (a caller return address
 *           for the tail callee's `ret`).
 * OUTPUTS : D decremented; F set by `dec d` then (unless the gate fired) `bit 1,a`;
 *           then the tail callee's full effects. PC/SP move via the tail call.
 *
 * NAMES. No naming candidate: the routine reads no absolute address (only registers
 * D and A). A's source, P1_INPUT (0x6010), is already named in ram.js but is not
 * referenced here, so nothing is imported.
 *
 * FLAGS -- both flag-writers are KEPT verbatim; neither is droppable churn:
 *   - `dec d` writes D (an OUTPUT register) and sets S/Z/H/P-V/N; it is BOTH the
 *     gate value's decrement and the branch condition, so it stays.
 *   - `bit 1,a` sets Z (:= (A & 0x02)==0), H:=1, N:=0, and the undocumented F3/F5
 *     from A. It is the input-bit branch condition. It is NOT dropped even though
 *     both tail callees (loc_1afe: `ld a,(0x6217)`; loc_1cab: `ld b,0xff`) overwrite
 *     nothing flag-related on entry -- proving every bit it sets is dead before its
 *     next writer would require auditing those callees, and the op is the branch test
 *     anyway. Keeping it verbatim makes the exit F bit-identical to the oracle for
 *     free (unit gate compares the whole register file incl. F3/F5).
 *   There is essentially NO churn to drop here -- the two register ops ARE the logic.
 *   The readability win is the named intent, the flat early-return control flow (vs
 *   the oracle's nested if/else), the docstring, and the cycle collapse below.
 *
 * CYCLES -- COLLAPSED to ONE m.step per branch TOTAL (the routine writes NO memory,
 * so no hardware-latch bus cycle pins an intermediate boundary):
 *   - gate-off arm  (D==1): dec d(4) + jp z taken(10)                     = 14 t, exit 0x1AFE.
 *   - move arm      (bit1 set): dec d(4) + jp z not-taken(10) + bit(12)
 *                               + jp nz taken(10)                          = 36 t, exit 0x1CAB.
 *   - fall-through  (bit1 clr): dec d(4) + jp z not-taken(10) + bit(12)    = 26 t, exit 0x1AFB.
 * These totals equal the oracle's exactly (see below on the fall-through). Preserving
 * each branch total keeps the frame's cycle budget -- hence the main-loop spin count
 * 0x6019 (the PRNG entropy) -- unchanged.
 *
 *   ** The fall-through arm rests PC at 0x1AFB, not 0x1AFE, and charges NO jp-nz
 *   not-taken cost -- deliberately matching the oracle, NOT textbook Z80. ** The
 *   oracle emits no m.step for the `jp nz,0x1cab` not-taken transfer into loc_1afe;
 *   the codebase's convention is that a fall-through into the NEXT labeled routine
 *   reached via `m.call` is uncharged (loc_1ae6's mirror arm does the same into
 *   loc_1af5). loc_1afe's first op (`ld a,(0x6217)`, m.step(0x1b01,13)) overwrites PC
 *   unconditionally, so the entry PC never survives; the load-bearing invariant is the
 *   26 t total, which is preserved exactly. Do not "fix" this to 0x1AFE/+10 t -- it
 *   would diverge from the oracle.
 *
 * REACHABILITY / ATOMICITY (measured; why the collapse is licensed under the STRICT
 * gate). loc_1af5 is dispatched from the per-frame movement cascade under loc_197a
 * (entry_1ac3 -> loc_1ae6 -> loc_1af5). Probed over 1400 attract frames: 287 entries
 * (first at frame 842). It is ATOMIC: every one of those 287 entries occurs with
 * io.nmiMask CLEARED -- i.e. INSIDE the vblank NMI (287/287 in-NMI, 0 out), where the
 * handler cleared the mask on entry so the NMI cannot re-enter -- and the NMI's pushed
 * PC never lands in [0x1AF5,0x1AFE) (0 landings; all landings fall in the 0x02BD-0x0372
 * main-loop band). So the older "loc_197a cascade is interruptible" docstrings are
 * STALE for this routine: no NMI lands inside it, an atomic collapse pushes no mistimed
 * PC and tears no raster, and it passes the BYTE-EXACT whole-machine gate directly (no
 * convergent gate needed). See equivalence-1af5.test.js.
 *
 * Only the fall-through and move arms are reached naturally in attract (bit1-clear 138x,
 * bit1-set 149x); the gate-off arm (D==1) is not, so the test SYNTHESISES it with cycle
 * teeth (docs/decompiler-pipeline full-branch coverage).
 */
export function loc_1af5(m, R) {
  const { regs } = m;

  // dec d: decrement sub_241f's 2nd direction-gate value (D is an output register).
  regs.d = regs.dec8(regs.d);
  if (regs.fZ) {
    // D was 1 -> gate off: skip the input test, go to the climb-collision spine.
    m.step(0x1afe, 14); // dec d(4) + jp z,0x1afe taken(10)
    return m.call(0x1afe, R);
  }

  // D active -> test player-input bit 1 (Z := (A & 0x02) == 0); kept verbatim so the
  // exit F matches the oracle bit-for-bit.
  regs.bit(1, regs.a);
  if (regs.fNZ) {
    // input bit 1 pressed -> hand off to the movement handler at 0x1CAB (no R).
    m.step(0x1cab, 36); // dec d(4) + jp z not-taken(10) + bit 1,a(12) + jp nz taken(10)
    return m.call(0x1cab);
  }

  // input bit 1 clear -> fall through to the climb-collision spine loc_1afe.
  // NOTE: exit PC 0x1AFB and no jp-nz not-taken charge -- exactly the oracle (see docstring).
  m.step(0x1afb, 26); // dec d(4) + jp z not-taken(10) + bit 1,a(12)
  return m.call(0x1afe, R);
}
