// SPDX-License-Identifier: GPL-3.0-only
import { firstStateDiff } from "./equivalence.js";
// Register-bridge re-seat tooth (reviewer-rules R37; design: scratchpad/REGISTER-LIVEOUT-TOOTH-DESIGN.md).
// From one entry clone, run `optimizedFn` with its bridge registers POISONED and the intended values
// handed in as `args`, vs `translatedFn` with those registers LIVE. A re-seat recovers (RAM-equal); a
// missing re-seat leaks the poison into a deep reader's write (RAM diverges) -- the b0602b4f class,
// invisible to memory-eq. RAM only, minus excludeAddr; the poisoned registers are not compared.
// `poison[r]` MUST differ from `live[r]` or the tooth has no teeth (the masking that hid the class).
export function bridgeReseatEquivalent(entry, translatedFn, optimizedFn, opts = {}) {
  const { live = {}, poison = {}, args = [], excludeAddr } = opts;
  for (const r of Object.keys(live)) {
    if (poison[r] === live[r]) throw new Error(`bridgeReseatEquivalent: poison.${r} == live.${r} -- no teeth`);
  }
  const a = entry.clone();
  const b = entry.clone();
  for (const [r, v] of Object.entries(live)) a.regs[r] = v;
  for (const [r, v] of Object.entries(poison)) b.regs[r] = v;
  translatedFn(a);
  optimizedFn(b, ...args);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off), excludeAddr);
  return { equal: !ram, ram };
}
