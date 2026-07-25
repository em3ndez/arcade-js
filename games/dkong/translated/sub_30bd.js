// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_30bd  (ROM 0x30BD–0x30DA) — 30 bytes, 12 instructions.
 *
 *   30bd  21 50 69     ld   hl,0x6950
 *   30c0  06 02        ld   b,0x02
 *   30c2  cd e4 30     call 0x30e4        ; zero 2 bytes stride 4 from 0x6950
 *   30c5  2e 80        ld   l,0x80        ; L only -- HL = 0x6980 (H stays 0x69)
 *   30c7  06 0a        ld   b,0x0a
 *   30c9  cd e4 30     call 0x30e4        ; zero 10 bytes from 0x6980
 *   30cc  2e b8        ld   l,0xb8        ; HL = 0x69b8
 *   30ce  06 0b        ld   b,0x0b
 *   30d0  cd e4 30     call 0x30e4        ; zero 11 bytes from 0x69b8
 *   30d3  21 0c 6a     ld   hl,0x6a0c
 *   30d6  06 05        ld   b,0x05
 *   30d8  c3 e4 30     jp   0x30e4        ; TAIL JUMP -- 30e4's ret returns to OUR caller
 *
 * Callers
 * 0x12A3/0x1615 are in untranslated routines (0x12A3 is past handler_123c, which
 * ends 0x127B), and nothing in translated src invokes sub_30bd
 *
 * Clears four disjoint stride-4 runs in work RAM page 0x69/0x6A by calling the
 * already-integrated sub_30e4 (zero B bytes at stride 4, walking L only) four
 * times. NO live-ins (HL and B set before use).
 *
 * THE STACK SPLICE (the judgement point): the first THREE are real `call`s
 * (push a return, sub_30e4 rets back). The FOURTH is a `jp` -- a TAIL JUMP that
 * pushes NOTHING, so sub_30e4's `ret` returns to sub_30bd's OWN caller. Modelled
 * `m.step(0x30e4, 10); return m.call(0x30e4)` with no push16 -- identical to
 * entry_30db's fallthrough, differing only in charging the jp's 10 T-states.
 * Translating the tail jump as a call (an extra push + an implied ret) would
 * splice a phantom frame onto the stack (the tail-jump-is-not-a-call trap;
 * cf. the rst 0x28 dispatcher that leaked a slot for the whole project).
 *
 * CROSS-CALL DEPENDENCY: `ld l,0x80` / `ld l,0xb8` reload L only, so H must
 * survive each call. sub_30e4 writes only A, L, B and flags -- never H -- so H
 * stays 0x69 across the first three runs. The fourth run reloads the full HL
 * (0x6A0C). Holds because sub_30e4 never writes H (verified in its body).
 */
export function sub_30bd(m) {
  const { regs } = m;

  regs.hl = 0x6950;
  m.step(0x30c0, 10); // ld hl,0x6950
  regs.b = 0x02;
  m.step(0x30c2, 7); // ld b,0x02
  m.push16(0x30c5); // call 0x30e4 -- real call, rets back to 0x30c5
  m.step(0x30e4, 17);
  m.call(0x30e4); // preserves H

  regs.l = 0x80; // L only -- HL = 0x6980, H preserved at 0x69
  m.step(0x30c7, 7); // ld l,0x80
  regs.b = 0x0a;
  m.step(0x30c9, 7); // ld b,0x0a
  m.push16(0x30cc); // call 0x30e4 -- rets back to 0x30cc
  m.step(0x30e4, 17);
  m.call(0x30e4);

  regs.l = 0xb8; // HL = 0x69b8
  m.step(0x30ce, 7); // ld l,0xb8
  regs.b = 0x0b;
  m.step(0x30d0, 7); // ld b,0x0b
  m.push16(0x30d3); // call 0x30e4 -- rets back to 0x30d3
  m.step(0x30e4, 17);
  m.call(0x30e4);

  regs.hl = 0x6a0c; // full HL reload for the last run
  m.step(0x30d6, 10); // ld hl,0x6a0c
  regs.b = 0x05;
  m.step(0x30d8, 7); // ld b,0x05

  // TAIL JUMP: no push. sub_30e4's ret returns to sub_30bd's caller.
  m.step(0x30e4, 10); // jp 0x30e4
  return m.call(0x30e4);
}
