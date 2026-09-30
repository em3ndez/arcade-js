// SPDX-License-Identifier: GPL-3.0-only
/**
 * Test-only instrument: is a register DEAD where a frozen dispatch hands back? Asked of the ORACLE,
 * never of a rewrite, so the answer is a property of the machine and not of the module under test.
 * This file is the ONLY place a session is poisoned: tests call assertDeadAtExit (or, for a register
 * some callers do read, handOffReaders), never the run underneath, so no arm can leave out its
 * exit-side control.
 *
 * The run underneath (poisonedRun, not exported): a whole session on the all-frozen game with the
 *   routine at `at` wrapped: the frozen routine runs exactly as it would, and then every register
 *   named in `poison` is complemented (or XORed by `flip[k]`) before control goes back to whatever
 *   the ROM does next (`before: true` poisons on ENTRY instead). `only(m)` (checked on entry) picks
 *   which dispatches are poisoned. `pokes` ([{ frame, addr, val, dur }], JS frames) are laid on BOTH
 *   the unpoisoned baseline and the poisoned run. The state dumped at each frame boundary (RAM, VRAM,
 *   sprites, the stack page included) is compared against the baseline; the differing cells, the
 *   dispatch count and how the run ended are returned. Writes elsewhere, and values overwritten
 *   within a frame, are not seen.
 *
 * heard(run) — the run differed from the unpoisoned one: it threw, stopped, or changed a cell.
 *
 * assertDeadAtExit({ at, poison, sessions, ... }) — THE form every DEAD AT EXIT arm takes. Per session
 *   it runs the exit poison AND, at the same exit with the same `only`, an SP flip (the ROM returns
 *   through the stack, so an exit poison that lands must be heard), plus the arm's own `controls`
 *   (an entry-side poison that must be heard, a register that must be heard LIVE at the exit, a
 *   second poison that must stay silent). It fails unless some session poisons a dispatch, the
 *   poison is silent in every session, the SP flip is heard in some session that poisoned one, and
 *   every control holds.
 *
 * TAPE_SESSIONS — attract, coin-start, and every distant state the tapes/*.poke.json schedules drive
 *   (their coin/start presses and pokes, laid out in JS frames the way tools/distant_suite.py does:
 *   presses one frame later than the schedule, pokes on the schedule's own frame).
 *
 * handOffReaders({ at, poison, sessions, frames }) — the HAND-OFF measurement (runbook §4): which
 *   callers hear the register, one return address at a time, with the same SP exit control.
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { makeMachine, COIN_START_TAPE } from "./_harness.js";

const WIDE = new Set(["ix", "iy", "sp", "af", "bc", "de", "hl"]);

function complement(m, names, flip) {
  for (const k of names) m.regs[k] = m.regs[k] ^ (flip[k] ?? (WIDE.has(k) ? 0xffff : 0xff));
}

const baselines = new Map();

function baseline(tape, frames, pokes) {
  const key = `${tape === undefined ? "default" : JSON.stringify(tape)}/${frames}/${JSON.stringify(pokes)}`;
  if (!baselines.has(key)) {
    const m = makeMachine(undefined, tape === undefined ? {} : { tape });
    if (pokes.length) m.pokes = pokes;
    const trace = m.runFrames(frames);
    baselines.set(key, { trace, toAddr: (o) => m.stateOffsetToAddr(o), stopped: m.stoppedBy });
  }
  return baselines.get(key);
}

function poisonedRun({ at, poison, tape, pokes = [], frames, only = () => true, before = false, flip = {} }) {
  const base = baseline(tape, frames, pokes);
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
  if (pokes.length) host.pokes = pokes;
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

const TAPES = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "tapes");
const PRESS_BITS = { coin: 0x01, start1p: 0x08, start2p: 0x10 };
const IN0 = COIN_START_TAPE[0].port;
const int = (v) => (typeof v === "string" ? Number.parseInt(v, 16) : v);

function sessionOf(file) {
  const s = JSON.parse(readFileSync(join(TAPES, file), "utf8"));
  const presses = s.inputs ?? [{ frame: s.coin, press: "coin" }, { frame: s.start, press: "start1p" }];
  return {
    label: s.name,
    tape: presses.map((p) => ({ frame: p.frame + 1, port: IN0, bits: PRESS_BITS[p.press], dur: s.hold })),
    pokes: s.pokes.map((p) => ({ frame: p.frame, addr: int(p.addr), val: int(p.val), dur: p.dur ?? null })),
  };
}

/** Attract, coin-start, and every poke-driven distant state (see the header). */
export const TAPE_SESSIONS = [
  { label: "attract", tape: [], pokes: [] },
  { label: "coin-start", tape: undefined, pokes: [] },
  ...readdirSync(TAPES).filter((f) => f.endsWith(".poke.json")).sort().map(sessionOf),
];

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

