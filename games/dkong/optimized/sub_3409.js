// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_3409 — hand-optimized rewrite of the translated routine at ROM 0x3409,
 * proven equal to its oracle by the equivalence harness.
 *
 * A per-object FRAME-TIMER / ANIMATION advance. Every field it touches is an
 * IX-relative object-record offset (ix+0x15 the sub-timer, ix+0x07 the frame
 * byte) — there is NO absolute address in the whole routine, so it imports no
 * name from ram.js. The record offsets stay hex (the record-offset trap: an
 * ix+d displacement is a field within a record, not a global address to name).
 */

/**
 * sub_3409 -- down-count the object's frame sub-timer (ix+0x15); on expiry reload
 * it to 2, advance the frame byte (ix+0x07), and every 16th advance TOGGLE bit 1
 * of the frame byte.  [ROM 0x3409-0x342B, 15 instructions, leaf]
 *
 *   3409  dd 7e 15     ld   a,(ix+0x15)
 *   340c  a7           and  a
 *   340d  c2 28 34     jp   nz,0x3428      ; timer != 0 -> dec it (ARM 1)
 *   3410  dd 36 15 02  ld   (ix+0x15),0x02 ; reload sub-timer to 2
 *   3414  dd 34 07     inc  (ix+0x07)      ; advance the frame byte
 *   3417  dd 7e 07     ld   a,(ix+0x07)
 *   341a  e6 0f        and  0x0f
 *   341c  fe 0f        cp   0x0f
 *   341e  c0           ret  nz             ; low nibble != 0x0f -> done (ARM 2)
 *   341f  dd 7e 07     ld   a,(ix+0x07)
 *   3422  ee 02        xor  0x02           ; TOGGLE bit 1 (ARM 3)
 *   3424  dd 77 07     ld   (ix+0x07),a
 *   3427  c9           ret
 *   3428  dd 35 15     dec  (ix+0x15)      ; loc_3428 (ARM 1 body)
 *   342b  c9           ret
 *
 * WHAT IT DOES. (ix+0x15) is a period-2 sub-timer counting DOWN once per call.
 * While it is non-zero the routine just decrements it and returns (ARM 1). When it
 * reaches zero it reloads to 2 and advances the frame byte (ix+0x07) by one; if the
 * frame's LOW NIBBLE has just reached 0x0F it TOGGLES bit 1 of the frame via
 * `xor 0x02` (a toggle, not a set/`or` and not a +2 — if bit 1 was already set, xor
 * CLEARS it) and stores it back (ARM 3); otherwise it returns with the frame merely
 * incremented (ARM 2). The meaning of the frame/xor is not interpreted here.
 *
 * BRANCH COVERAGE -- three exits, all exercised NATURALLY in the attract run
 * (measured over 1600 frames: ARM 1 x178, ARM 2 x45, ARM 3 x44):
 *   ARM 1  (ix+0x15) != 0        -> dec (ix+0x15); ret.                    66 t
 *   ARM 2  timer==0, nibble!=0xF -> reload; inc frame; ret nz.           119 t
 *   ARM 3  timer==0, nibble==0xF -> reload; inc frame; toggle bit1; ret. 168 t
 *
 * FLAGS -- what is kept verbatim and why (the unit gate compares the whole F):
 *   - Entry `and a` (sets Z for `jp nz`) is DROPPED: its flags are read only by that
 *     branch and are overwritten on every arm before any exit, so the branch is a
 *     plain `regs.a !== 0`. `and a` leaves A unchanged (= the timer), and A IS
 *     observable on ARM 1's exit, so the timer is still loaded into regs.a.
 *   - decMem8 (ARM 1) is the LAST flag-writer before its ret, so its flags escape to
 *     the caller -- kept verbatim (it is also the flag-correct memory RMW).
 *   - incMem8 (ARM 2/3) is kept verbatim: correct memory RMW; its flags are dead
 *     (cp overwrites them before any exit) but the primitive costs nothing to keep
 *     and stays byte-identical to the oracle transiently.
 *   - `and 0x0f` is reduced to a mask on A (`& 0x0f`): its flags are immediately
 *     overwritten by `cp 0x0f`, so only its VALUE (A, which cp reads and ARM 2
 *     returns) is load-bearing.
 *   - `cp 0x0f` is kept verbatim: `ret nz` reads its Z, and on ARM 2 it is the exit
 *     F. `xor 0x02` is kept verbatim: it is ARM 3's exit F.
 *
 * CYCLES -- COLLAPSED per the decompiler-pipeline doc, per-arm TOTAL preserved EXACTLY (the routine is
 * atomic -- see below -- and has no hardware-latch write and no call, so folding the
 * straight-line runs is licensed; only the total is observable):
 *   ARM 1: ld19 + and4 + jpTaken10 + dec23           = 56 t @0x342b, then ret 10  = 66
 *   shared prefix (both expired arms): ld19 + and4 + jpNot10 + ld19 + inc23
 *                                    + ld19 + and7 + cp7      = 108 t @0x341e
 *   ARM 2: prefix 108 + ret-nz-taken 11                                          = 119
 *   ARM 3: prefix 108 + retNzNot5 + ld19 + xor7 + ld19 = 50 t @0x3427, ret 10    = 168
 * No 0x7800-0f/0x7c00/0x7c80/0x7d00-07/0x7d80-87 latch is written (every write is an
 * (ix+d) object field in work RAM 0x60xx-0x6Fxx), so no bus-cycle boundary is pinned
 * and there is no write-trace test to add.
 *
 * REACHABILITY / ATOMICITY (MEASURED -- the oracle docstring's "not yet wired /
 * callers untranslated" note is STALE; sub_3409 is dispatched live from the >=0x3000
 * NMI object cascade via entry_33ad/entry_33e7). Probed over 1600 attract frames:
 *   - 267 dispatches (first ~frame 938), so the whole-machine strict gate is
 *     NON-vacuous, and all three arms occur naturally.
 *   - io.nmiMask == 0 at 267/267 dispatches (0 outside-NMI): it runs mask-cleared
 *     inside the vblank NMI, which cannot re-enter, and it is a leaf (calls nothing).
 *   - the NMI's pushed PC NEVER lands in [0x3409,0x342B] (0 of 1594 NMIs).
 * So it is ATOMIC: no NMI can fire inside it, the collapse pushes no mistimed PC, and
 * a per-arm-total-preserving collapse is byte-exact -> the STRICT (byte-exact)
 * whole-machine gate is the license, not the convergent gate. See
 * equivalence-3409.test.js.
 *
 * INPUTS  : IX = object record base; RAM (ix+0x15) sub-timer, (ix+0x07) frame byte.
 * OUTPUTS : (ix+0x15) and/or (ix+0x07) updated; A/F per the arm (above); pc = caller,
 *           SP balanced. No register other than A/F changes.
 */
