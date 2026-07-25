// SPDX-License-Identifier: GPL-3.0-only
/**
 * perFrame — the per-frame service + game-state dispatch tail of the vblank NMI.  ROM 0x00B5.
 *
 * Reached at the end of the NMI handler (entry_0066 / serviceVblankNmi), after the
 * sprite DMA blit and the control read. It does the frame's once-per-frame work, in
 * ROM order, then returns from the interrupt:
 *
 *   1. Decrement the frame counter FRAME (0x601A). This is the beat the whole game
 *      keeps time to: the main loop spins comparing FRAME against its saved copy
 *      (0x6383), so this decrement is what RELEASES the main loop for the new frame,
 *      and every periodic event keys off FRAME (`and 0x0F`, `and 0x1F`, rst-0x30
 *      guards). (Direction matters only to those timers — the loop compares for
 *      inequality — but getting it backwards would corrupt every one of them.)
 *   2. Run the three once-per-frame service routines: stir the PRNG seed, debounce
 *      the coin line + award credits, and drain the sound-trigger countdowns.
 *   3. Dispatch the current top-level GAME_STATE (0x6005) to its handler through the
 *      4-entry ROM table at 0x00CA: 0 power-on, 1 attract, 2 credited, 3 in-game.
 *   4. Epilogue (loc_00d2): re-enable the NMI mask and return from the interrupt,
 *      restoring the interrupted main loop's SP and PC.
 *
 * THE DISPATCH, as doc-06 prescribes, is a table of function references rather than the
 * `rst 0x28` trampoline (dispatchInlineJumpTable), which would require pushing the ROM
 * table base onto the Z80 stack — the idiomatic contract's forbidden push16 (same call
 * runAttractState makes for its own sub-table). The table at 0x00CA is a compile-time
 * constant of four addresses, so it folds to NMI_GAME_STATE below and the selected
 * handler is called directly. GAME_STATE is only ever 0..3; an out-of-range value would,
 * in the oracle, form a garbage target that dispatchGameState rejects, so it throws here.
 *
 * THE STACK, and why it is modelled without a single push16. The NMI prologue saved the
 * interrupted context as a 12-byte register frame + the return PC (14 bytes) above the
 * SP perFrame is entered with; the oracle epilogue pops all of it. Those register VALUES
 * are dead — the interrupted main loop was idling at its vblank poll and reloads every
 * register from memory — so this layer does not restore them; what is live is SP and PC.
 * Both are recovered straight from the entry SP (`frameBase`), because the whole dispatch
 * is SP-neutral in the oracle (its push of the epilogue return 0x00D2 nets against the
 * handler's `ret`), so the epilogue always begins at frameBase: SP lands at frameBase+14
 * and PC at the return address stored at frameBase+12. The dispatched handlers are
 * tail-dispatch routines whose own `ret` consumes an epilogue-return slot; called
 * directly here that final `ret` pops a dead byte from the reserved frame and lands PC on
 * a value this epilogue then overwrites — memory-invisible, since every stack byte it
 * touches lives in the excluded STACK_SCRATCH region [0x6be0,0x6c00). Reproducing the
 * push of 0x00D2 would only re-align that dead read; it changes no work RAM, so it is
 * dropped for the direct call. frameBase is snapshotted at entry BEFORE the dispatch,
 * because the handlers do NOT reliably leave SP there (a tail `ret` leaves it +2, the
 * attract credit branch leaves it +0).
 *
 * Memory-equivalent to the frozen oracle — equivalence-00b5.test.js.
 * GATE:     crafted-entry — dispatched every vblank, so real captured perFrame entries
 *           over an attract run (GAME_STATE 0/1) and a driven coin+start run (GAME_STATE
 *           2/3) cover all four state arms with the FULL oracle handler run on both sides.
 *           FRESH clone per case (writes RAM everywhere). Teeth: an omitted frame
 *           decrement (caught at FRAME) and an off-by-one epilogue unwind (caught at SP/pc).
 * LIVE-OUT: memory-only — FRAME, the PRNG seed, the coin/credit + sound/task state, and
 *           whatever the dispatched GAME_STATE handler writes. SP and pc match the oracle
 *           too (the epilogue restores them from frameBase) and ARE in the contract, but
 *           no register/flag is live: the interrupted main loop reloads from memory. Every
 *           push/pop lands in the excluded STACK_SCRATCH region.
 * NAMES:    FRAME (0x601A), GAME_STATE (0x6005) from ram.js. The NMI-enable latch 0x7D84
 *           is a board I/O control port (not work RAM), kept hex as in serviceVblankNmi.
 *           The 0x00CA jump-table target addresses are ROM data — expressed as the four
 *           imported handler functions, not hex literals.
 */

