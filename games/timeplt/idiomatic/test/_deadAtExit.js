// SPDX-License-Identifier: GPL-3.0-only
/**
 * Test-only instrument: is a register DEAD where a frozen dispatch hands back? Asked of the ORACLE,
 * never of a rewrite, so the answer is a property of the machine and not of the module under test.
 *
 * poisonedRun({ at, poison, tape, frames, only }) — run a whole session on the all-frozen game with
 *   the routine at `at` wrapped: the frozen routine runs exactly as it would, and then every register
 *   named in `poison` is complemented (every bit flipped) before control goes back to whatever the
 *   ROM does next. `only(m)`, when given, picks which dispatches are poisoned (checked on entry). The
 *   state dumped at each frame boundary (RAM, VRAM, sprites) is compared against an unpoisoned run of
 *   the same tape and length; the cells whose dump differs are returned, along with how many
 *   dispatches were poisoned and how the run ended. An empty cell list over a session means no
 *   poisoned value reached that per-frame dump — writes elsewhere, and values overwritten within a
 *   frame, are not seen.
 *
 *   `flip` narrows the poison for a named register to the bits given, in place of all of them.
 *
 *   `before: true` poisons on ENTRY instead, before the frozen routine runs: a control that the
 *   instrument hears a register the routine reads. It says nothing about whether the EXIT poison
 *   lands, so an exit needs its own control — poison there something the ROM must read (SP, which
 *   the return pops through) and require it to be heard.
 *
 * heard(run) — the run differed from the unpoisoned one: it threw, stopped, or changed a cell.
 */

import { makeMachine } from "./_harness.js";

const WIDE = new Set(["ix", "iy", "sp"]);

function complement(m, names, flip) {
  for (const k of names) m.regs[k] = m.regs[k] ^ (flip[k] ?? (WIDE.has(k) ? 0xffff : 0xff));
}

const baselines = new Map();

function baseline(tape, frames) {
  const key = `${tape === undefined ? "default" : JSON.stringify(tape)}/${frames}`;
  if (!baselines.has(key)) {
    const m = makeMachine(undefined, tape === undefined ? {} : { tape });
    const trace = m.runFrames(frames);
    baselines.set(key, { trace, toAddr: (o) => m.stateOffsetToAddr(o), stopped: m.stoppedBy });
  }
  return baselines.get(key);
}

export function poisonedRun({ at, poison, tape, frames, only = () => true, before = false, flip = {} }) {
  const base = baseline(tape, frames);
  const frozen = makeMachine().routines.get(at);
  let poisoned = 0;
  const host = makeMachine(new Map([[at, (m, ...args) => {
    const hit = only(m);
    if (hit) poisoned++;
    if (hit && before) complement(m, poison, flip);
    const r = frozen(m, ...args);
    if (hit && !before) complement(m, poison, flip);
    return r;
  }]]), tape === undefined ? {} : { tape });
  let trace = [];
  let threw = null;
  try { trace = host.runFrames(frames); } catch (e) { threw = e.constructor.name; }
  const cells = new Set();
  const n = Math.min(base.trace.length, trace.length);
  for (let i = 0; i < n; i++) {
    const x = base.trace[i];
    const y = trace[i];
    for (let o = 0; o < x.length; o++) if (x[o] !== y[o]) cells.add(base.toAddr(o));
  }
  return {
    cells: [...cells].sort((a, b) => a - b),
    frames: n,
    poisoned,
    threw,
    stopped: host.stoppedBy,
    baselineStopped: base.stopped,
  };
}

export function heard(run) {
  return run.threw !== null || run.stopped !== run.baselineStopped || run.cells.length > 0;
}

export function heardAs(run) {
  return run.threw ?? (run.stopped !== run.baselineStopped ? `stopped: ${run.stopped}` : `${run.cells.length} cells`);
}
