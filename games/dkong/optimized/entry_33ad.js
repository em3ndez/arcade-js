// SPDX-License-Identifier: GPL-3.0-only
/**
 * entry_33ad — hand-optimized rewrite of the translated routine at ROM 0x33ad,
 * proven equal to its oracle by the equivalence harness. A TWO-ARM object-field
 * flag toggle: on (ix+0x0d)==1 it SETs bit 7 of the frame byte (ix+0x07) and
 * increments (ix+0x0e); otherwise it CLEARs bit 7 and decrements (ix+0x0e). It
 * then shares the tail 0x33C0 (call sub_3409) and FALLS THROUGH into entry_33c3,
 * whose `ret` ends both — entry_33ad has no `ret` of its own.
 *
 * The two arms are physically INTERLEAVED with entry_33c3 in the ROM: the ==1 arm
 * (0x33D9–0x33E5) sits AFTER entry_33c3's body and `jp 0x33C0`s back to the shared
 * tail. This rewrite reads it as one if/else and models the fall-through with a
 * plain `return m.call(0x33c3)` (NO push16 — no frame of its own), exactly as the
 * oracle does.
 *
 * It imports NO name from ram.js: every address it touches is an IX-relative object
 * -record offset (+0d selector / +07 frame byte / +0e counter), which stays a hex
 * offset per the record-offset trap — the fields' meaning is the object updater's,
 * not interpreted here — and its only absolute literals are the code targets 0x3409
 * and 0x33c3 (dispatched through the registry, never inlined).
 */

/**
 * entry_33ad -- toggle bit 7 of (ix+0x07) and step (ix+0x0e) per (ix+0x0d), then
 * share sub_3409 + fall through into entry_33c3.  [ROM 0x33AD-0x33C2 + 0x33D9-0x33E5]
 *
 *   33ad  dd 7e 0d     ld   a,(ix+0x0d)
 *   33b0  fe 01        cp   0x01
 *   33b2  ca d9 33     jp   z,0x33d9      ; ==1 -> set bit 7, inc (ix+0x0e)
 *   -- else arm (0x33b5) --
 *   33b5  dd 7e 07     ld   a,(ix+0x07)
 *   33b8  e6 7f        and  0x7f          ; clear bit 7
 *   33ba  dd 77 07     ld   (ix+0x07),a
 *   33bd  dd 35 0e     dec  (ix+0x0e)
 *   -- shared tail (0x33c0) --
 *   33c0  cd 09 34     call 0x3409        ; sub_3409 (frame timer)
 *                      (FALL THROUGH into entry_33c3 -- NO ret of its own)
 *   -- ==1 arm (0x33d9), physically AFTER entry_33c3's body --
 *   33d9  dd 7e 07     ld   a,(ix+0x07)
 *   33dc  f6 80        or   0x80          ; set bit 7
 *   33de  dd 77 07     ld   (ix+0x07),a
 *   33e1  dd 34 0e     inc  (ix+0x0e)
 *   33e4  c3 c0 33     jp   0x33c0
 *
 * WHAT IT DOES. Two near-mirror arms selected by (ix+0x0d): the ==1 arm SETs
 * (ix+0x07) bit 7 (or 0x80) and INCrements the (ix+0x0e) counter; the else arm
 * CLEARs bit 7 (and 0x7f) and DECrements it. Same shape, inverse ops (or<->and,
 * 0x80<->0x7f, inc<->dec). Both arms then run the shared tail at 0x33C0 -- call
 * sub_3409 -- and fall through into entry_33c3 (the board-gated coordinate step),
 * whose `ret` returns for both. IX is live-in (the object record base).
 *
 * INPUTS  : IX = object record base; (ix+0x0d) selects the arm, (ix+0x07) is the
 *           frame byte whose bit 7 is toggled, (ix+0x0e) the counter stepped. The
 *           stack carries entry_33ad's caller-return address (entry_33c3's ret pops
 *           it). sub_3409 and entry_33c3 run through m.call (registry -> oracle or
 *           their own optimized rewrites; never inlined here).
 * OUTPUTS : (ix+0x07) with bit 7 set/cleared and (ix+0x0e) +/-1; then whatever
 *           sub_3409 and entry_33c3 leave (registers, flags, RAM). entry_33ad's own
 *           exit register file is entry_33c3's (via the fall-through); pc = the
 *           caller entry_33c3 popped, SP balanced (one frame consumed).
 *
 * FLAGS -- only `cp 0x01` is load-bearing and is kept VERBATIM (regs.cp): the
 * `jp z` immediately reads its Z bit. Every OTHER flag this routine would set is
 * DEAD before any reader, so it is dropped:
 *   - `or 0x80` / `and 0x7f` and the inc/dec (ix+0x0e) RMW set S/Z/H/PV (and the
 *     RMW preserves carry), but the very next consumer of F is sub_3409's `and a`
 *     at 0x340D (its `ld a,(ix+0x15)` at 0x340C reads no flag), which overwrites
 *     the whole flag byte before testing it. So the arm's flags never reach a
 *     reader and are not computed here; the bit ops are plain `| 0x80` / `& 0x7f`
 *     and the counter step a plain `(v +/- 1) & 0xff` RMW.
 * regs.a is still assigned the masked frame-byte value the oracle would hold at
 * 0x33C0 (defensive: it matches the register file at the fall-through boundary),
 * though it too is dead -- sub_3409's `ld a,(ix+0x15)` overwrites it. The unit gate
 * compares the whole register file (incl. F, F3/F5) at the exit, which is
 * entry_33c3's, so any mis-drop of a live flag is caught there and by the 204-
 * dispatch strict run.
 *
 * CYCLES -- COLLAPSED per basic block, EXACT per-arm OWN total; the CALL boundary
 * (0x33C0) and the entry_33c3 fall-through are NOT folded across. No hardware-latch
 * write occurs: IX = 0x6400 at every measured dispatch, so (ix+0x07)=0x6407 and
 * (ix+0x0e)=0x640e are WORK RAM (0x60xx-0x6Fxx), explicitly NOT a tagged latch
 * (0x7800-0f / 0x7c00 / 0x7c80 / 0x7d00-07 / 0x7d80-87) -- so no hidden bus cycle
 * is moved and the arms fold freely up to the call.
 *   - Prologue block  ld a,(ix+0x0d) (19) + cp 0x01 (7)                       = 26 t @0x33B2
 *   - ==1 arm block   jp z taken (10) + ld a,(ix+07) (19) + or 0x80 (7)
 *                     + ld (ix+07),a (19) + inc (ix+0e) (23) + jp 0x33c0 (10)  = 88 t @0x33C0
 *   - else arm block  jp z not-taken (10) + ld a,(ix+07) (19) + and 0x7f (7)
 *                     + ld (ix+07),a (19) + dec (ix+0e) (23)                   = 78 t @0x33C0
 *   - shared tail     call 0x3409 [push16 + m.step(17) + m.call] (boundary),
 *                     then `return m.call(0x33c3)` fall-through (no frame, no step)
 *   Per-arm OWN totals (callees excluded, charged inside them):
 *     ==1  arm : 26 + 88 + 17 = 131 t   (oracle 19+7+10+19+7+19+23+10+17)
 *     else arm : 26 + 78 + 17 = 121 t   (oracle 19+7+10+19+7+19+23   +17)
 *   The 10 t gap is the ==1 arm's extra unconditional `jp 0x33c0`. Both totals are
 *   the exact oracle sums, so the frame's cycle budget -- hence the main-loop spin
 *   count 0x6019 (PRNG entropy) -- is unchanged.
 *
 * GATE -- STRICT byte-exact whole-machine (no convergent gate): entry_33ad is
 * ATOMIC. MEASURED over 1400 attract frames: dispatched 204x, io.nmiMask == 0 at
 * 204/204 (every call INSIDE the vblank NMI, whose entry_0066 cleared the mask so
 * it cannot re-enter; outside-NMI 0), and the NMI's pushed PC NEVER lands in the
 * interleaved 33ad/33c3 body [0x33AD,0x33E5] (0 landings over 1394 NMIs; 0 anywhere
 * in the 0x3000-0x34FF chain; all landings fall in the 0x02BD-0x0372 main-loop
 * band). Atomic + total-preserving => byte-exact, so the strict gate passes over
 * a 204-invocation window. (The oracle docstring's "not yet wired / nothing invokes
 * it" note is STALE -- it is reached via loc_197a's NMI object cascade:
 * entry_30ed -> entry_31b1 -> entry_3202 -> entry_33ad -> fall through -> entry_33c3.)
 *
 * BRANCH COVERAGE -- attract exercises BOTH arms NATURALLY (measured: ==1 arm 103x,
 * else arm 101x of the 204 dispatches; BOARD 0x6227 == 1 at all 204, so entry_33c3
 * takes its continue path). Each arm is ALSO pinned from a crafted identical-both-
 * sides poke (ix+0x0d = 1 / 0, BOARD != 1 so entry_33c3 early-rets deterministically)
 * with its exact total -- 228 t (==1) / 218 t (else), own 131/121 + shared callees
 * 97 -- asserted. See equivalence-33ad.test.js.
 */
