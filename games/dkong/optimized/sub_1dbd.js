// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_1dbd — hand-optimized rewrite of the translated routine at ROM 0x1DBD,
 * proven equal to its frozen oracle (translated/state0.js) by the equivalence
 * harness (equivalence-1dbd.test.js).
 *
 * WHAT IT DOES. THE ROUTER on the per-frame update state byte 0x6340. It reads
 * that byte and does `rst 0x28` — a Z80 inline-jump-table dispatch through the
 * 4-entry word table sitting immediately after the `rst` at ROM 0x1DC1 — using
 * the byte as the index. It writes nothing itself and never `ret`s of its own;
 * it leaves entirely through the dispatched arm's own exit.
 *
 *   1dbd  3a 40 63     ld   a,(0x6340)    ; A = router state index
 *   1dc0  ef           rst  0x28          ; dispatch through the table below, on A
 *   ; ---- inline jump table 0x1DC1-0x1DC8 (DATA: 49 1e c9 1d 4a 1e 00 00) ----
 *   1dc1  dw 0x1E49    ; 0x6340 == 0  -> loc_1e49  (state-0 IDLE: a bare `ret`)
 *   1dc3  dw 0x1DC9    ; 0x6340 == 1  -> loc_1dc9  (ARM: sets 0x6341=0x40, advances 0x6340:=2)
 *   1dc5  dw 0x1E4A    ; 0x6340 == 2  -> loc_1e4a  (state-2 COUNTDOWN, resets on expiry)
 *   1dc7  dw 0x0000    ; 0x6340 == 3  -> 0x0000    (RESET VECTOR; untranslated arm)
 *
 * THE rst 0x28 MECHANICS ARE REPRODUCED VERBATIM (not folded away): the ROM's
 * shared dispatcher body at 0x0028-0x0037 is `add a,a` (index*2) / `pop hl` (the
 * table base the `rst` pushed) / build DE=index*2 / `add hl,de` / read the two
 * target bytes / `ex de,hl` / `jp (hl)`. Keeping the push16/pop16 and the exact
 * register arithmetic here is what makes the STACK RAM (the pushed 0x1DC1 balances
 * to a net-neutral SP but the bytes persist) and the whole REGISTER FILE — A =
 * index*2, HL = target, DE = &table[index]+1, and F from the last flag-writer
 * `add hl,de` — come out byte-for-byte identical to the oracle. Only the WHICH-
 * implementation-runs step goes through m.call, exactly as in the oracle.
 *
 * GATE — STRICT whole-machine (+ unit), NOT convergent. sub_1dbd is ATOMIC on
 * EVERY call path. Its three callers — loc_197a (the NMI per-frame update
 * cascade), loc_127c (the 0x0748 game-state-1 sub-state table) and sub_1641 (the
 * loc_1615 game-sub-state 0x600A board-advance handler) — are ALL reached only
 * from inside the vblank NMI (entry_0066 clears the NMI mask as its ack at 0x006F,
 * and both the loc_197a cascade and dispatchGameState run under that cleared
 * mask; the mask-enabled main-loop dispatchTask walks a DISJOINT task table
 * 0x051c/0x059b/0x05c6/... that never reaches here). So the NMI cannot re-enter
 * this routine and no pushed PC can land in its 0x1DBD-0x1DC8 / 0x0028-0x0037
 * range. MEASURED: over 855 dispatches (716 in a 1300-frame plain-boot attract +
 * 139 in a coin+start+walk driven run) io.nmiMask was 0 at 100% of them, and 0
 * NMI pushed-PC landings fell in the router region (all landings cluster in the
 * 0x02BD-0x0372 main-loop band, the decompiler-pipeline doc). Atomic + total-preserving => the strict
 * byte-exact gate is the right, stronger one, and it self-validates atomicity: had
 * the collapse redistributed cycles across a real mid-routine NMI, the wrong
 * pushed PC would surface as stack drift.
 *
 * COLLAPSE (the decompiler-pipeline doc §Cycles — preserve the TOTAL, drop the per-instruction split).
 * The whole routine is ONE straight-line basic block: no conditional branch, no
 * hardware-latch write (the only writes are the push16/pop16 to WORK-RAM stack,
 * never a 0x7Dxx latch), and no call/dispatch boundary until the final `jp (hl)`.
 * So all thirteen instructions fold to ONE m.step charged at the dispatch target,
 * exactly the sub_0f56 pattern:
 *   ld a,(0x6340)[13] + rst 0x28[11] + add a,a[4] + pop hl[10] + ld e,a[4] +
 *   ld d,0[7] + jp 0x0032[10] + add hl,de[11] + ld e,(hl)[7] + inc hl[6] +
 *   ld d,(hl)[7] + ex de,hl[4] + jp (hl)[4]                              = 98 t
 * That total equals the oracle's sum exactly, so SPIN_COUNT/PRNG (0x6019) and the
 * NMI stack landings are unchanged.
 *
 * NAME (kept hex here; proposed as a candidate, NOT landed in ram.js): 0x6340 —
 * sub_1dbd's per-frame DISPATCHER STATE byte (rst-28 router index at 0x1DC1:
 * 0=idle, 1=arm, 2=countdown, 3=reset). Control-proven, but SCOPED: see the
 * naming report — the address is reused with a different meaning by routines that
 * run in a different state, so it stays hex + comment.
 *
 * INPUTS : mem[0x6340] (the state index). OUTPUTS: writes no work RAM of its own;
 *          the net SP is unchanged (push16 balanced by pop16, bytes persist in the
 *          dead stack scratch). Exits through the dispatched arm's own tail.
 */

