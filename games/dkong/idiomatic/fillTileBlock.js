// SPDX-License-Identifier: GPL-3.0-only
/**
 * fillTileBlock — stamp a fixed 5-wide × 14-tall block of tile 0x10 into the
 * tilemap at the caller's address.  ROM 0x1826.
 *
 * A shared screen-region fill with five callers — the game-over / player-switch
 * render sequences (loc_12f2, loc_1344) and the intro / how-high setup arms
 * (loc_17b6, loc_1880). The caller leaves the top-left tilemap cell in HL; this
 * lays tile 0x10 across 5 cells, then walks HL one whole tilemap row up and back
 * to the same left edge, and repeats for 14 rows — a 5×14 rectangle of 0x10.
 *
 *   - The fill value (0x10), the width (5), the height (14) and the row step are
 *     all CONSTANTS baked into the routine (the oracle loads the fill value ONCE,
 *     before the outer loop). The only input is the destination address in HL.
 *   - Each row writes 5 cells (HL += 5), then steps HL back by 0x25 — the oracle's
 *     `add hl,de` with DE = 0xFFDB = -0x25. Net −0x20 per row, i.e. one tilemap
 *     row up at the same left edge (the map is 0x20 cells wide).
 *
 * A LEAF: calls nothing and READS NO MEMORY — a pure writer whose whole input is
 * HL. It writes only the 70 tilemap cells.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1826.test.js.
 * GATE:     crafted-entry + one real driven dispatch — sub_1826 is UNREACHED in
 *           attract (its callers are the death / player-switch render and the
 *           board-start intro-setup arms, none of which attract enters). It IS
 *           reached in driven gameplay: driving coin+start to game over captures a
 *           real dispatch — the game-over render (loc_12f2) invokes it with the real
 *           live-in HL=0x76D4 — which is checked directly. The other caller live-ins
 *           (0x76C6/CB/D0/D3/D5/DA) are crafted onto real captured states of its
 *           VRAM-render sibling sub_0DA7 and the task primitive sub_309F, plus
 *           region-crossing addresses (VRAM↔sprite↔discard boundaries), identically
 *           on both sides. Because the routine reads no memory, HL is its entire
 *           input, so this exhausts what can vary. (Every wrapped address is
 *           ROM/unmapped, which the write seam faults on both sides alike, so the
 *           defensive `& 0xffff` wrap is not separately writable.) Teeth = a wrong
 *           row step (−0x24 not −0x25) that shifts every row after the first.
 * LIVE-OUT: memory-only — the 70 written tilemap cells. Every caller either
 *           overwrites HL before its next read (loc_1344, loc_12f2 after its render)
 *           or hands it to a successor that re-loads it (sub_0DA7 sets H/L from the
 *           record) or merely preserves it (enqueueTask push/pops it) without reading
 *           it, so HL is dead ABI; A/B/C/DE and all flags likewise. The oracle's
 *           `ret` pops but never writes the stack, so pc/SP carry no game-visible
 *           residue — they are the dropped control-flow model (the JS return).
 * NAMES:    none — the destination is the caller's HL; 0x10 is a tile code and the
 *           5 / 14 / 0x25 constants are the block geometry. No named RAM is involved.
 */

export function fillTileBlock(m) {
  const { regs, mem } = m;

  const TILE = 0x10; // fill tile code (oracle: ld a,0x10, once)
  const WIDTH = 5; // cells written per row (oracle: ld b,0x05)
  const ROWS = 0x0e; // 14 rows (oracle: ld c,0x0e)
  const ROW_BACKSTEP = 0x25; // HL steps back 0x25 after each 5-cell run (DE = -0x25)

  let addr = regs.hl; // caller-supplied top-left tilemap cell (live-in)
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < WIDTH; col++) {
      mem.write8(addr, TILE);
      addr = (addr + 1) & 0xffff;
    }
    addr = (addr - ROW_BACKSTEP) & 0xffff; // add hl,de -> one tilemap row up, left edge
  }
}
