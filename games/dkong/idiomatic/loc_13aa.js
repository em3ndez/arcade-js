// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_13aa — small in-game state reset: mirror the cabinet DIP into the flip-screen
 * latch, clear the sub-state, and set the player-context word to 1.  ROM 0x13AA.
 *
 * One of the 29 in-game sub-state handlers dispatched from dispatchInGameSubstate
 * (the ROM 0x0702 table, table idx 18) while a credited game runs. It is a small,
 * almost input-free state reset: it reads exactly ONE byte and produces four fixed
 * effects, nothing branches.
 *
 *   - ld a,(0x6026) / ld (0x7d82),a — copy DIP_UPRIGHT (the cabinet-orientation DIP)
 *     into the flip-screen latch 0x7D82. That is an I/O latch, NOT work RAM — the
 *     memory seam decodes 0x7D82 to io.writeFlipScreen(value & 1), so only bit 0 of
 *     the stored byte reaches the latch.
 *   - xor a / ld (0x600a),a — clear GAME_SUBSTATE to 0.
 *   - ld hl,0x0101 / ld (0x600d),hl — set CURRENT_PLAYER (0x600D) = 1 and the
 *     adjacent ACTIVE_PLAYER_INDEX (0x600E) = 1 (the low/high halves of the 16-bit store).
 *
 * Its sibling loc_13bb (idx 19) is the mirror image — it clears CURRENT_PLAYER (0x600D) /
 * ACTIVE_PLAYER_INDEX (0x600E) / GAME_SUBSTATE (0x600A) to 0 and forces the flip-screen
 * latch to 1. ram.js reads the pair as the two-player "player switch" (CURRENT_PLAYER's
 * note: "loc_13aa sets 1, loc_13bb clears 0").
 *
 * NAME kept neutral loc_13aa on purpose. The memory mechanics above are certain, but
 * the game-level MEANING of this reset — why sub-state 18 clears GAME_SUBSTATE mid-game,
 * and what ACTIVE_PLAYER_INDEX (0x600E) == 1 signifies next to CURRENT_PLAYER — is a
 * single-proposer hypothesis, not corroborated to the routine-name evidence bar (the
 * same call its three decompiled siblings loc_138f / loc_13a1 / loc_13ca each made).
 * ram.js itself flags ACTIVE_PLAYER_INDEX's discriminating readers as unexercised in
 * attract, so its lockstep value here is trusted but its game-level role is not. The
 * "set flip = DIP but current-player = P2" reading is not even internally clean, so a
 * confident English name here would over-assert (the routine-level sprite-record trap).
 * Promote once the player-switch reading is independently confirmed.
 *
 * Memory-equivalent to the frozen oracle — equivalence-13aa.test.js.
 * GATE:     exhaustive — the routine's entire observable behaviour is a TOTAL function
 *           of one input byte, DIP_UPRIGHT (0x6026); swept over all 256 values vs the
 *           oracle on RAM − STACK_SCRATCH AND the flip-screen latch (io.flipScreen — the
 *           0x7D82 write hits it but dumpState() does NOT capture it, so it is compared
 *           explicitly or the flip write has no teeth). The base entry seeds
 *           0x600A/0x600D/0x600E to non-target sentinels so each write is observable,
 *           plus the same check crafted onto real credited-game states. Never dispatched
 *           in attract; reached in-game only when GAME_SUBSTATE == 18.
 * LIVE-OUT: memory-only + the 0x7D82 flip-screen I/O latch — writes GAME_SUBSTATE
 *           (0x600A), CURRENT_PLAYER (0x600D), ACTIVE_PLAYER_INDEX (0x600E), and the flip
 *           latch. The dispatcher discards this handler's return and issues no register
 *           read after it, so the oracle's residual A/HL/flags are dead ABI; SP/pc are the
 *           Z80 `ret` the direct-call return replaces and are not modelled.
 * NAMES:    DIP_UPRIGHT (0x6026), GAME_SUBSTATE (0x600A), CURRENT_PLAYER (0x600D),
 *           ACTIVE_PLAYER_INDEX (0x600E, the high byte of the oracle's 0x600D word store)
 *           from ram.js. 0x7D82 (flip-screen latch — an I/O port, not work RAM) stays hex.
 */

import { DIP_UPRIGHT, GAME_SUBSTATE, CURRENT_PLAYER, ACTIVE_PLAYER_INDEX } from "./ram.js";

// Flip-screen latch (ls259 output, mirrored from the cabinet-orientation DIP). An I/O
// port, not work RAM — the seam decodes 0x7D82 to io.writeFlipScreen(value & 1).
const FLIP_SCREEN_LATCH = 0x7d82;

export function loc_13aa(m) {
  const { mem } = m;

  // ld a,(0x6026) / ld (0x7d82),a — mirror the cabinet-orientation DIP into the
  // flip-screen latch. The seam masks the stored byte down to bit 0.
  mem.write8(FLIP_SCREEN_LATCH, mem.read8(DIP_UPRIGHT));

  // xor a / ld (0x600a),a — clear the in-game sub-state index.
  mem.write8(GAME_SUBSTATE, 0);

  // ld hl,0x0101 / ld (0x600d),hl — set CURRENT_PLAYER = 1 and the adjacent
  // ACTIVE_PLAYER_INDEX (0x600E) = 1 (the low then high halves of the 16-bit store;
  // both land in plain work RAM, so the write order is immaterial).
  mem.write8(CURRENT_PLAYER, 1);
  mem.write8(ACTIVE_PLAYER_INDEX, 1);
}
