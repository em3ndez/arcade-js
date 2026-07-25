// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_4b3c  (ROM 0x4b3c–0x4b3f, The Pit) — loads A=0xC0 and tail-jumps into the
 * shared control-latch setup at loc_4b46. It is the A=0xC0 door of a three-entry
 * fan-in: loc_4b40 loads A=0x90 and loc_4b44 loads A=0x00, and all three converge
 * on loc_4b46, which stashes A at 0x8057 and drives the LS259 latch setup
 * (call 0x4c11 / 0x4c27 / 0x4c37, jp 0x4c1c). The `jr 0x4b46` is UNCONDITIONAL
 * (it jumps OVER the two entries below it), so A stays 0xC0 — landing at 0x4b40 or
 * 0x4b44 instead would reload A with 0x90 or 0x00.
 *
 *   4b3c  3e c0        ld   a,0xc0
 *   4b3e  18 06        jr   0x4b46      ; unconditional -- into the shared tail
 *
 * Modelled as a tail-jump: loc_4b46's own `ret` (reached down its jp 0x4c1c chain)
 * returns to OUR caller, so this is `return m.call(0x4b46)` with NO trailing m.ret
 * — a second ret would double-pop. `ld a,n` and `jr` touch no flags, so F is left
 * exactly as the caller held it.
 */
export function loc_4b3c(m) {
  const { regs } = m;

  regs.a = 0xc0; // ld a,0xc0 -- the datum loc_4b46 stashes at 0x8057
  m.step(0x4b3e, 7);

  // jr 0x4b46 (unconditional, 12T): tail-jump into the shared latch setup.
  m.step(0x4b46, 12);
  return m.call(0x4b46);
}