import { FRAME, GAME_STATE } from "../optimized/ram.js";
import { NotImplemented } from "../../../boards/dkong/io.js";
import { stirRandomSeed } from "./stirRandomSeed.js"; //     ROM 0x0057
import { serviceCoinInput } from "./serviceCoinInput.js"; // ROM 0x017B
import { soundDriverTick } from "./soundDriverTick.js"; //   ROM 0x00E0
import { runAttractState } from "./runAttractState.js"; //   ROM 0x073C (GAME_STATE 1)
import { dispatchInGameSubstate } from "./dispatchInGameSubstate.js"; // ROM 0x06FE (GAME_STATE 3)
import { handler_01c3 } from "../translated/handler_01c3.js"; // ROM 0x01C3 (GAME_STATE 0) — still oracle
import { loc_08b2 } from "../translated/loc_08b2.js"; //         ROM 0x08B2 (GAME_STATE 2) — still oracle

// Board I/O: the NMI-enable latch. Writing 1 re-arms the NMI (ROM 0x00DB). A control
// port, not work RAM, so it never appears in the state dump.
const NMI_ENABLE = 0x7d84;

// The 4-entry `rst 0x28` game-state table at ROM 0x00CA, folded to function references.
// Indexed by GAME_STATE (0x6005). Idiomatic handlers where they exist, else the frozen
// oracle (bottom-up: states 0 and 2 have no idiomatic rewrite yet).
const NMI_GAME_STATE = [
  handler_01c3, //           0  ROM 0x01C3 — power-on
  runAttractState, //        1  ROM 0x073C — attract / demo
  loc_08b2, //               2  ROM 0x08B2 — credited (pre-game)
  dispatchInGameSubstate, // 3  ROM 0x06FE — in-game sub-state dispatch
];

export function perFrame(m) {
  const { regs, mem } = m;

  // The NMI prologue left the 12-byte register-save frame at [sp..sp+11] and the
  // interrupted return PC at [sp+12..sp+13]. Snapshot that base now: the dispatch below
  // does not reliably restore SP, but the oracle's dispatch is SP-neutral, so the
  // epilogue is a pure function of this entry SP.
  const frameBase = regs.sp;

  // 1. dec (FRAME) — advance the frame clock; releases the main loop's vblank spin.
  mem.write8(FRAME, (mem.read8(FRAME) - 1) & 0xff);

  // 2. The three once-per-frame service routines, in ROM order.
  stirRandomSeed(m); //   call 0x0057
  serviceCoinInput(m); // call 0x017b
  soundDriverTick(m); //  call 0x00e0

  // 3. Dispatch the top-level game state to its handler (the 0x00CA table).
  const state = mem.read8(GAME_STATE);
  const handler = NMI_GAME_STATE[state];
  if (handler === undefined) {
    // GAME_STATE is a 4-value state (0..3); the oracle would vector a larger value to a
    // garbage target and dispatchGameState throws. Never reached in play.
    throw new NotImplemented(
      `GAME_STATE ${state} is out of range for the 4-entry NMI dispatch table at ROM 0x00CA`,
    );
  }
  handler(m);

  // 4. Epilogue (loc_00d2): re-enable the NMI, then return from the interrupt. The saved
  //    registers are dead (the interrupted main loop reloads them from memory), so drop
  //    the 12-byte frame as one SP adjustment rather than six dead loads; `ret` then pops
  //    the interrupted PC. SP -> frameBase+14, pc -> [frameBase+12].
  mem.write8(NMI_ENABLE, 1);
  regs.sp = (frameBase + 12) & 0xffff;
  m.ret();
}
