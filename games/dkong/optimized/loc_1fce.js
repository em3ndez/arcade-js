// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1fce — hand-optimized rewrite of the translated routine at ROM 0x1FCE,
 * proven equal to its oracle by the equivalence harness. It is the ANIMATION-DELAY
 * TAIL of sub_1f72's object-slot animator: it ticks an object's frame-delay counter
 * (ix+0f) and, on expiry, flips the object's animation-frame bit (ix+7) and reloads
 * the counter to 4, then tail-jumps into the shared object-sprite tail loc_21ba.
 *
 * It touches only per-object RECORD fields through IX ((ix+0f), (ix+7)) and one tail
 * jump, so it imports no name from ram.js — see the record-offset note below and the
 * report: these ix-relative offsets are NOT ram.js naming candidates.
 */

// Object-record field offsets. IX points at the current object record (0x6700 +
// slot*0x20 in sub_1f72's per-frame scan). These are ix-relative RECORD fields, so
// they stay raw hex — ram.js names ABSOLUTE addresses, not per-object record offsets
// (the record-offset trap; same convention as loc_1f93's SLOT_TYPE = 0x01 and
// loc_1f83's SLOT_STATE = 0x00). See the report: neither is a ram.js naming candidate.
const ANIM_DELAY = 0x0f; // ix+0f: animation frame-delay countdown (ticks down each call; reload 4)
const ANIM_FRAME = 0x07; // ix+07: sprite/animation-frame field; bit0 toggled on delay expiry

/**
 * loc_1fce -- tick (ix+0f); on expiry toggle (ix+7)'s bit0 and reload (ix+0f)=4, then
 * jp 0x21ba (the shared object-sprite tail).  [ROM 0x1FCE-0x1FE4]
 *
 *   1fce  dd 7e 0f      ld   a,(ix+0x0f)   ; A = the frame-delay counter
 *   1fd1  3d           dec  a             ; A-1 -> NZ while the counter has not expired
 *   1fd2  c2 df 1f      jp   nz,0x1fdf     ; not expired -> skip the reload, just store A
 *   1fd5  dd 7e 07      ld   a,(ix+0x07)   ; --- expiry ---   A = the animation-frame field
 *   1fd8  ee 01        xor  0x01          ; toggle bit0 (advance the 2-frame walk cycle)
 *   1fda  dd 77 07      ld   (ix+0x07),a   ; store the flipped frame
 *   1fdd  3e 04        ld   a,0x04        ; A = 4 -> the counter reload value
 *   1fdf  dd 77 0f      ld   (ix+0x0f),a   ; store the counter (decremented, or reloaded 4)
 *   1fe2  c3 ba 21     jp   0x21ba        ; -> loc_21ba (shared object-sprite tail)
 *
 * WHAT IT DOES. This is the "(ix+17)!=(ix+5)" tail of sub_1f72's animate branch
 * branch_1fac (which reaches it by `jp nz,0x1fce` at 0x1FB6 when the object's phase
 * counter has NOT wrapped) AND the internal tail-target of loc_2104's `jp nc,0x1fce`
 * at 0x210B (the bounds-check-passed path). It runs a simple per-object frame timer:
 *   - decrement the delay counter (ix+0f);
 *   - if it did NOT reach 0 -> store it back and fall through to the tail;
 *   - if it DID reach 0 (expiry) -> flip the low bit of the animation-frame field
 *     (ix+7) to advance a 2-frame animation, and reload the counter to 4.
 * Either way it tail-jumps (`jp`, no push) into loc_21ba, whose own `ret` returns to
 * sub_1f72's caller — so this routine never returns to its own caller. Object fields
 * are not interpreted beyond this (matching the oracle).
 *
 * INPUTS  : IX (current object-record base; not modified here). RAM read: (ix+0f)
 *           always; (ix+7) on the expiry arm only.
 * OUTPUTS : A (dec result on the step arm; 0x04 on the expiry arm), F (see FLAGS),
 *           RAM (ix+0f) always and (ix+7) on the expiry arm, PC = 0x21BA, SP unchanged
 *           (the `jp` is a bare tail `m.call`, no push/ret here). It forwards loc_21ba's
 *           (skip-capable) return value via `return m.call(0x21ba)`.
 *
 * FLAGS -- both flag writers are load-bearing and KEPT verbatim (no droppable churn):
 *   - `dec a` sets S/Z/H/PV/N from (ix+0f)-1 (carry preserved). Its Z/NZ is READ by the
 *     branch; and on the STEP arm `dec a` is the LAST flag writer before the tail (the
 *     jp nz, ld (ix+0f),a and jp 0x21ba touch no flags), so the exit F handed to loc_21ba
 *     IS the dec result and must match.
 *   - on the EXPIRY arm `xor 0x01` is the LAST flag writer before the tail (the following
 *     ld (ix+7),a / ld a,0x04 / ld (ix+0f),a / jp touch no flags), so the exit F there is
 *     the xor result. `ld a,0x04` overwrites A AFTER the xor without touching F, so exit
 *     A=0x04 while F still reflects the xor -- reproduced exactly by keeping regs.xor.
 *   Nothing to drop; the readability win is the docstring, the named record fields, the
 *   structured branch, and the cycle collapse (matching SCC siblings loc_1f83/1f8d/1f93).
 *
 * CYCLES -- COLLAPSED to ONE m.step per arm TOTAL, placed immediately before the tail
 * `jp` (m.call). Licensed because the routine writes only WORK RAM ((ix+0f)/(ix+7) are
 * 0x67xx object-record bytes -- NOT a tagged hardware latch 0x7800-0f/0x7c00/0x7c80/
 * 0x7d00-07/0x7d80-87), so no hardware-bus cycle pins an intermediate boundary, and the
 * only control transfer is the terminal tail jump (no mid-body m.call/push16/ret). Each
 * arm folds to a single charge equal to the oracle's exact sum (the oracle spreads it
 * across 5 / 9 per-instruction m.steps):
 *   - STEP   (dec != 0, jp nz TAKEN)   : ld(19)+dec(4)+jp nz taken(10)+ld(ix+0f),a(19)
 *                                        +jp 0x21ba(10)                            = 62 t
 *   - EXPIRY (dec == 0, jp nz NOT taken): ld(19)+dec(4)+jp nz NT(10)+ld(ix+7)(19)
 *                                        +xor(7)+ld(ix+7),a(19)+ld a,0x04(7)
 *                                        +ld(ix+0f),a(19)+jp 0x21ba(10)            = 114 t
 * Both totals equal the oracle's exactly, so the frame's cycle budget -- hence the
 * main-loop spin count 0x6019 (the PRNG entropy) -- is unchanged.
 *
 * REACHABILITY / ATOMICITY (MEASURED -- why the collapse is licensed by the STRICT gate).
 * loc_197a IS dispatched from the NMI game-state gameplay path (nmi.js) and its cascade
 * reaches sub_1f72, whose animate branch branch_1fac and bounds-check loc_2104 both tail
 * into loc_1fce. Probed over 1400 attract frames: loc_1fce dispatches 393x (first entry
 * frame 613, once the attract demo starts PLAYING 25m), and BOTH arms fire naturally
 * (STEP 295x, EXPIRY 98x) -- so the strict gate is NON-vacuous over EVERY arm. It is
 * ATOMIC: every one of the 393 dispatches occurs INSIDE the NMI handler (io.nmiMask == 0
 * at 393/393; outside-NMI 0), where entry_0066 has cleared the NMI mask so the interrupt
 * cannot re-enter -- and correspondingly the NMI's pushed PC NEVER lands in loc_1fce's
 * body [0x1FCE,0x1FE2] (0 landings over 1394 NMIs; nor anywhere in the 0x1F72-0x21D0
 * cascade; all land in the 0x02BD-0x0372 main-loop band plus the thin 0x00xx/0x06xx tail).
 * Both callers (branch_1fac, loc_2104) live in the same mask-cleared NMI cascade, so
 * loc_1fce is atomic on every call path. An atomic byte-exact collapse pushes no mistimed
 * PC and tears no raster, so it passes the BYTE-EXACT (strict) whole-machine gate directly
 * (docs/decompiler-pipeline). This matches SCC neighbours loc_1f83 / loc_1f8d / loc_1f93; the oracle
 * docstring carries no stale "not yet wired" note here. See equivalence-1fce.test.js.
 */
