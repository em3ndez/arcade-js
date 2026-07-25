// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_4c63  (ROM 0x4c63–0x4c66, The Pit) — enqueues sound command 0x05. Loads
 * A=0x05 and TAIL-JUMPS into the shared enqueue body at loc_4ca5, which ORs in
 * bit 7 (0x80), advances the ring index at 0x801e (mod 8) and stores the byte
 * into the 8-entry command ring at 0x8020. One of sixteen sibling entry stubs
 * (loc_4c63..sub_4ca3), each loading a distinct command (0x05..0x15) and jumping
 * to the SAME loc_4ca5.
 *
 *   4c63  3e 05        ld   a,0x05      ; sound command 0x05
 *   4c65  18 3e        jr   0x4ca5      ; tail-jump: loc_4ca5's ret returns to OUR caller
 *
 * The `jr 0x4ca5` DISCARDS this stub's own return path: loc_4ca5 (0x4ca5-0x4cbe)
 * runs and its `ret` at 0x4cbe returns to whoever called loc_4c63. Modelled per
 * the thepit tail-jump convention (loc_4b40 / loc_0066) as
 * `m.step(target, T); return m.call(target)` with NO trailing `m.ret` — a
 * `m.call(...); m.ret()` shape would push a spurious frame and charge a second
 * ret. loc_4ca5 is a SEPARATE registered routine (the shared body of all sixteen
 * stubs), so it is tail-called, never inlined here. `ld a,n` leaves nothing else
 * touched; the enqueue's writes all happen inside loc_4ca5.
 */
export function loc_4c63(m) {
  const { regs } = m;

  regs.a = 0x05; // ld a,0x05 -- sound command 0x05
  m.step(0x4c65, 7);

  m.step(0x4ca5, 12); // jr 0x4ca5 -- tail-jump into the shared enqueue body
  return m.call(0x4ca5); // loc_4ca5's ret returns to OUR caller -- no trailing m.ret
}