/**
 * sessions: [{ label, tape, pokes, frames, dispatches }] — `frames` falls back to the argument;
 *   `dispatches`, when given, is the exact count the session must poison; `reachEvery: true` makes
 *   every session poison at least one dispatch.
 * scratch: stack-page cells (0xAE00-0xAFFF) where a poisoned register shows only as a PUSHED copy
 *   (a saved register popped back, or scratch pushed and popped) — the caller states whose push it
 *   is; a changed cell anywhere else, a throw or a changed stop is still heard.
 * controls: [{ label, at = the target, poison, flip, before = false, only, expect = "heard",
 *   every = false, reachEvery = false, dataOnly = false }], run per session. "heard": heard in some
 *   session (in every session that poisoned one, with `every`); "silent": silent (scratch aside) in
 *   every session; "reach": only that some session dispatches it (an empty `poison` with an `only`
 *   counts a branch taken). `reachEvery`: it must dispatch in every session. `dataOnly`: "heard"
 *   needs a throw, a changed stop or a changed cell OUTSIDE the stack page.
 * Returns [{ label, dead, exitControl, controls: { [control label]: run } }] for further assertions.
 */
const STACK_PAGE = [0xae00, 0xafff];
const inStackPage = (a) => a >= STACK_PAGE[0] && a <= STACK_PAGE[1];

