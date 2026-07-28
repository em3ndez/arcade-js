// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_4c8b  (ROM 0x4C8B–0x4C8E, The Pit) — sound-request stub #0x0f: seeds A with
 * the sound-command index 0x0f and TAIL-jumps into the shared enqueue handler
 * loc_4ca5.
 *
 *   4c8b  3e 0f        ld   a,0x0f        ; sound-command index 0x0f
 *   4c8d  18 16        jr   0x4ca5        ; unconditional TAIL-jump -> loc_4ca5
 *
 * WHAT IT DOES: one of a fan of ~20 near-identical entry points (0x4c1f..0x4ca3),
 * each of which loads a distinct command index into A and falls into the common
 * tail at loc_4ca5. That tail sets bit 7 (`or 0x80` -> 0x8f), then writes the byte
 * into the 8-entry sound ring buffer at 0x8020 indexed by the write pointer at
 * 0x801e (advanced `(0x801e + 1) & 0x07`). So this routine's whole job is to
 * REQUEST sound 0x0f.
 *
 * NOTE ON THE INDEX SEQUENCE: the stub for index 0x0e (ROM 0x4c87, `ld a,0x0e; jr
 * 0x4ca5`) is UNREACHED dead bytes, so this 0x0f stub's nearest *reachable*
 * neighbours are loc_4c83 (0x0d) below and loc_4c8f (0x10) above.
 *
 * The `jr 0x4ca5` is UNCONDITIONAL and discards no return address of its own, so
 * loc_4ca5's `ret` unwinds to loc_4c8b's OWN caller. Modelled per the translation doc as
 * `return m.call(0x4ca5)` with NO trailing m.ret — a second ret would double-pop.
 * `ld a,n` and `jr` touch NO flags, so the caller's F survives unchanged.
 *
 * The ONLY thing that distinguishes this stub from its siblings is the immediate
 * 0x0f (the reachable neighbour loc_4c8f loads 0x10); that byte is the entire
 * payload, which is what the test's mutation attacks.
 */
export function loc_4c8b(m) {
  const { regs } = m;

  regs.a = 0x0f; // 4c8b  ld a,0x0f -- sound-command index 0x0f (no flags)
  m.step(0x4c8d, 7);
  m.step(0x4ca5, 12); // 4c8d  jr 0x4ca5 -- unconditional TAIL-jump into loc_4ca5
  return m.call(0x4ca5); // loc_4ca5's ret unwinds to loc_4c8b's caller (no m.ret)
}
