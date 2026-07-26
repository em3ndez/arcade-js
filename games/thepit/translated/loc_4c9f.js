// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_4c9f  (ROM 0x4C9F–0x4CA2, The Pit) — sound-request stub #0x14: seeds A with
 * the sound-command index 0x14 and UNCONDITIONALLY tail-jumps into the shared
 * enqueue handler loc_4ca5.
 *
 *   4c9f  3e 14        ld   a,0x14        ; sound-command index 0x14
 *   4ca1  18 02        jr   0x4ca5        ; unconditional TAIL-jump -> loc_4ca5
 *
 * WHAT IT DOES: one of a fan of ~20 near-identical entry points (0x4c1f..0x4ca3),
 * each of which loads a distinct command index into A and falls into the common
 * tail at loc_4ca5. That tail sets bit 7 (`or 0x80` -> 0x94), then writes the byte
 * into the 8-entry sound ring buffer at 0x8020 indexed by the write pointer at
 * 0x801e (advanced `(0x801e + 1) & 0x07`). So this routine's whole job is to
 * REQUEST sound 0x14.
 *
 * The `jr 0x4ca5` is UNCONDITIONAL and discards no return address of its own, so
 * loc_4ca5's `ret` unwinds to loc_4c9f's OWN caller. Modelled per doc 03 as
 * `return m.call(0x4ca5)` with NO trailing m.ret — a second ret would double-pop.
 * `ld a,n` and `jr` touch NO flags, so the caller's F survives unchanged.
 *
 * The ONLY thing that distinguishes this stub from its siblings is the immediate
 * 0x14 (neighbours load 0x13 at 0x4c9b, 0x15 at 0x4ca3); that byte is the entire
 * payload, which is what the test's mutation attacks.
 */
export function loc_4c9f(m) {
  const { regs } = m;

  regs.a = 0x14; // 4c9f  ld a,0x14 -- sound-command index 0x14 (no flags)
  m.step(0x4ca1, 7);
  m.step(0x4ca5, 12); // 4ca1  jr 0x4ca5 -- unconditional TAIL-jump into loc_4ca5
  return m.call(0x4ca5); // loc_4ca5's ret unwinds to loc_4c9f's caller (no m.ret)
}