export function sub_3409(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff; // (ix+d) object-record field address

  // Entry: load the sub-timer. `and a` only fed the `jp nz` (flags dead after), so
  // branch on the value; A stays = the timer (ARM 1's observable exit A).
  regs.a = mem.read8(R(0x15));
  if (regs.a !== 0) {
    // ARM 1 -- sub-timer still counting: decrement it and return.
    regs.decMem8(mem, R(0x15)); // flag-correct RMW; its flags are the exit F
    m.step(0x342b, 56); // ld19 + and4 + jpTaken10 + dec23
    m.ret(); // +10 -> 66 t total
    return;
  }

  // Sub-timer expired: reload to 2 and advance the frame byte.
  mem.write8(R(0x15), 0x02);
  regs.incMem8(mem, R(0x07)); // advance frame (flags dead: cp overwrites them)

  // Test the frame's low nibble. cp's Z drives `ret nz` and is ARM 2's exit F;
  // A = (frame & 0x0f) is ARM 2's exit A.
  regs.a = mem.read8(R(0x07)) & 0x0f;
  regs.cp(0x0f);
  m.step(0x341e, 108); // shared prefix total (ld19+and4+jpNot10+ld19+inc23+ld19+and7+cp7)
  if (regs.fNZ) {
    // ARM 2 -- not at the nibble boundary: return with A/F from cp.
    m.ret(11); // ret nz taken -> 108 + 11 = 119 t total
    return;
  }

  // ARM 3 -- nibble boundary reached: TOGGLE bit 1 of the frame and store it.
  regs.a = mem.read8(R(0x07));
  regs.xor(0x02); // toggle bit 1 -- clears it if it was set; exit F
  mem.write8(R(0x07), regs.a);
  m.step(0x3427, 50); // retNzNot5 + ld19 + xor7 + ld19
  m.ret(); // +10 -> 168 t total
}
