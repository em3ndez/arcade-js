// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_4b44  (ROM 0x4b44-0x4b54, The Pit) — the A=0x00 entry of a three-way
 * entry pair that stores its A byte to the mode cell at 0x8057, runs the
 * setup sequence 0x4c11 / 0x4c27 / 0x4c37, then tail-jumps to 0x4c1c.
 *
 * loc_4b44 loads A=0x00 and FALLS THROUGH into the shared body at loc_4b46;
 * the other two entries reach 0x4b46 with a different A already in hand
 * (loc_4b3c: A=0xC0, loc_4b40: A=0x90 — both via `jr 0x4b46`). So 0x8057
 * selects which of the three variants ran; for this entry it is 0x00.
 *
 *   4b44  3e 00        ld   a,0x00
 * loc_4b46: (shared tail; also reached from loc_4b3c/loc_4b40)
 *   4b46  32 57 80     ld   (0x8057),a
 *   4b49  cd 11 4c     call 0x4c11
 *   4b4c  cd 27 4c     call 0x4c27
 *   4b4f  cd 37 4c     call 0x4c37
 *   4b52  c3 1c 4c     jp   0x4c1c
 *
 * The trailing `jp 0x4c1c` is an unconditional TAIL-JUMP, not a call: it pushes
 * nothing, so 0x4c1c's own `ret` returns to loc_4b44's caller. Modelled the DK
 * way — advance PC + charge the 10 T of `jp nn`, then `return m.call(target)` so
 * the callee's control flow propagates back through the JS stack unchanged (NOT
 * `m.call(); m.ret()`, which would push a spurious word and double-charge a ret).
 */
export function loc_4b44(m) {
  const { regs, mem } = m;

  regs.a = 0x00; // 4b44  ld a,0x00
  m.step(0x4b46, 7);

  // loc_4b46: shared body (A = 0x00 here; 0xC0 via loc_4b3c, 0x90 via loc_4b40).
  mem.write8(0x8057, regs.a); // 4b46  ld (0x8057),a -- mode/variant select
  m.step(0x4b49, 13);

  m.push16(0x4b4c); // 4b49  call 0x4c11 -- return addr = 0x4b4c
  m.step(0x4c11, 17);
  m.call(0x4c11);

  m.push16(0x4b4f); // 4b4c  call 0x4c27 -- return addr = 0x4b4f
  m.step(0x4c27, 17);
  m.call(0x4c27);

  m.push16(0x4b52); // 4b4f  call 0x4c37 -- return addr = 0x4b52
  m.step(0x4c37, 17);
  m.call(0x4c37);

  // 4b52  jp 0x4c1c -- tail-jump: 0x4c1c's own ret returns to OUR caller.
  m.step(0x4c1c, 10);
  return m.call(0x4c1c);
}
