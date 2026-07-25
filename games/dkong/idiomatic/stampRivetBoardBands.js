// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampRivetBoardBands — stamp the two-band tile motif into two fixed tilemap rows
 * during 100m-rivet (board 4) setup.  ROM 0x0D43.
 *
 * A thin wrapper over the shared filler stampTwoTileBands (ROM 0x0D4C): it points HL
 * at the first tilemap row base 0x7687 and runs the filler, then points HL at the
 * second row base 0x7547 and runs it again. Each filler pass lays tile 0xFD across
 * four consecutive cells, steps over a 28-cell gap, and lays tile 0xFC across four
 * more — so the routine writes sixteen video-RAM (tilemap) cells in all, eight per
 * row. Both row bases are ROM immediates and the routine takes no argument: its output
 * is fixed regardless of prior machine state.
 *
 * The oracle reaches the second filler as a tail fall-through (the first is a real
 * `call`, the second a fall-into whose `ret` returns to sub_0d43's caller); with direct
 * calls that distinction dissolves — both are ordinary calls, and the memory left
 * behind is identical. Reached only from loc_0c92's board-4 arm (ROM 0x0CB6
 * `call 0x0d43`) on 100m-rivet setup, itself dispatched inside the mask-cleared vblank
 * NMI.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0d43.test.js.
 * GATE:     crafted-entry — board-4-only (100m rivet setup via loc_0c92's 0x0CB6 arm);
 *           attract only plays 25m, so it never dispatches in a plain run. An
 *           identical-both-sides board-4 poke (GAME_STATE=3, GAME_SUBSTATE=10,
 *           SUBSTATE_TIMER=1, BOARD=4) forces the real dispatch; crafted pre-dirtied
 *           cells prove overwrite and crafted register/far-RAM garbage proves the output
 *           is input-independent (the two bases are internal ROM immediates). Two fixed
 *           calls, straight-line — no data-dependent branch, no unreached arm. Fresh
 *           clone per case (it writes RAM).
 * LIVE-OUT: memory-only — the sixteen video-RAM cells (0xFD x4 + 0xFC x4 at base 0x7687,
 *           then the same at base 0x7547). The caller's next act after the call is
 *           `ld hl,0x7d86` (loc_0c92), which overwrites HL before reading it; B/DE are
 *           reloaded and no flag is tested, so HL/B/DE and all flags are dead. The
 *           oracle's `push16`/`m.step` pc advance and its callees' `ret` SP pops are the
 *           modelled step/stack ABI the direct-call layer replaces with a JS return, so
 *           neither pc nor SP is live.
 * NAMES:    none — the two bases 0x7687/0x7547 are ROM-immediate video-RAM (tilemap)
 *           pointers, not named work-RAM addresses; the shared filler is the already-
 *           decompiled callee stampTwoTileBands (ROM 0x0D4C).
 */

import { stampTwoTileBands } from "./stampTwoTileBands.js";

// Fixed tilemap row bases stamped, in order (the oracle's two `ld hl,nn` immediates).
const ROW_BASES = [0x7687, 0x7547];

export function stampRivetBoardBands(m) {
  const { regs } = m;
  for (const base of ROW_BASES) {
    regs.hl = base; // ld hl,base
    stampTwoTileBands(m); // call/fall-into 0x0D4C: fill 4x 0xFD, +0x1C, 4x 0xFC
  }
}
