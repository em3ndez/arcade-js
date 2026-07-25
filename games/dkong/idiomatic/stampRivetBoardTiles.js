// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampRivetBoardTiles — stamp a fixed 2-tile motif into eight video-RAM cells
 * during 100m-rivet (board 4) setup.  ROM 0x0D00.
 *
 * Reached from loc_0cc6's `call z,0x0D00`, guarded by BOARD(0x6227) == 4 — the 100m
 * rivet board. It walks the eight-entry little-endian pointer table in ROM at 0x0D17
 * and, into each destination cell pair, writes the two fixed tile codes 0xB8 then
 * 0xB7 (the oracle loads A = 0xB8 and `dec`s it once between the two stores). The
 * eight destinations are two groups of four video-RAM cells at stride 5
 * (0x76CA/0x76CF/0x76D4/0x76D9 then 0x752A/0x752F/0x7534/0x7539) — a fixed piece of
 * the rivet board's static graphics.
 *
 * The routine is INPUT-INDEPENDENT: it reads only ROM immediates and the ROM table,
 * takes no argument, and every store lands a constant, so its 16 video-RAM writes are
 * the same regardless of prior machine state. A LEAF — it calls nothing.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0d00.test.js.
 * GATE:     crafted-entry — input-independent and straight-line (fixed B=8 x C=2
 *           loops: no data-dependent branch, so no unreached arms). Validated on the
 *           real forced board-4 dispatch (identical-both-sides poke sets BOARD=4 so
 *           the setup NMI's `call z,0x0D00` fires — Karl-sanctioned board poke;
 *           attract never reaches board 4) PLUS crafted pre-dirtied entries proving it
 *           overwrites any prior cell contents. Fresh clone per case (it writes RAM).
 * LIVE-OUT: memory-only — the 16 video-RAM bytes. loc_0cc6's next act after the call
 *           is `jp 0x3FA0` (no flag branch, no read of any register this leaves), so
 *           no register/flag is live. The oracle's terminal advance of pc to 0x0CD1
 *           and its `ret`'s SP+2 pop are the modelled step/stack ABI the direct-call
 *           layer replaces with a JS return, so neither pc nor SP is live either.
 * NAMES:    none — reads only ROM immediates and the ROM table at 0x0D17 (a ROM
 *           code/data address, kept a bare hex constant) and writes computed
 *           video-RAM addresses; it references no work-RAM name.
 */

// ROM destination table at 0x0D17-0x0D26: eight little-endian video-RAM pointers
// (0x76CA/0x76CF/0x76D4/0x76D9 then 0x752A/0x752F/0x7534/0x7539, stride 5). A ROM
// code/data address, not work RAM, so it stays a bare hex constant.
const DEST_TABLE = 0x0d17;

export function stampRivetBoardTiles(m) {
  const { mem } = m;

  // Walk the eight destination pointers; into each cell pair, stamp 0xB8 then 0xB7.
  for (let i = 0, ptr = DEST_TABLE; i < 8; i++, ptr += 2) {
    const dest = mem.read8(ptr) | (mem.read8(ptr + 1) << 8); // little-endian VRAM pointer
    mem.write8(dest, 0xb8); //                first tile
    mem.write8((dest + 1) & 0xffff, 0xb7); // second tile (oracle's `dec a`: 0xB8 -> 0xB7)
  }
}
