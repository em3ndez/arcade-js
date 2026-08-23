// SPDX-License-Identifier: GPL-3.0-only
import { ATTRACT_SUBSTATE, ATTRACT_SUBSTATE_DISPATCH, ATTRACT_HANDLER_EPILOGUE_ADDR } from "./names.js";
/**
 * loc_0899 — attract/demo sequence driver (top-level game state 1).
 *
 * Reads the attract sub-state selector and dispatches it through the shared rst-0x28 trampoline into
 * the nine-entry inline handler table; every handler returns to the shared epilogue slot, which then
 * returns to this driver's caller. LIVE-OUT: none — a void per-frame dispatch.
 */
export function loc_0899(m) {
  m.regs.a = m.mem8[ATTRACT_SUBSTATE]; // sub-state index the dispatcher reads
  m.push16(ATTRACT_HANDLER_EPILOGUE_ADDR); // handler return slot -> shared epilogue (popped by the handler's ret)
  m.push16(ATTRACT_SUBSTATE_DISPATCH); // inline jump-table base the rst-0x28 dispatcher pops
  m.call(0x0028); // rst-0x28 spine dispatcher (unlifted) -> selected handler -> rets to the epilogue slot
  return m.call(ATTRACT_HANDLER_EPILOGUE_ADDR); // run the shared epilogue the handler ret'd into -> caller
}
