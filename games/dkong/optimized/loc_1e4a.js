// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1e4a — hand-optimized rewrite of the translated routine at ROM 0x1E4A,
 * proven equal to its frozen oracle (translated/state0.js) by the equivalence
 * harness (equivalence-1e4a.test.js).
 *
 * WHAT IT DOES. This is sub_1dbd's rst-28 dispatch arm for dispatcher-state 2
 * (0x6340 == 2): a once-per-frame COUNTDOWN that resets the dispatcher on expiry.
 * Each frame it decrements the state-2 hold timer at 0x6341 in place; while the
 * timer is still running it `ret nz` and the machine stays in state 2. On the
 * frame the timer reaches 0 it clears 0x6A30 and resets the dispatcher state
 * 0x6340 := 0 (back to sub_1dbd's state-0 idle arm loc_1e49), ending the hold.
 * The timer is armed to 0x40 (64 frames) by state 1 (loc_1dc9 @0x1DC9, which also
 * advances 0x6340 1->2), so a full hold is exactly 64 dispatches: 63 ret-nz then
 * one expiry — the "attract=64" window (measured frames 1138..1201 in plain boot).
 *
 *   1e4a  21 41 63     ld   hl,0x6341     ; HL -> the state-2 countdown byte
 *   1e4d  35           dec  (hl)          ; decrement it in place (RMW); Z = expired
 *   1e4e  c0           ret  nz            ; still counting -> stay in state 2
 *   1e4f  af           xor  a             ; A := 0 (and the exit flags)
 *   1e50  32 30 6a     ld   (0x6a30),a    ; clear the 0x6A30 param-block byte
 *   1e53  32 40 63     ld   (0x6340),a    ; reset dispatcher state -> 0 (idle)
 *   1e56  c9           ret
 *
 * NAMES (kept hex here; proposed as candidates, not landed in ram.js):
 *   0x6340 — sub_1dbd's DISPATCHER STATE byte (rst-28 router index at 0x1DC1:
 *            0=idle, 1=arm-timer, 2=this countdown, 3=reset). Control-proven.
 *   0x6341 — the state-2 COUNTDOWN timer (armed 0x40 by loc_1dc9). Control-proven.
 *   0x6A30 — first byte of the param block loc_1e28/loc_1e36 write during the
 *            object-hit/score-popup sequence; cleared to 0 here on expiry. Weaker,
 *            state-dependent evidence — left unnamed. See the naming report.
 *
 * GATE — STRICT whole-machine (+ unit), NOT convergent. loc_1e4a is ATOMIC: it
 * runs inside the vblank-NMI cascade (entry_0066 -> ... -> loc_197a -> sub_1dbd ->
 * here) under the handler's cleared NMI mask, so the NMI cannot re-enter it and no
 * pushed PC lands in its 0x1Exx range (the 0x02BD–0x0372 main-loop band owns 99.6%
 * of landings; the decompiler-pipeline doc). The rewrite is also byte-exact (identical writes, same
 * order) and total-preserving, so the strict gate is the right, stronger gate — and
 * it is self-validating for atomicity: had the collapse redistributed cycles across
 * a real mid-routine NMI, the wrong pushed PC would surface as stack drift. It fires
 * 64x over the 1210-frame window (63 ret-nz + 1 expiry), covering BOTH arms.
 *
 * COLLAPSE (the decompiler-pipeline doc §Cycles — preserve each arm's TOTAL, drop the per-instr split).
 * Two basic blocks, one per arm; no callees, no hardware-latch write, so nothing
 * pins an interior charge.
 *   • ret-nz arm (timer > 0): ld hl (10) + dec (hl) (11) folded to one m.step at the
 *     block's exit PC 0x1E4E (21 t), then `ret nz` taken (m.ret(11)). TOTAL 32 t.
 *   • expiry arm (timer == 0): ld hl (10) + dec (hl) (11) + ret-nz-not-taken (5) +
 *     xor a (4) + ld (0x6a30),a (13) + ld (0x6340),a (13) folded to one m.step at
 *     exit PC 0x1E56 (56 t), then `ret` (m.ret(10)). TOTAL 66 t.
 * Both totals equal the oracle's exactly, so SPIN_COUNT/PRNG (0x6019) is unchanged.
 *
 * FLAGS. ret-nz arm: the exit F is dec (hl)'s flags (regs.dec8 sets them and nothing
 * after touches F) and A is untouched — matching the oracle. Expiry arm: the exit F
 * is `xor a`'s (the last flag writer; the trailing ld/ret leave F alone) and A := 0.
 * The unit gate compares the whole register file incl. F, so a dropped-but-read flag
 * would be caught.
 *
 * INPUTS  : mem[0x6341] (the timer). OUTPUTS: mem[0x6341] decremented always; on
 *           expiry mem[0x6A30]:=0 and mem[0x6340]:=0, A:=0. SP/PC: one `ret` on each
 *           arm pops the return address into sub_1dbd's dispatch (0x1DC1 tail).
 */

const COUNTDOWN = 0x6341; // state-2 hold timer, decremented each frame (armed 0x40 by loc_1dc9)
const DISPATCH_STATE = 0x6340; // sub_1dbd rst-28 router index; reset to 0 (idle) on expiry
const PARAM_6A30 = 0x6a30; // loc_1e28/loc_1e36 popup param-block byte 0; cleared on expiry

export function loc_1e4a(m) {
  const { regs, mem } = m;

  // ld hl,0x6341 ; dec (hl) -- decrement the state-2 countdown in place.
  // dec8 sets the flags; Z (remaining === 0) is the branch condition.
  regs.hl = COUNTDOWN;
  const remaining = regs.dec8(mem.read8(COUNTDOWN));
  mem.write8(COUNTDOWN, remaining);

  if (remaining !== 0) {
    // ret nz -- timer still running: stay in state 2. Block 21 t + ret 11 t = 32 t.
    m.step(0x1e4e, 21);
    m.ret(11);
    return;
  }

  // Timer expired: xor a ; ld (0x6a30),a ; ld (0x6340),a ; ret.
  // A := 0 (its flags are the exit F), clear the param byte, reset the dispatcher
  // to the idle state. Block 56 t + ret 10 t = 66 t.
  regs.xor(regs.a);
  mem.write8(PARAM_6A30, regs.a); // 0x6A30 := 0
  mem.write8(DISPATCH_STATE, regs.a); // 0x6340 := 0 -- back to state-0 idle (loc_1e49)
  m.step(0x1e56, 56);
  m.ret(10);
}
