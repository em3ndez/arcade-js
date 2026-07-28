// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_4cbf  (ROM 0x4cbf–0x4cc9, then falls through into loc_4cca) — the prologue
 * to the numeric-readout rebuild: clears the flag at 0x8048, refreshes the active
 * player's shared block (call 0x4644), and clamps/compares via loc_4d3a. It then
 * falls through into loc_4cca, which formats the three source records into the
 * display cells.
 *
 *   4cbf  3e 00        ld   a,0x00
 *   4cc1  32 48 80     ld   (0x8048),a
 *   4cc4  cd 44 46     call 0x4644
 *   4cc7  cd 3a 4d     call 0x4d3a          ; --> rets to 0x4cca == loc_4cca's entry
 *
 * 0x4cca is its OWN routine (loc_4cca) because it is also entered by `jp 0x4cca`
 * from loc_4bc7 and loc_4df8 — an externally-entered address is a routine boundary
 * (docs/translation), so loc_4cbf must NOT inline across it. The `call 0x4d3a` at 0x4cc7 is
 * loc_4cbf's last own instruction; loc_4d3a's `ret` pops the pushed 0x4cca and
 * lands PC at loc_4cca's first byte. From there loc_4cbf tail-delegates into
 * loc_4cca (m.call with NO trailing m.ret — loc_4cca itself tail-rets into
 * loc_4d0c, whose `ret` returns to loc_4cbf's OWN caller; a second ret would
 * double-pop). The fall-through into loc_4cca adds no jump instruction, hence no
 * extra T-states: the `call 0x4d3a`'s 17 T (and the correct NMI-push target
 * 0x4d3a) are already charged at its own call site.
 */
export function loc_4cbf(m) {
  const { regs, mem } = m;

  regs.a = 0x00;
  m.step(0x4cc1, 7); // 4cbf  ld a,0x00

  mem.write8(0x8048, regs.a);
  m.step(0x4cc4, 13); // 4cc1  ld (0x8048),a

  m.push16(0x4cc7);
  m.step(0x4644, 17); // 4cc4  call 0x4644 -- refresh the active player's block
  m.call(0x4644);

  m.push16(0x4cca);
  m.step(0x4d3a, 17); // 4cc7  call 0x4d3a -- clamp/compare; rets to 0x4cca
  m.call(0x4d3a);

  // Fall-through into loc_4cca (its OWN routine now): loc_4d3a's ret already landed
  // PC at 0x4cca, and there is no jump instruction here -> 0 extra T-states.
  // Tail-call delegate; loc_4cca's tail-ret returns to loc_4cbf's caller.
  m.step(0x4cca, 0); // fall-through boundary into loc_4cca (no instruction, 0 T)
  return m.call(0x4cca);
}