import { NotImplemented } from "../../../boards/dkong/io.js";

export function sub_1dbd(m) {
  const { regs, mem } = m;

  // ld a,(0x6340) -- A = the router state index (flag-neutral load).
  regs.a = mem.read8(0x6340);
  const state = regs.a; // raw index, kept only for the NotImplemented diagnostic

  // rst 0x28: dispatch through the inline word table at 0x1DC1, indexed by A.
  // The dispatcher body (ROM 0x0028-0x0037) is reproduced verbatim so the stack
  // RAM and the register file (incl. F) match the oracle byte-for-byte.
  m.push16(0x1dc1); // rst 0x28 pushes the return addr = the TABLE BASE
  regs.add(regs.a); // add a,a -- A = 2*index
  regs.hl = m.pop16(); // pop hl -- table base 0x1DC1, balancing the push (SP restored)
  regs.e = regs.a; // ld e,a
  regs.d = 0x00; // ld d,0x00 -- DE = 2*index
  regs.addHl(regs.de); // add hl,de -- &table[index]; sets F (last flag writer before exit)
  regs.e = mem.read8(regs.hl); // ld e,(hl) -- target low byte
  regs.hl = (regs.hl + 1) & 0xffff; // inc hl
  regs.d = mem.read8(regs.hl); // ld d,(hl) -- target high byte
  const target = regs.de; // ex de,hl: HL := target, DE := the pointer
  regs.de = regs.hl;
  regs.hl = target;

  // COLLAPSED: the entire straight-line dispatcher is one 98 t charge at the
  // `jp (hl)` (see header for the per-instruction accounting).
  m.step(target, 98);

  // Dispatch WHICH implementation runs through the registry, exactly as the oracle
  // (the push16/step above already modelled the rst's stack + cycle cost).
  if (target === 0x1e49) return m.call(0x1e49); // state 0: IDLE (bare ret)
  if (target === 0x1dc9) return m.call(0x1dc9); // state 1: ARM the state-2 timer, advance 0x6340 -> 2
  if (target === 0x1e4a) return m.call(0x1e4a); // state 2: COUNTDOWN (loc_1e4a)
  // state 3 -> 0x0000 (reset vector) and any other value: the oracle's untranslated arm.
  throw new NotImplemented(
    `sub_1dbd dispatches via rst 0x28 to ROM 0x${target.toString(16).padStart(4, "0")} ` +
      `(table at 0x1DC1, index A=mem[0x6340]=${state}), which is not translated.`,
  );
}
