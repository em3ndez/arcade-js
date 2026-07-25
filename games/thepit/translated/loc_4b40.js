// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_4b40  (ROM 0x4b40–0x4b55, The Pit) — the A=0x90 entry of a two-door helper
 * that stores a control byte to 0x8057 and then runs a fixed three-call setup
 * chain, TAIL-JUMPING into 0x4c1c to finish. The sibling entry loc_4b44 loads
 * A=0x00 and falls into the SAME store; loc_4b40 reaches it via an UNCONDITIONAL
 * `jr 0x4b46` that jumps OVER the `ld a,0x00` at 0x4b44, so A stays 0x90 —
 * landing on 0x4b44 instead would store 0x00 (the sibling's value).
 *
 *   4b40  3e 90        ld   a,0x90
 *   4b42  18 02        jr   0x4b46      ; unconditional -- skips ld a,0x00 @4b44
 *
 *   4b44  3e 00        ld   a,0x00      ; loc_4b44 entry (NOT reached from 0x4b40)
 *
 *   4b46  32 57 80     ld   (0x8057),a  ; loc_4b46 shared tail -- store the byte
 *   4b49  cd 11 4c     call 0x4c11
 *   4b4c  cd 27 4c     call 0x4c27
 *   4b4f  cd 37 4c     call 0x4c37
 *   4b52  c3 1c 4c     jp   0x4c1c      ; tail-jump: 0x4c1c's ret returns to OUR caller
 *
 * The closing `jp 0x4c1c` DISCARDS this routine's own return path: 0x4c1c runs
 * and its `ret` returns to whoever called loc_4b40. Modelled per the thepit
 * convention (loc_0066) as `m.step(target, T); return m.call(target)` with NO
 * trailing `m.ret` — the `m.call(...); m.ret()` shape would push a spurious frame
 * and charge a second ret. `ld a,n`, `ld (nn),a`, `call` and `jp` leave A's byte
 * intact; the store to work-RAM 0x8057 takes no bus offset (it is not hardware).
 */
export function loc_4b40(m) {
  const { regs, mem } = m;

  regs.a = 0x90;
  m.step(0x4b42, 7); // ld a,0x90 -- the control byte (0x90, not the sibling's 0x00)

  m.step(0x4b46, 12); // jr 0x4b46 -- unconditional, skips ld a,0x00 @4b44

  // loc_4b46 (shared tail with loc_4b44): store A, then the setup chain.
  mem.write8(0x8057, regs.a); // ld (0x8057),a
  m.step(0x4b49, 13);

  m.push16(0x4b4c);
  m.step(0x4c11, 17); // call 0x4c11
  m.call(0x4c11);

  m.push16(0x4b4f);
  m.step(0x4c27, 17); // call 0x4c27
  m.call(0x4c27);

  m.push16(0x4b52);
  m.step(0x4c37, 17); // call 0x4c37
  m.call(0x4c37);

  m.step(0x4c1c, 10); // jp 0x4c1c -- tail-jump; 0x4c1c's ret returns to OUR caller
  return m.call(0x4c1c);
}