export function entry_33ad(m) {
  const { regs, mem } = m;
  const rec = (off) => (regs.ix + off) & 0xffff; // object record field, IX live-in

  // Prologue: ld a,(ix+0x0d) (19) + cp 0x01 (7) = 26 t, exit pc 0x33B2 (the `jp z`).
  regs.a = mem.read8(rec(0x0d));
  regs.cp(0x01); // kept verbatim: the `jp z` below reads its Z bit
  m.step(0x33b2, 26);

  if (regs.fZ) {
    // ==1 arm (ROM 0x33D9, physically after entry_33c3's body): SET bit 7 + INC (ix+0x0e).
    // Block: jp z taken (10) + ld a (19) + or 0x80 (7) + ld (19) + inc (ix+0e) (23)
    //        + jp 0x33c0 (10) = 88 t, exit pc 0x33C0.
    regs.a = mem.read8(rec(0x07)) | 0x80; // set bit 7 (flags dead -> plain OR)
    mem.write8(rec(0x07), regs.a);
    mem.write8(rec(0x0e), (mem.read8(rec(0x0e)) + 1) & 0xff); // inc (flags dead -> plain RMW)
    m.step(0x33c0, 88);
  } else {
    // else arm (ROM 0x33B5): CLEAR bit 7 + DEC (ix+0x0e).
    // Block: jp z not-taken (10) + ld a (19) + and 0x7f (7) + ld (19) + dec (ix+0e) (23)
    //        = 78 t, exit pc 0x33C0.
    regs.a = mem.read8(rec(0x07)) & 0x7f; // clear bit 7 (flags dead -> plain AND)
    mem.write8(rec(0x07), regs.a);
    mem.write8(rec(0x0e), (mem.read8(rec(0x0e)) - 1) & 0xff); // dec (flags dead -> plain RMW)
    m.step(0x33c0, 78);
  }

  // Shared tail 0x33C0: call sub_3409 (boundary, NOT folded across), then FALL
  // THROUGH into entry_33c3 -- no push16, no ret here: entry_33c3's ret ends both.
  m.push16(0x33c3);
  m.step(0x3409, 17);
  m.call(0x3409); // registry -> oracle or optimized sub_3409
  return m.call(0x33c3); // fall-through: entry_33c3's ret returns for both
}
