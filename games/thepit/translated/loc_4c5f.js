// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_4c5f  (ROM 0x4C5F–0x4C61, The Pit) — loads command id 0x04 and TAIL-jumps
 * into the shared enqueue body at loc_4ca5.
 *
 *   4c5f  3e 04        ld   a,0x04        ; command id 0x04
 *   4c61  18 42        jr   0x4ca5        ; TAIL-jump to the shared enqueue body
 *
 * One of a family of near-identical stubs (loc_4c5f..sub_4ca3) that each load a
 * distinct command id (0x04..0x15) into A and `jr 0x4ca5`. loc_4ca5 does
 * `or 0x80` first — so the byte this stub queues is 0x84 (0x04 | 0x80) — then
 * appends A to the 8-entry ring buffer at 0x8020, indexed by the write cursor at
 * 0x801e (read, post-incremented, masked to 0..7, stored back), and RETs.
 *
 * CONTROL FLOW: the `jr` is UNCONDITIONAL and discards no return address of its
 * own; loc_4ca5's terminating `ret` therefore unwinds to loc_4c5f's OWN caller.
 * So it is modelled as `m.step(0x4ca5, 12)` then `return m.call(0x4ca5)` with NO
 * trailing m.ret (a second pop would double-unwind) — the tail-jump idiom, same
 * as loc_4b55's `jp nz,0x4f47`. `ld a,n` sets no flags; loc_4c5f writes no memory
 * of its own — its whole contribution is A = 0x04 handed to the shared body.
 */
export function loc_4c5f(m) {
  const { regs } = m;

  regs.a = 0x04; // 4c5f  ld a,0x04 -- command id (no flags)
  m.step(0x4c61, 7);
  m.step(0x4ca5, 12); // 4c61  jr 0x4ca5 -- unconditional TAIL-jump
  return m.call(0x4ca5); // loc_4ca5's ret unwinds to loc_4c5f's caller
}
