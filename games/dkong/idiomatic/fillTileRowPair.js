// SPDX-License-Identifier: GPL-3.0-only
/**
 * fillTileRowPair — stamp a fixed two-row tile motif into the tilemap from HL:
 * 17 cells of 0xFD along one row, then 17 cells of 0xFC on the row directly below.
 * ROM 0x0D30.
 *
 * A board-setup helper reached only on 75m (BOARD == 3). The elevator-board arm
 * loc_0cf2 calls sub_0d27, which invokes this twice — at HL = 0x770D then HL =
 * 0x760D — laying a fixed decoration into the background tilemap (VRAM
 * 0x7400–0x77FF). HL is the live-in top-left write cell; everything else is a
 * constant baked into the routine (the two tile codes and the 17-cell counts).
 *
 *   - Row 1: 17 (0x11) consecutive cells from HL get tile 0xFD.
 *   - The pointer then advances by 0x0F. Because 0x11 + 0x0F = 0x20, and the
 *     tilemap is 0x20 cells wide (row-major: addr = row*0x20 + col), this lands on
 *     the SAME column one whole row down — so row 2 sits directly beneath row 1.
 *   - Row 2: 17 consecutive cells get tile 0xFC.
 *
 * The oracle's `dec b / djnz` fill loops become plain 17-iteration `for` loops; its
 * `ld de,0x0f / add hl,de` gap-advance becomes one add. HL is walked with a local
 * (`addr`) rather than mutating the register file, because HL is DEAD on exit — both
 * sub_0d27 call sites overwrite it (the first with 0x760D) or ignore it (the second
 * returns into loc_0cf2, which reloads DE and never reads HL). DE (set to 0x0F) and
 * B (spun to 0) are likewise dead ABI.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0d30.test.js.
 * GATE:     crafted-entry; 75m-only (BOARD==3), UNREACHED in 25m attract. Validated on
 *           2 real dispatches forced by an identical-both-sides board-3 setup poke
 *           (HL = 0x770D then 0x760D — the true elevator-board values) plus crafted HL
 *           variants across the tilemap and pre-dirtied destinations. Teeth = a wrong
 *           tile byte at the first cell.
 * LIVE-OUT: memory-only — the 34 tilemap bytes (17×0xFD from HL, 17×0xFC from HL+0x20).
 *           HL/DE/B and all flags are dead (the call sites reload them). pc/SP are the
 *           dropped `ret` control-flow model — the oracle pops the caller's return
 *           address (pc→target, SP+2); the direct-call layer replaces that with a JS
 *           return, so pc/SP are deliberately not compared.
 * NAMES:    none from ram.js — HL is the live-in write pointer; destinations are
 *           background tilemap VRAM (0x7400–0x77FF); 0xFD/0xFC are fixed tile codes.
 */

export function fillTileRowPair(m) {
  const { regs, mem } = m;

  // HL is the live-in write pointer: the top-left cell of the two-row motif.
  let addr = regs.hl;

  // Row 1: 17 cells of tile 0xFD.
  for (let i = 0; i < 0x11; i++) {
    mem.write8(addr, 0xfd);
    addr = (addr + 1) & 0xffff;
  }

  // Skip the row's remaining 15 cells (0x0F): 0x11 + 0x0F = 0x20 = one whole tilemap
  // row, landing on the same column one row down (`ld de,0x0f / add hl,de`).
  addr = (addr + 0x0f) & 0xffff;

  // Row 2: 17 cells of tile 0xFC, directly beneath row 1.
  for (let i = 0; i < 0x11; i++) {
    mem.write8(addr, 0xfc);
    addr = (addr + 1) & 0xffff;
  }
}
