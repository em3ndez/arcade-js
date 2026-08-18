// SPDX-License-Identifier: GPL-3.0-only
/**
 * forceClearPlayerWorkRam  —  ROM 0x07eb  ·  grounding: [code]
 *
 * WHAT IT IS
 *   The unconditional, unguarded wipe of the active player's work RAM. In one shot it zeroes two
 *   disjoint RAM blocks that together hold everything about the current frog and its home-bay progress:
 *     • the 32-byte frog object block  — FROG_X (0x8044) through 0x8063
 *     • the 12-byte home-bay gate block — HOME_BAY_GATE_BLOCK (0x8420) through 0x842b
 *   There is no test and no early-out: every call clears both blocks. This is the "blank slate" that the
 *   frog-reseed routines (resetFrogObject / activateFrogObject) and the board-layout code build on top of.
 *
 * WHERE IT SITS
 *   This is the unguarded tail of a two-part primitive. Its sibling clearActivePlayerWorkRam (ROM 0x07e6)
 *   is the guarded front door: in a one-player game (PLAY_FLAG 0x83fe == 1) it returns and leaves the
 *   blocks intact; in a two-player game or attract (PLAY_FLAG 0 or 2) it FALLS INTO this routine. In the
 *   frozen ROM the two are one contiguous piece of code — 0x07e6 guards, 0x07eb clears. The one-player
 *   skip in the front door exists because a two-player game banks its work RAM in and out per turn and
 *   must wipe before it swaps, whereas a single player's frog/gate state is carried across the reset.
 *   The clear is reached on every occasion the machine reseeds a player: cold start (new game), the
 *   once-per-board in-play layout, next-life, and the fifth/last home-bay arrival.
 *
 * LIVE-OUT
 *   Memory only — 44 zeroed bytes across the two blocks. It returns nothing and leaves no register the
 *   caller reads. The frozen ROM tail ends in a `ret`; the idiomatic form omits it — a direct caller
 *   leaves the stack untouched, and a dispatched caller gets its return supplied by the omitted-return
 *   wiring, so there is no observable stack effect to reproduce.
 */
import { FROG_X, HOME_BAY_GATE_BLOCK } from "./names.js";
import { u16 } from "../../../core/int.js";

// Length of the frog object block: 0x20 = 32 bytes, FROG_X (0x8044) .. 0x8063. This span carries the
// frog's whole live object state — X/Y position, sprite code, object attribute, hop counters and timers,
// furthest-row, and so on — which the reseed routines rewrite from scratch after the wipe.
const FROG_BLOCK_LEN = 0x20;

// Length of the home-bay gate block: 0x0c = 12 bytes, HOME_BAY_GATE_BLOCK (0x8420) .. 0x842b. These bytes
// hold the current player's home-bay occupancy / gate state (which of the five home bays are filled).
// Zeroing them reopens every bay for the fresh board or player.
const GATE_BLOCK_LEN = 0x0c;

export function forceClearPlayerWorkRam(m) {
  const { mem8 } = m;

  // ── Wipe the frog object block ───────────────────────────────────────────────────────
  // Zero all 32 bytes from FROG_X (0x8044) up. u16() masks each address to the Z80's 16-bit bus, mirroring
  // the frozen block-clear; here the sums never exceed 0xffff, so the wrap is documentation, not arithmetic.
  for (let i = 0; i < FROG_BLOCK_LEN; i++) mem8[u16(FROG_X + i)] = 0;

  // ── Wipe the home-bay gate block ─────────────────────────────────────────────────────
  // Zero the 12 gate bytes from HOME_BAY_GATE_BLOCK (0x8420) up, clearing all home-bay progress. This
  // block sits well away from the frog block, so it is a separate loop rather than one contiguous span.
  for (let i = 0; i < GATE_BLOCK_LEN; i++) mem8[u16(HOME_BAY_GATE_BLOCK + i)] = 0;
}