export function assertDeadAtExit({
  at, poison, sessions, frames, only, flip, scratch = [], controls = [], reachEvery = false,
}) {
  for (const a of scratch) assert.ok(inStackPage(a), `${hex4(a)} is not in the stack page, so it is not scratch`);
  const isScratch = (a) => scratch.includes(a);
  const silent = (run) => run.threw === null && run.stopped === run.baselineStopped &&
    run.cells.every(isScratch);
  const hears = (c, r) => (c.dataOnly
    ? r.threw !== null || r.stopped !== r.baselineStopped || r.cells.some((a) => !inStackPage(a))
    : heard(r));
  const results = [];
  for (const s of sessions) {
    const run = { at, tape: s.tape, pokes: s.pokes ?? [], frames: s.frames ?? frames, only };
    assert.ok(Number.isInteger(run.frames), `${s.label}: no frame count`);
    const dead = poisonedRun({ ...run, poison, flip });
    const exitControl = poisonedRun({ ...run, poison: ["sp"], flip: { sp: 2 } });
    if (s.dispatches !== undefined) {
      assert.equal(dead.poisoned, s.dispatches, `${s.label}: poisoned ${dead.poisoned} of ${s.dispatches} dispatches`);
    }
    if (reachEvery) assert.ok(dead.poisoned > 0, `${s.label}: the session never dispatched ${hex4(at)}`);
    assert.equal(dead.threw, null, `${s.label}: the poisoned run threw ${dead.threw}`);
    assert.equal(dead.stopped, dead.baselineStopped, `${s.label}: the poisoned run stopped as ${dead.stopped}`);
    assert.equal(dead.frames, run.frames, `${s.label}: compared ${dead.frames} of ${run.frames} frames`);
    assert.deepEqual(dead.cells.filter((a) => !isScratch(a)).map(hex4), [],
      `${s.label}: a register poisoned where ${hex4(at)} hands back (${poison.join(", ")}) was read after it`);
    const ran = {};
    for (const c of controls) {
      ran[c.label] = poisonedRun({
        at: c.at ?? at, poison: c.poison, flip: c.flip ?? {}, before: c.before ?? false, only: c.only,
        tape: run.tape, pokes: run.pokes, frames: run.frames,
      });
      if (c.reachEvery) assert.ok(ran[c.label].poisoned > 0, `${s.label}: the ${c.label} control never reached ${hex4(c.at ?? at)}`);
      if ((c.expect ?? "heard") === "silent") {
        assert.ok(silent(ran[c.label]), `${s.label}: the ${c.label} control was heard (${heardAs(ran[c.label])})`);
      }
    }
    const saved = dead.cells.filter(isScratch);
    const described = controls.map((c) => `${c.label} ${heard(ran[c.label]) ? `heard (${heardAs(ran[c.label])})` : "silent"}`);
    console.log(`  DEAD AT EXIT/${s.label}: ${dead.poisoned} exits poisoned (${poison.join(", ")}), nothing differs` +
      `${saved.length ? ` but stack-page scratch ${saved.map(hex4).join(", ")}` : ""}; ` +
      `the exit control ${heard(exitControl) ? `is heard (${heardAs(exitControl)})` : "is not heard"}` +
      `${described.length ? `; ${described.join("; ")}` : ""}`);
    results.push({ label: s.label, dead, exitControl, controls: ran });
  }
  assert.ok(results.some((r) => r.dead.poisoned > 0), `no session dispatched ${hex4(at)}, so its silence is vacuous`);
  assert.ok(results.some((r) => r.dead.poisoned > 0 && heard(r.exitControl)), `SP flipped where ${hex4(at)} ` +
    "hands back went unheard in every session that reached it, so the exit poison never lands and its silence proves nothing");
  for (const c of controls) {
    const reached = results.filter((r) => r.controls[c.label].poisoned > 0);
    assert.ok(reached.length > 0, `the ${c.label} control never reached ${hex4(c.at ?? at)}`);
    if ((c.expect ?? "heard") !== "heard") continue;
    if (c.every) {
      for (const r of reached) assert.ok(hears(c, r.controls[c.label]), `${r.label}: the ${c.label} control went unheard`);
    } else {
      assert.ok(reached.some((r) => hears(c, r.controls[c.label])), `the ${c.label} control went unheard in every ` +
        "session, so the instrument cannot hear it and the silence above proves nothing");
    }
  }
  return results;
}

/** Return address of a call/rst on entry: the word on top of the stack. */
export const returnAddressOf = (m) => m.mem8[m.regs.sp] | (m.mem8[(m.regs.sp + 1) & 0xffff] << 8);

/**
 * The HAND-OFF measurement: which callers of the frozen routine at `at` hear `poison` complemented
 * as it hands back, one caller (return address) at a time. Every caller a session takes is poisoned
 * in that session; a caller counts as a reader when some session hears it. Returns
 * { callers: Set, readers: Map(return address -> "session: how heard"), exitControl }; the SP flip at
 * the same exit, on the first session, must be heard.
 */
export function handOffReaders({ at, poison, sessions, frames }) {
  const callers = new Set();
  const readers = new Map();
  for (const s of sessions) {
    const run = { at, tape: s.tape, pokes: s.pokes ?? [], frames: s.frames ?? frames };
    const seen = new Set();
    poisonedRun({ ...run, poison: [], only: (m) => { seen.add(returnAddressOf(m)); return false; } });
    for (const ret of seen) {
      callers.add(ret);
      if (readers.has(ret)) continue;
      const r = poisonedRun({ ...run, poison, only: (m) => returnAddressOf(m) === ret });
      assert.ok(r.poisoned > 0, `${s.label}: the caller after ${hex4(ret)} was seen but never poisoned`);
      if (heard(r)) readers.set(ret, `${s.label}: ${heardAs(r)}`);
    }
  }
  // The exit control: SP flipped where the routine hands back must be heard, or no poison here lands.
  const first = sessions[0];
  const exitControl = poisonedRun({
    at, poison: ["sp"], flip: { sp: 2 }, tape: first.tape, pokes: first.pokes ?? [], frames: first.frames ?? frames,
  });
  assert.ok(heard(exitControl), `SP flipped where ${hex4(at)} hands back went unheard in ${first.label}`);
  return { callers, readers, exitControl };
}