export function loc_1fce(m) {
  const { regs, mem } = m;
  const ix = regs.ix; // IX is not modified in this routine (no add ix)

  // (ix+0f) - 1: NZ while the frame-delay counter has not expired. `dec8` reproduces the
  // Z80 dec flags exactly; the branch reads NZ, and on the step arm this dec is the exit F.
  regs.a = regs.dec8(mem.read8((ix + ANIM_DELAY) & 0xffff));

  if (regs.fNZ) {
    // STEP: counter not expired -> store the decremented value, no frame flip.
    mem.write8((ix + ANIM_DELAY) & 0xffff, regs.a);
    // Collapsed: ld(19)+dec(4)+jp nz taken(10)+ld(ix+0f),a(19)+jp 0x21ba(10) = 62 t.
    m.step(0x21ba, 62);
    return m.call(0x21ba); // TAIL jump (no push16): loc_21ba's ret returns to OUR caller.
  }

  // EXPIRY: counter reached 0 -> toggle the animation-frame bit and reload the counter=4.
  regs.a = mem.read8((ix + ANIM_FRAME) & 0xffff);
  regs.xor(0x01); // flip bit0 (advance the 2-frame walk cycle); LAST flag writer -> exit F.
  mem.write8((ix + ANIM_FRAME) & 0xffff, regs.a);
  regs.a = 0x04; // ld a,0x04 -- counter reload value (A after xor is overwritten; F kept).
  mem.write8((ix + ANIM_DELAY) & 0xffff, regs.a);
  // Collapsed: ld(19)+dec(4)+jp nz NT(10)+ld(ix+7)(19)+xor(7)+ld(ix+7),a(19)
  //          + ld a,0x04(7)+ld(ix+0f),a(19)+jp 0x21ba(10) = 114 t.
  m.step(0x21ba, 114);
  return m.call(0x21ba);
}
