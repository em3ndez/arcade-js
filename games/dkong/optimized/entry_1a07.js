// SPDX-License-Identifier: GPL-3.0-only
/**
 * entry_1a07 — hand-optimized rewrite of the translated routine at ROM 0x1A07,
 * proven equal to its oracle by the equivalence harness.
 *
 * It reads ONE absolute address, 0x6386 = BONUS_EXPIRED_STEP (imported from ram.js);
 * everything else it touches is the ROM dispatch table at 0x1A0B (a ROM address, kept
 * hex) and the four ROM handler entries (also hex code addresses). No RAM is written
 * here — the balanced rst-0x28 stack push/pop is the only memory this routine itself
 * stores, and it is kept verbatim (see CYCLES/STACK).
 */

import { BONUS_EXPIRED_STEP } from "./ram.js";
import { NotImplemented } from "../../../boards/dkong/io.js";

// rst 0x28 pushes the address of the inline word table that immediately follows the
// `rst` byte (ROM 0x1A0B). It is a ROM constant, not a RAM name -> kept hex.
const DISPATCH_TABLE = 0x1a0b;

/**
 * entry_1a07 -- the bonus-expired state machine's DISPATCHER (rst 0x28).
 * [ROM 0x1A07-0x1A32, with the inline rst-0x28 body at ROM 0x0028-0x0037]
 *
 *   1a07  3a 86 63     ld   a,(0x6386)   ; A = BONUS_EXPIRED_STEP (state 0..3)
 *   1a0a  ef           rst  0x28         ; jump-dispatch through the table below
 *   1a0b  1e 1a  15 1a  1f 1a  2a 1a     ; dw [0x1A1E,0x1A15,0x1A1F,0x1A2A]  (+ dw 0 = wild)
 *   -- rst 0x28 body, ROM 0x0028-0x0037, modelled faithfully --
 *   0028  87           add  a,a          ; A = 2*state (index the word table)
 *   0029  e1           pop  hl           ; HL = table base 0x1A0B (the pushed rst addr)
 *   002a  5f           ld   e,a
 *   002b  16 00        ld   d,0x00       ; DE = 2*state
 *   002d  c3 32 00     jp   0x0032
 *   0032  19           add  hl,de        ; HL = 0x1A0B + 2*state
 *   0033  5e           ld   e,(hl)       ; target low
 *   0034  23           inc  hl
 *   0035  56           ld   d,(hl)       ; target high -> DE = target
 *   0036  eb           ex   de,hl        ; HL = target, DE = table pointer+1
 *   0037  e9           jp   (hl)         ; dispatch (a JUMP, not a call)
 *
 * WHAT IT DOES. 0x6386 (BONUS_EXPIRED_STEP, ram.js) is a tiny 4-state machine the
 * per-frame gameplay cascade loc_197a runs every frame via `ld a,(0x6386) / rst 0x28`.
 * Both bonus-decrement sites set it to 1 the instant the on-screen BONUS reaches 0,
 * arming the "bonus expired, kill the player" sequence:
 *
 *   state 0  idx0  0x1A1E  sub_1a1e   no-op `ret`             (BONUS still > 0)
 *   state 1  idx1  0x1A15  loc_1a15   INIT: clear delay, -> state 2
 *   state 2  idx2  0x1A1F  loc_1a1f   DELAY: count 0x6387 down; at 0 -> state 3
 *   state 3  idx3  0x1A2A  loc_1a2a   WAIT+EXIT: when (0x6216)==0, take the death exit
 *   state 4+       0x0000  (wild jp)  NON-EXECUTING FRONTIER -> NotImplemented
 *
 * rst 0x28 dispatches by JUMP: the pushed table base is consumed by the body's `pop hl`,
 * so each handler's own `ret` returns to loc_197a (entry_1a07's CALLER), not to this
 * dispatcher. idx0/1/2 therefore return `true` (loc_197a continues); idx3 FORWARDS
 * loc_1a2a's boolean unchanged (`true` = stay in state 3 / `false` = caller-skip, where
 * loc_1a2a has already popped loc_197a's continuation and jumped to its 0x19D2 tail).
 *
 * INPUTS  : RAM 0x6386 (the state index) and the ROM table + handler code. The stack
 *           (loc_197a pushed its 0x19BF continuation, which a handler's `ret` pops).
 * OUTPUTS : the register file set up by the rst-0x28 body (A=2*state; HL=target;
 *           DE=table pointer+1; F from `add hl,de`), then whatever the dispatched
 *           handler leaves. On the idx0 arm the handler is a bare `ret` and does NOT
 *           overwrite A/HL/DE/F, so those four are entry_1a07's OWN outputs there and
 *           are reproduced exactly (state 0: A=0, HL=0x1A1E, DE=0x1A0C, F=0x48). The
 *           two stack bytes below SP hold 0x1A0B. Returns true/false as above.
 *
 * NAMES. 0x6386 is BONUS_EXPIRED_STEP (ram.js), imported. No new candidate: the only
 * other addresses touched are the ROM dispatch table (0x1A0B) and ROM code entries,
 * which are code addresses, not RAM.
 *
 * FLAGS. There is essentially NO droppable flag churn, and one flag-writer that LOOKS
 * droppable is NOT:
 *   - `add a,a` computes A = 2*state; its OWN flags are overwritten by `add hl,de`
 *     before any read -- BUT `add hl,rr` PRESERVES S/Z/PV, seeding them from `add a,a`.
 *     On the idx0 arm the handler (`ret`) never rewrites F, so the exit F is `add hl,de`'s
 *     result INCLUDING those preserved S/Z/PV bits. So `regs.add(regs.a)` is kept verbatim
 *     (a plain `A = 2*state` would leave the caller's S/Z/PV feeding `add hl,de` and
 *     corrupt the state-0 exit F). Verified: state 0 exits F=0x48, matched by the unit gate.
 *   - `add hl,de` is kept (regs.addHl): it produces that exit F and computes HL.
 *   The other arms overwrite F inside their handler, so F there is the handler's; the unit
 *   gate compares the whole register file (incl. F) on every arm, so a dropped flag is caught.
 *
 * CYCLES / STACK -- COLLAPSED to a SINGLE m.step for the whole rst-dispatch body.
 * The body (ld a,(nn) 13 + rst 11 + add a,a 4 + pop hl 10 + ld e,a 4 + ld d,0 7 +
 * jp 10 + add hl,de 11 + ld e,(hl) 7 + inc hl 6 + ld d,(hl) 7 + ex de,hl 4 + jp (hl) 4)
 * = 98 t on EVERY arm (the dispatch computation is state-independent; only `target`
 * differs), exit PC = the jp (hl) target. It is one straight-line basic block: no branch,
 * no call boundary inside it, and NO hardware-latch write -- the rst push/pop (0x1A0B)
 * lands in STACK work RAM (0x6Bxx), not a 0x78xx/0x7Cxx/0x7Dxx latch -- so the whole body
 * folds to one charge. The `m.push16`/`m.pop16` are kept VERBATIM (not folded away): the
 * push writes 0x1A0B to the two bytes below SP and the pop restores SP but leaves those
 * bytes (dead stack the RAM gate still compares), so dropping them would diverge the stack.
 * The per-handler `m.call` and the handler's own cycles stay at the call boundary.
 * Preserving the 98 t total keeps the NMI handler's cost -- hence the main-loop spin count
 * 0x6019 (PRNG entropy) and where a later NMI's pushed PC lands -- unchanged.
 *
 * REACHABILITY / ATOMICITY (measured; why the STRICT gate, not the convergent gate).
 * entry_1a07 is dispatched from loc_197a @ 0x19BC (its ONE caller), which the vblank-NMI
 * handler entry_0066 runs with the NMI mask CLEARED (ack at ROM 0x0072, re-enabled only at
 * the 0x00D6 epilogue). Probed over 1500 attract frames: 916 dispatches, ALL 916 with
 * io.nmiMask == 0 (i.e. INSIDE the NMI, where it cannot re-enter) and ZERO NMI pushed-PC
 * landings anywhere in the body region (0x1A0A / 0x0028-0x0037); a driven-gameplay run
 * agreed (39/39 in-NMI, 0 landings). So it is ATOMIC: an atomic collapse pushes no
 * mistimed PC and tears no raster, and it passes the BYTE-EXACT whole-machine gate
 * directly. The convergent gate (for an interruptible collapse's transient tear /
 * dead-stack PC) is neither needed nor used.
 *
 * BRANCH COVERAGE. Only state 0 (idx0) occurs naturally in attract/gameplay (the bonus
 * never expires in those windows), so the whole-machine + unit gates cover idx0; idx1/2/3
 * (both idx2 sub-paths and both idx3 return values) and the idx4+ NotImplemented frontier
 * are SYNTHESISED with crafted entries, each proven EQUAL (RAM + full register file + pc +
 * SP) AND pinned to its exact oracle cycle total. See equivalence-1a07.test.js.
 */
