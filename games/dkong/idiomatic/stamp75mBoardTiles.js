// SPDX-License-Identifier: GPL-3.0-only
/**
 * stamp75mBoardTiles — during 75m (board 3, elevators) setup, stamp two fixed
 * two-row tile motifs into the background tilemap.  ROM 0x0D27.
 *
 * Reached only from the 75m board-setup arm loc_0cf2 (BOARD(0x6227) == 3), which
 * calls it before selecting the elevator layout table. It takes no input: it plants
 * a constant piece of the elevator board's static background by invoking
 * fillTileRowPair (ROM 0x0D30) twice at two hard-coded tilemap pointers —
 *
 *   - HL = 0x770D → 17 cells of tile 0xFD along one tilemap row, then 17 cells of
 *                   0xFC on the row directly below (0x772D). Tilemap rows 24–25.
 *   - HL = 0x760D → the same 17+17 motif eight rows higher (0x760D then 0x762D).
 *                   Tilemap rows 16–17.
 *
 * 68 background-tilemap bytes in all (VRAM 0x7400–0x77FF), at two fixed screen
 * positions; the two 34-byte motifs are disjoint. Every value and address is a baked
 * constant — the routine reads no memory and no register, so it repaints identically
 * on every call. It parallels the other per-board tile stamps (stamp50mBoardTiles,
 * stampRivetBoardTiles); unlike those it carries no internal board gate, because its
 * single caller is already the 75m-only arm.
 *
 * fillTileRowPair reads its top-left write cell from HL, so — exactly as the oracle's
 * `ld hl,nn / call` — HL is set before each call. HL is not a live input to
 * stamp75mBoardTiles itself; it is scratch handed to the callee. (The oracle's second
 * call is a fall-through into 0x0D30 rather than a fresh `call`; that is control-flow
 * plumbing with no observable effect.)
 *
 * Note: loc_0cf2's oracle comment tags this call "sprite-row clear" — that label is
 * stale. The writes land in the background tilemap (not the sprite buffer) and set
 * tile codes rather than clearing; fillTileRowPair's gated decompile is the authority
 * on the destination.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0d27.test.js.
 * GATE:     crafted-entry; 75m-only (BOARD==3), UNREACHED in 25m attract (0 natural
 *           dispatches in a plain run). Validated on the real dispatch forced by an
 *           identical-both-sides board-3 setup poke, a write-set footprint check, a
 *           synthetic fresh-boot entry, and garbage-register / dirty-destination crafts
 *           that prove input-independence. Teeth = a wrong first-cell tile AND an
 *           omitted second motif.
 * LIVE-OUT: memory-only — the 68 tilemap bytes (17×0xFD from 0x770D + 17×0xFC from
 *           0x772D, and the same pair from 0x760D / 0x762D). HL/DE/B/A and all flags are
 *           dead: loc_0cf2 reloads A and DE next and never reads HL. (The oracle also
 *           pushes/pops its return address in STACK_SCRATCH — dead scratch, masked by
 *           the gate.) pc/SP are the dropped `ret` control-flow model, not compared.
 * NAMES:    none from names.js — destinations are background-tilemap VRAM (0x7400–0x77FF)
 *           and 0xFD/0xFC are fixed tile codes. Callee fillTileRowPair (idiomatic, ROM
 *           0x0D30) is imported and called directly.
 */

import { fillTileRowPair } from "./fillTileRowPair.js";

export function stamp75mBoardTiles(m) {
  const { regs } = m;

  // First motif: the 17×0xFD / 17×0xFC two-row pair from 0x770D (fillTileRowPair
  // reads its top-left cell from HL).
  regs.hl = 0x770d;
  fillTileRowPair(m);

  // Second motif: the same pair eight tilemap rows higher, from 0x760D.
  regs.hl = 0x760d;
  fillTileRowPair(m);
}
