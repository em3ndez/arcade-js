// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_4c9b  (ROM 0x4C9B–0x4C9E, The Pit) — sound-request stub #0x13: seeds A with
 * the sound-command index 0x13 and UNCONDITIONALLY tail-jumps into the shared
 * enqueue handler loc_4ca5.
 *
 *   4c9b  3e 13        ld   a,0x13        ; sound-command index 0x13
 *   4c9d  18 06        jr   0x4ca5        ; unconditional TAIL-jump -> loc_4ca5
 *
 * WHAT IT DOES: one of a fan of ~20 near-identical entry points (0x4c1f..0x4ca3),
 * each of which loads a distinct command index into A and falls into the common
 * tail at loc_4ca5. That tail sets bit 7 (`or 0x80` -> 0x93), then writes the byte
 * into the 8-entry sound ring buffer at 0x8020 indexed by the write pointer at
 * 0x801e (advanced `(0x801e + 1) & 0x07`). So this routine's whole job is to
 * REQUEST sound 0x13.
 *
 * The `jr 0x4ca5` is UNCONDITIONAL and discards no return address of its own, so
 * loc_4ca5's `ret` unwinds to loc_4c9b's OWN caller. Modelled per doc 03 as
 * `return m.call(0x4ca5)` with NO trailing m.ret — a second ret would double-pop.
 * `ld a,n` and `jr` touch NO flags, so the caller's F survives unchanged.
 *
 * The ONLY thing that distinguishes this stub from its siblings is the immediate
 * 0x13 (neighbours load 0x12 at 0x4c97, 0x14 at 0x4c9f); that byte is the entire
 * payload, which is what the test's mutation attacks.
 */
export function loc_4c9b(m) {
  const { regs } = m;

  regs.a = 0x13; // 4c9b  ld a,0x13 -- sound-command index 0x13 (no flags)
  m.step(0x4c9d, 7);
  m.step(0x4ca5, 12); // 4c9d  jr 0x4ca5 -- unconditional TAIL-jump into loc_4ca5
  return m.call(0x4ca5); // loc_4ca5's ret unwinds to loc_4c9b's caller (no m.ret)
}
