// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1344 — idx-15 in-game sub-state handler: decrement the current player's
 * lives, save the live context to player 2's slot, then branch on lives-left.
 * ROM 0x1344.
 *
 * Entry 15 (0x0F) of the 0x0702 rst-0x28 sub-state table (dispatchGameState /
 * GAME_SUBSTATE selector, GAME_STATE == in-game). It is the exact TWIN of loc_12f2
 * (idx 14) with player-2 constants where loc_12f2 uses player-1's, so the two form
 * the per-player life-loss pair. Its steps, in order:
 *
 *   1. Silence all sound (silenceSound, ROM 0x011C) for the transition.
 *   2. Clear PLAY_INTRO (0x622C = 0).
 *   3. Decrement LIVES (0x6228) — the live player-context block's first byte — and
 *      copy the whole 8-byte live block (0x6228..0x622F, which includes the just-
 *      zeroed PLAY_INTRO) into player 2's save slot P2_CONTEXT (0x6048..0x604F).
 *   4. Branch on the DECREMENTED lives (the oracle's `and a / jp nz`):
 *      - lives != 0 (still playing): select the next sub-state via GAME_SUBSTATE
 *        (0x600A) = 0x17 normally, or 0x08 only when the OTHER player is also out
 *        (P1_CONTEXT[0] = 0x6040, player 1's lives, == 0).
 *      - lives == 0 (this player's game over): rank the finished score
 *        (loc_13ca with A=0x03 / HL=P2_SCORE — the player-2 selector), post the two
 *        game-over render tasks ([0x03,0x03] then [0x03,0x00] via enqueueTask),
 *        stamp the 5x14 tile block at 0x76D3 (fillTileBlock), arm the sub-state
 *        countdown (SUBSTATE_TIMER 0x6009 = 0xC0) and select GAME_SUBSTATE = 0x11.
 *
 * The routine reads no incoming register (every value is loaded fresh); its inputs
 * are the RAM it reads. It writes memory only, via its own stores and four callees.
 *
 * NAME kept neutral loc_1344 on purpose: the MECHANISM is understood, but the exact
 * game-semantic identity of the idx-14/15 pair (player index vs context-slot index,
 * the 0x17/0x08 selection's meaning) is inference from a single proposer, below the
 * proposer!=confirmer bar — and the whole idx family (loc_11fa/127f/12ac/12f2/138f/
 * 13a1) plus the sibling loc_13ca are kept neutral for the same reason. Promote only
 * once the family's semantics are confirmed in names.js.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1344.test.js.
 * GATE:     crafted-entry — 0x1344 is UNREACHED in attract (0 dispatches over a
 *           1200-frame window; it is player-2's in-game life-loss sub-state, needing a
 *           two-player game to reach), so a real attract-base machine is poked to each
 *           arm identically on both sides: lives-remaining (P1 alive -> 0x17, P1 out
 *           -> 0x08, and the dec-underflow 0->0xFF edge) and game-over (loc_13ca guard
 *           skip vs full body). Full oracle both sides; teeth = a wrong-save-slot twin
 *           (the loc_12f2 copy-paste) and a wrong-game-over-substate twin.
 * LIVE-OUT: memory-only — the routine is reached by rst-0x28 dispatch and its `ret`
 *           returns up the sub-state dispatcher / NMI path, which consumes none of the
 *           residual A/BC/DE/HL/flags. pc/SP are the dropped stack model: the oracle's
 *           push16/call pairs are SP-neutral (each callee's ret pops its push) and its
 *           terminal `ret` is the single caller-return pop the direct-call layer
 *           replaces with a JS return, so this routine leaves SP/pc untouched.
 * NAMES:    LIVES (0x6228), PLAY_INTRO (0x622C), P1_CONTEXT (0x6040),
 *           P2_CONTEXT (0x6048), GAME_SUBSTATE (0x600A), SUBSTATE_TIMER (0x6009),
 *           P2_SCORE (0x60B5) from names.js. 0x76D3 is a raw tilemap address (the
 *           block-fill top-left), kept hex. Imports the four decompiled callees.
 */

import { silenceSound } from "./silenceSound.js"; // ROM 0x011C
import { loc_13ca } from "./loc_13ca.js"; //         ROM 0x13CA
import { enqueueTask } from "./enqueueTask.js"; //   ROM 0x309F
import { fillTileBlock } from "./fillTileBlock.js"; // ROM 0x1826
import {
  LIVES, //          0x6228 — live player-context block, byte 0
  PLAY_INTRO, //     0x622C
  P1_CONTEXT, //     0x6040 — player 1's saved context, byte 0 = P1 lives
  P2_CONTEXT, //     0x6048 — player 2's saved context (the ldir destination)
  GAME_SUBSTATE, //  0x600A
  SUBSTATE_TIMER, // 0x6009
  P2_SCORE, //       0x60B5
} from "./names.js";

const CONTEXT_BYTES = 8; // the live context block is 0x6228..0x622F (LIVES first)
const BLOCK_FILL_TOPLEFT = 0x76d3; // raw tilemap cell handed to fillTileBlock

export function loc_1344(m) {
  const { regs, mem } = m;

  // 1. Silence sound for the transition.
  silenceSound(m); // ROM 0x011C

  // 2. Clear the play-intro flag (xor a / ld (0x622C),a).
  mem.write8(PLAY_INTRO, 0);

  // 3. Decrement LIVES, then copy the 8-byte live context block (0x6228..0x622F,
  //    now holding the decremented lives and the zeroed PLAY_INTRO) into P2_CONTEXT.
  //    Order matches the oracle: PLAY_INTRO is cleared BEFORE the ldir reads the block.
  const lives = (mem.read8(LIVES) - 1) & 0xff; // dec (0x6228)
  mem.write8(LIVES, lives);
  for (let i = 0; i < CONTEXT_BYTES; i++) {
    mem.write8((P2_CONTEXT + i) & 0xffff, mem.read8((LIVES + i) & 0xffff)); // ldir 8 -> 0x6048
  }

  // 4. Branch on the decremented lives (and a / jp nz).
  if (lives !== 0) {
    // Still playing: 0x17 normally; 0x08 only when player 1 is also out of lives.
    mem.write8(GAME_SUBSTATE, mem.read8(P1_CONTEXT) !== 0 ? 0x17 : 0x08);
    return;
  }

  // Lives exhausted — this player's game over.
  // Rank the finished score (player-2 selector A=0x03, HL=P2_SCORE).
  regs.a = 0x03;
  regs.hl = P2_SCORE;
  loc_13ca(m); // ROM 0x13CA

  // Post the two game-over render tasks: [opcode 0x03, arg 0x03] then [0x03, 0x00].
  regs.d = 0x03;
  regs.e = 0x03;
  enqueueTask(m); // ROM 0x309F
  regs.d = 0x03;
  regs.e = 0x00;
  enqueueTask(m); // ROM 0x309F

  // Stamp the fixed 5x14 tile block at 0x76D3.
  regs.hl = BLOCK_FILL_TOPLEFT;
  fillTileBlock(m); // ROM 0x1826

  // Arm the sub-state countdown and select the next sub-state.
  mem.write8(SUBSTATE_TIMER, 0xc0); // ld (0x6009),0xC0
  mem.write8(GAME_SUBSTATE, 0x11); //  ld (0x600A),0x11
}
