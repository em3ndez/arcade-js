// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_4c73  (ROM 0x4C73-0x4C76, The Pit) — sound-request stub #0x09: seeds A with
 * the sound-command index 0x09 and TAIL-jumps into the shared enqueue handler
 * loc_4ca5.
 *
 *   4c73  3e 09        ld   a,0x09        ; sound-command index 0x09
 *   4c75  18 2e        jr   0x4ca5        ; unconditional TAIL-jump -> loc_4ca5
 *
 * WHAT IT DOES: one of a fan of ~20 near-identical entry points (0x4c1f..0x4ca3),
 * each of which loads a distinct command index into A and falls into the common
 * tail at loc_4ca5. That tail sets bit 7 (`or 0x80` -> 0x89), then writes the
 * byte into the 8-entry sound ring buffer at 0x8020 indexed by the write pointer
 * at 0x801e (advanced `(0x801e + 1) & 0x07`). So this routine's whole job is to
 * REQUEST sound 0x09.
 *
 * The `jr 0x4ca5` is UNCONDITIONAL and discards no return address of its own, so
 * loc_4ca5's `ret` unwinds to loc_4c73's OWN caller. Modelled per the translation doc as
 * `return m.call(0x4ca5)` with NO trailing m.ret — a second ret would double-pop.
 * `ld a,n` and `jr` touch NO flags, so the caller's F survives unchanged.
 *
 * The ONLY thing that distinguishes this stub from its siblings is the immediate
 * 0x09 (neighbours load 0x08 at 0x4c6f, 0x0a at 0x4c77); that byte is the entire
 * payload, which is what the test's mutation attacks.
 */
export function loc_4c73(m) {
  const { regs } = m;

  regs.a = 0x09; // 4c73  ld a,0x09 -- sound-command index 0x09 (no flags)
  m.step(0x4c75, 7);
  m.step(0x4ca5, 12); // 4c75  jr 0x4ca5 -- unconditional TAIL-jump into loc_4ca5
  return m.call(0x4ca5); // loc_4ca5's ret unwinds to loc_4c73's caller (no m.ret)
}
