// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_4ca3  (ROM 0x4CA3-0x4CA4, The Pit) -- sound-request stub #0x15: seeds A with
 * the sound-command index 0x15, then FALLS THROUGH into the shared enqueue tail
 * loc_4ca5. There is no jump byte -- `ld a,0x15` (0x4ca3, two bytes) is immediately
 * followed by loc_4ca5 at 0x4ca5, so control merges by fall-through, not a `jr`.
 *
 *   4ca3  3e 15        ld   a,0x15        ; sound-command index 0x15
 *                      -- falls through into loc_4ca5 (no jr) --
 *
 * WHAT IT DOES: the last of a fan of ~20 near-identical entry points (0x4c1f..0x4ca3),
 * each of which loads a distinct command index into A and reaches the common tail at
 * loc_4ca5. That tail sets bit 7 (`or 0x80` -> 0x95), then writes the byte into the
 * 8-entry sound ring buffer at 0x8020 indexed by the write pointer at 0x801e (advanced
 * `(0x801e + 1) & 0x07`). So this routine's whole job is to REQUEST sound 0x15.
 *
 * The fall-through discards no return address of its own, so loc_4ca5's `ret` unwinds
 * to loc_4ca3's OWN caller. Modelled per the translation doc exactly like the `jr`-based siblings
 * (loc_4c9f etc.): `return m.call(0x4ca5)` with NO trailing m.ret -- a second ret would
 * double-pop. Unlike those siblings there is no `jr`, so only the `ld a,0x15` (7 T) is
 * charged locally before control passes to loc_4ca5. `ld a,n` touches no flags, so the
 * caller's F reaches loc_4ca5 unchanged.
 *
 * The ONLY thing distinguishing this stub from its siblings is the immediate 0x15
 * (its neighbour loc_4c9f loads 0x14 at 0x4c9f); that byte is the entire payload, which
 * is what the test's mutation attacks. (Role read from the code; addresses, flags and
 * control flow are exact.)
 */
export function loc_4ca3(m) {
  const { regs } = m;

  // 4ca3  ld a,0x15 -- sound-command index 0x15 (no flags)
  regs.a = 0x15;
  m.step(0x4ca5, 7);
  // fall through into loc_4ca5 (the shared enqueue tail); its ret unwinds to
  // loc_4ca3's caller, so this is `return m.call` with no trailing m.ret.
  return m.call(0x4ca5);
}