export function entry_1a07(m) {
  const { regs, mem } = m;

  // ld a,(0x6386): the bonus-expired state machine index (0..3).
  regs.a = mem.read8(BONUS_EXPIRED_STEP);

  // -- rst 0x28 dispatch body (ROM 0x0028-0x0037), modelled faithfully --
  // The rst pushes the table base as its "return address"; the body pop hl's it back,
  // so SP is net-unchanged but the two stack bytes keep 0x1A0B (kept verbatim; see CYCLES).
  m.push16(DISPATCH_TABLE);
  regs.add(regs.a);                  // add a,a -> A = 2*state (its S/Z/PV feed add hl,de -> exit F)
  regs.hl = m.pop16();               // pop hl -> HL = table base (balances the push)
  regs.e = regs.a;                   // ld e,a
  regs.d = 0x00;                     // ld d,0x00 -> DE = 2*state
  regs.addHl(regs.de);               // add hl,de -> HL = table base + 2*state; sets the exit F
  regs.e = mem.read8(regs.hl);       // ld e,(hl)  target low byte
  regs.hl = (regs.hl + 1) & 0xffff;  // inc hl
  regs.d = mem.read8(regs.hl);       // ld d,(hl)  target high byte -> DE = target
  regs.exDeHl();                     // ex de,hl -> HL = target, DE = table pointer+1
  const target = regs.hl;

  // COLLAPSE: one charge for the whole atomic 98 t body; exit PC = the jp (hl) target.
  m.step(target, 98);

  // jp (hl): dispatch. Each handler's own `ret` returns to loc_197a, not here.
  switch (target) {
    case 0x1a1e: m.call(0x1a1e); return true; // state 0 -- no-op ret (sub_1a1e)
    case 0x1a15: m.call(0x1a15); return true; // state 1 -- INIT (loc_1a15)
    case 0x1a1f: m.call(0x1a1f); return true; // state 2 -- DELAY (loc_1a1f)
    case 0x1a2a: return m.call(0x1a2a);       // state 3 -- WAIT+EXIT (loc_1a2a); forward its boolean
    default:
      // (0x6386) >= 4: table[4] = dw 0x0000 -> jp 0x0000, a wild jump never on tape.
      throw new NotImplemented(
        `entry_1a07 rst 0x28 dispatches to ROM 0x${target.toString(16).padStart(4, "0")} ` +
          "((0x6386) out of the 0..3 state range -> wild jp 0x0000); non-executing frontier.",
      );
  }
}
