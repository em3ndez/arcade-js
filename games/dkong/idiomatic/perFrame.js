// SPDX-License-Identifier: GPL-3.0-only
/**
 * perFrame — the per-frame service + game-state dispatch tail of the vblank NMI: decrement
 * FRAME (releasing the main loop's vblank spin), run the three service routines, dispatch the
 * top-level GAME_STATE to its handler, then re-enable the NMI and return from the interrupt.
 *
 * LIVE-OUT: memory — FRAME, the PRNG seed, the coin/credit and sound/task state, and whatever
 * the dispatched handler writes — plus the restored stack pointer and program counter. No
 * register or flag is live: the interrupted main loop reloads from memory.
 */

import {
  FRAME,
  GAME_STATE,
  NMI_ENABLE,
} from "./names.js";
import { NotImplemented } from "../../../boards/dkong/io.js";
import { stirRandomSeed } from "./stirRandomSeed.js";
import { serviceCoinInput } from "./serviceCoinInput.js";
import { soundDriverTick } from "./soundDriverTick.js";
import { runAttractState } from "./runAttractState.js";
import { dispatchInGameSubstate } from "./dispatchInGameSubstate.js";
import { powerOnInit } from "./powerOnInit.js";
import { dispatchCreditedSubstate } from "./dispatchCreditedSubstate.js";

// Board I/O: the NMI-enable latch. Writing 1 re-arms the NMI.

const NMI_GAME_STATE = [
  powerOnInit, //            0 — power-on
  runAttractState, //        1 — attract / demo
  dispatchCreditedSubstate, // 2 — credited (pre-game)
  dispatchInGameSubstate, // 3 — in-game sub-state dispatch
];

export function perFrame(m, sp = m.regs.sp) {
  const { regs, mem, mem8 } = m;

  // Snapshot the entry stack pointer: the dispatch does not reliably restore it, but is
  // stack-neutral overall, so the epilogue is a pure function of this value.
  const frameBase = sp;

  mem8[FRAME] = (mem8[FRAME] - 1);

  stirRandomSeed(m);
  serviceCoinInput(m);
  soundDriverTick(m);

  const state = mem8[GAME_STATE];
  const handler = NMI_GAME_STATE[state];
  if (handler === undefined) {
    throw new NotImplemented(
      `GAME_STATE ${state} is out of range for the 4-entry NMI dispatch table at ROM 0x00CA`,
    );
  }
  handler(m);

  // Re-enable the NMI, then return. The saved registers are dead, so drop the 12-byte frame
  // as one stack-pointer adjustment; the return pops the interrupted program counter.
  mem.write8(NMI_ENABLE, 1);
  regs.sp = (frameBase + 12) & 0xffff;
  m.ret();
}
