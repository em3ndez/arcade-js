// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_4b46  (ROM 0x4B46-0x4B54, The Pit) — the shared BODY of a three-door helper:
 * stows the entry-selected byte A into scratch cell 0x8057, runs a fixed
 * three-call draw/setup sequence (0x4c11, 0x4c27, 0x4c37), then TAIL-jumps into
 * 0x4c1c.
 *
 *   4b46  32 57 80     ld   (0x8057),a
 *   4b49  cd 11 4c     call 0x4c11
 *   4b4c  cd 27 4c     call 0x4c27
 *   4b4f  cd 37 4c     call 0x4c37
 *   4b52  c3 1c 4c     jp   0x4c1c
 *
 * Three doors above fall into this entry, each preselecting A for 0x8057:
 * sub_4b3c (a=0xc0, `jr 0x4b46`), sub_4b40 (a=0x90, `jr 0x4b46`), sub_4b44
 * (a=0x00, falls through). A is therefore an input; 0x8057 is the same scratch
 * "attribute" cell sub_483a drives. (Role of the three callees best-effort; the
 * addresses, T-states, flags and control flow are exact.)
 *
 * `ld (nn),a`, `call` and `jp` touch no flags, so F is whatever the callees leave
 * (this routine itself never writes F). The `jp 0x4c1c` is an unconditional
 * TAIL-jump that pushes nothing, so it is modelled as
 * `m.step(0x4c1c,10); return m.call(0x4c1c)` — 0x4c1c's own `ret` pops sub_4b46's
 * caller's return address and lands one frame up, exactly as the discarded return
 * address demands. It is NOT `m.call; m.ret()`, which would push a spurious word
 * onto the diffed stack and charge a phantom second ret (see sub_483a / sub_492a).
 */
export function sub_4b46(m) {
  const { regs, mem } = m;

  mem.write8(0x8057, regs.a); // 4b46  ld (0x8057),a -- stow the entry-selected byte
  m.step(0x4b49, 13);

  m.push16(0x4b4c);
  m.step(0x4c11, 17); // 4b49  call 0x4c11
  m.call(0x4c11);

  m.push16(0x4b4f);
  m.step(0x4c27, 17); // 4b4c  call 0x4c27
  m.call(0x4c27);

  m.push16(0x4b52);
  m.step(0x4c37, 17); // 4b4f  call 0x4c37
  m.call(0x4c37);

  // 4b52  jp 0x4c1c -- tail-jump (pushes nothing; 0x4c1c's ret returns to OUR caller)
  m.step(0x4c1c, 10);
  return m.call(0x4c1c);
}
