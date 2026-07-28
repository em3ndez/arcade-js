// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_4c57  (ROM 0x4C57–0x4C5A, The Pit) — sound-request stub: seeds A with the
 * sound-command index 0x02 and TAIL-jumps into the shared enqueue handler
 * loc_4ca5.
 *
 *   4c57  3e 02        ld   a,0x02        ; sound-command index 2
 *   4c59  18 4a        jr   0x4ca5        ; unconditional TAIL-jump -> loc_4ca5
 *
 * WHAT IT DOES: one of a fan of ~20 near-identical entry points (0x4c1f..0x4ca3),
 * each of which loads a distinct command index into A and falls into the common
 * tail at loc_4ca5. That tail sets bit 7 (`or 0x80` -> 0x82), then writes the
 * byte into the 8-entry sound ring buffer at 0x8020 indexed by the write pointer
 * at 0x801e (advanced `(0x801e + 1) & 0x07`). So this routine's whole job is to
 * REQUEST sound 0x02.
 *
 * The `jr 0x4ca5` is UNCONDITIONAL and discards no return address of its own, so
 * loc_4ca5's `ret` unwinds to loc_4c57's OWN caller. Modelled per the translation doc as
 * `return m.call(0x4ca5)` with NO trailing m.ret — a second ret would double-pop.
 * `ld a,n` and `jr` touch NO flags, so the caller's F survives unchanged. The
 * enqueue body lives in exactly one place (loc_4ca5.js); this stub only delegates.
 *
 * The ONLY thing that distinguishes this stub from its siblings is the immediate
 * 0x02 (neighbour loads 0x03 at 0x4c5b); that byte is the entire payload, which
 * is what the test's mutation attacks.
 */
export function loc_4c57(m) {
  const { regs } = m;

  regs.a = 0x02; // 4c57  ld a,0x02 -- sound-command index 2 (no flags)
  m.step(0x4c59, 7);
  m.step(0x4ca5, 12); // 4c59  jr 0x4ca5 -- unconditional TAIL-jump into loc_4ca5
  return m.call(0x4ca5); // loc_4ca5's ret unwinds to loc_4c57's caller (no m.ret)
}
