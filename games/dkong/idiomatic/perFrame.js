// SPDX-License-Identifier: GPL-3.0-only
/**
 * perFrame — the per-frame service + game-state dispatch tail of the vblank NMI.
 *
 * Reached at the end of the NMI handler, after the sprite DMA blit and the control read. It
 * does the frame's once-per-frame work, in order, then returns from the interrupt:
 *
 *   1. Decrement the frame counter FRAME. This is the beat the whole game keeps time to: the
 *      main loop spins comparing FRAME against its saved copy, so this decrement is what
 *      RELEASES the main loop for the new frame, and every periodic event keys off FRAME.
 *      Direction matters only to those timers — the loop compares for inequality — but
 *      getting it backwards would corrupt every one of them.
 *   2. Run the three once-per-frame service routines: stir the PRNG seed, debounce the coin
 *      line and award credits, and drain the sound-trigger countdowns.
 *   3. Dispatch the current top-level GAME_STATE to its handler: 0 power-on, 1 attract,
 *      2 credited, 3 in-game.
 *   4. Epilogue: re-enable the NMI mask and return from the interrupt, restoring the
 *      interrupted main loop's stack pointer and program counter.
 *
 * THE DISPATCH is a table of function references rather than a computed jump through a table
 * of addresses, which would require pushing the table base onto the guest stack. The four
 * targets are compile-time constants, so the table folds to NMI_GAME_STATE below and the
 * selected handler is called directly. GAME_STATE is only ever 0..3; a larger value would
 * form a garbage target, so it throws here.
 *
 * THE STACK, and why it is modelled without a single guest push. The NMI prologue saved the
 * interrupted context as a 12-byte register frame plus the return address — 14 bytes — above
 * the stack pointer perFrame is entered with, and the epilogue pops all of it. Those register
 * VALUES are dead: the interrupted main loop was idling at its vblank poll and reloads every
 * register from memory, so this layer does not restore them. What IS live is the stack
 * pointer and the program counter, and both are recovered straight from the entry stack
 * pointer (`frameBase`), because the whole dispatch is stack-neutral — the push of the
 * epilogue's own return address nets against the handler's return — so the epilogue always
 * begins at frameBase. The dispatched handlers are tail dispatches whose final return
 * consumes an epilogue-return slot; called directly here, that return pops a dead byte from
 * the reserved frame and lands the program counter on a value this epilogue then overwrites.
 * Every stack byte involved lies in the dead scratch region, so it is invisible in work RAM.
 * frameBase is snapshotted at entry BEFORE the dispatch, because the handlers do NOT reliably
 * leave the stack pointer there — a tail return leaves it two higher, the attract credit
 * branch leaves it put.
 *
 * LIVE-OUT: memory — FRAME, the PRNG seed, the coin/credit and sound/task state, and whatever
 * the dispatched handler writes — plus the restored stack pointer and program counter. No
 * register or flag is live: the interrupted main loop reloads from memory.
 */

import { FRAME, GAME_STATE } from "./names.js";
import { NotImplemented } from "../../../boards/dkong/io.js";
import { stirRandomSeed } from "./stirRandomSeed.js";
import { serviceCoinInput } from "./serviceCoinInput.js";
import { soundDriverTick } from "./soundDriverTick.js";
import { runAttractState } from "./runAttractState.js";
import { dispatchInGameSubstate } from "./dispatchInGameSubstate.js";
import { powerOnInit } from "./powerOnInit.js";
import { dispatchCreditedSubstate } from "./dispatchCreditedSubstate.js";

// Board I/O: the NMI-enable latch. Writing 1 re-arms the NMI. A control port, not work RAM,
// so it never appears in the state dump.
const NMI_ENABLE = 0x7d84;

// The four game-state handlers, indexed by GAME_STATE.
//
// A handler's own stack delta cannot escape this routine: the epilogue below forces the stack
// pointer back to frameBase + 12 and then returns, so whatever a handler leaves behind is
// overwritten rather than propagated. That is what makes calling all four directly — rather
// than through a guest-stack dispatch — safe, even though in isolation a direct call and a
// guest return leave the stack pointer two apart.
const NMI_GAME_STATE = [
  powerOnInit, //            0 — power-on
  runAttractState, //        1 — attract / demo
  dispatchCreditedSubstate, // 2 — credited (pre-game)
  dispatchInGameSubstate, // 3 — in-game sub-state dispatch
];

export function perFrame(m) {
  const { regs, mem } = m;

  // The NMI prologue left the 12-byte register-save frame just above the stack pointer and
  // the interrupted return address above that. Snapshot that base now: the dispatch below
  // does not reliably restore the stack pointer, but the dispatch is stack-neutral overall,
  // so the epilogue is a pure function of this entry value.
  const frameBase = regs.sp;

  // 1. Advance the frame clock; this releases the main loop's vblank spin.
  mem.write8(FRAME, (mem.read8(FRAME) - 1) & 0xff);

  // 2. The three once-per-frame service routines, in order.
  stirRandomSeed(m);
  serviceCoinInput(m);
  soundDriverTick(m);

  // 3. Dispatch the top-level game state to its handler.
  const state = mem.read8(GAME_STATE);
  const handler = NMI_GAME_STATE[state];
  if (handler === undefined) {
    // GAME_STATE is a 4-value state (0..3); a larger value would vector to a garbage
    // target. Never reached in play.
    throw new NotImplemented(
      `GAME_STATE ${state} is out of range for the 4-entry NMI dispatch table at ROM 0x00CA`,
    );
  }
  handler(m);

  // 4. Epilogue: re-enable the NMI, then return from the interrupt. The saved registers are
  //    dead (the interrupted main loop reloads them from memory), so drop the 12-byte frame
  //    as one stack-pointer adjustment rather than six dead loads; the return then pops the
  //    interrupted program counter from just above it.
  mem.write8(NMI_ENABLE, 1);
  regs.sp = (frameBase + 12) & 0xffff;
  m.ret();
}
