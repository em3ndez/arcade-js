// SPDX-License-Identifier: GPL-3.0-only
import { loc_0d78 } from "./loc_0d78.js";
import { PLAY_STATE_INDEX } from "./names.js";
/**
 * loc_0c4e — board-build state dispatcher (NMI epilogue path).
 *
 * Seats its own post-dispatch continuation (the tail past the inline table) as the handler return,
 * then dispatches the play-state index through the shared rst-0x28 trampoline into the inline
 * three-entry handler table. The handler returns to that continuation, which runs and returns to
 * the caller — control comes back rather than tail-escaping. LIVE-OUT: memory only.
 */
const DISPATCH_CONTINUATION = 0x0d78; // handler return slot: this routine's tail past the table
const STATE_HANDLER_TABLE = 0x0c56; // inline word table the rst-0x28 dispatcher pops

export function loc_0c4e(m) {
  const { mem8 } = m;
  m.push16(DISPATCH_CONTINUATION);
  m.regs.a = mem8[PLAY_STATE_INDEX]; // dispatch index the spine reads
  m.push16(STATE_HANDLER_TABLE);
  m.call(0x0028); // rst-0x28 spine dispatcher -> handler -> rets to the continuation
  return loc_0d78(m); // continuation -> rets to the caller
}
