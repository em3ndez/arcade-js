// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampTwoTileBands — stamp two 4-cell tile bands (0xFD then 0xFC) into a video-RAM
 * row, given the row-base pointer.  ROM 0x0D4C.
 *
 * Handed HL at a video-RAM row base, it lays tile code 0xFD across four consecutive
 * cells (base..base+3), steps HL forward over a 28-cell gap (the oracle's DE = 0x001C,
 * `add hl,de`), then lays tile code 0xFC across four more cells (base+0x20..base+0x23)
 * — eight video-RAM writes in all, ending 36 cells past the base. Both run lengths are
 * the fixed immediate 4 and both tile codes are constants, so there is no data-dependent
 * branch: one straight-line path whose only input is the base pointer.
 *
 * Called only by sub_0d43, which invokes it twice with the two fixed row bases 0x7687
 * then 0x7547, on the 100m rivet (board-4) setup path. A LEAF — it calls nothing.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0d4c.test.js.
 * GATE:     crafted-entry — board-4-only (100m rivet setup via loc_0c92 -> sub_0d43);
 *           attract only plays 25m, so it never dispatches in a plain run. An
 *           identical-both-sides board-4 poke (GAME_STATE=3, GAME_SUBSTATE=10,
 *           SUBSTATE_TIMER=1, BOARD=4) forces the two real dispatches (bases
 *           0x7687/0x7547); crafted bases prove generality over the pointer and
 *           pre-dirtied cells prove overwrite. Straight-line fixed loops — no unreached
 *           arm. Fresh clone per case (it writes RAM).
 * LIVE-OUT: memory-only — the eight video-RAM cells. Both return sites overwrite HL
 *           before reading it (sub_0d43's first call returns to `ld hl,0x7547`; its
 *           fall-through return, which is this routine's second return, lands in
 *           loc_0c92 at `ld hl,0x7d86`), B and DE are reloaded, and no flag is tested —
 *           so HL/B/DE and all flags are dead. The oracle's m.step pc advance and its
 *           `ret` SP pop are the modelled step/stack ABI the direct-call layer replaces
 *           with a JS return, so neither pc nor SP is live.
 * NAMES:    none — HL is a caller-supplied video-RAM (tilemap) pointer, not a named
 *           work-RAM address; the tile codes 0xFD/0xFC are ROM immediates.
 */

export function stampTwoTileBands(m) {
  const { regs, mem } = m;

  // HL is handed in at the video-RAM row base.
  let addr = regs.hl;

  // Band 1: tile 0xFD across four consecutive cells.
  for (let i = 0; i < 4; i++) {
    mem.write8(addr, 0xfd);
    addr = (addr + 1) & 0xffff;
  }

  // Step over the 28-cell gap (oracle: DE = 0x001C; add hl,de).
  addr = (addr + 0x1c) & 0xffff;

  // Band 2: tile 0xFC across four consecutive cells.
  for (let i = 0; i < 4; i++) {
    mem.write8(addr, 0xfc);
    addr = (addr + 1) & 0xffff;
  }
}
