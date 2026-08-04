// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence gate for loc_20a2 (ROM 0x20A2) — the arm that decides whether an object whose fall
 * has just been arrested also turns round, before the frozen bounce tail at ROM 0x20C3.
 *
 * WHAT IS COMPARED, and it is more than the usual contract. Both of this routine's exits are jumps
 * into frozen code that the candidate reaches through the registry exactly as the oracle does, so
 * BOTH sides execute byte-for-byte the same instructions after the three reads — including the same
 * guest-stack operations. That makes four assertions affordable that a routine which dissolves its
 * own tail cannot offer, and all four are made here:
 *   - RAM INCLUDING STACK_SCRATCH. The candidate performs the oracle's stack operations (it performs
 *     none of its own, and neither does the oracle), so the excluded window is shown not to hide a
 *     difference rather than assumed not to.
 *   - the ORACLE's and the CANDIDATE's whole ordered write sequences, address AND value.
 *   - the entire exit register file, SP included. This routine writes no register, so everything
 *     visible at the exit is the frozen tail's and must match exactly.
 *   - the propagated return value.
 * A fault is treated as a result, not as a crashed run: both sides are run inside a catch and the
 * thrown message is part of the comparison, so a crafted entry that walks the frozen tail off a
 * table reports as a breach instead of killing the gate.
 * pc and cycles are NOT compared: they are what cycle-free code gives up. The cycle difference is
 * measured explicitly (test 2) and the live run is driven by an engine that does not consult it.
 *
 *   0. REACHABILITY — measured first, because a live arm against an unreached routine proves
 *      nothing. All THREE code paths are dispatched naturally during attract; the test asserts the
 *      count, that all three paths occur, the object rows attract delivers, and that the number of
 *      kept entries equals the number of dispatches, i.e. nothing is sampled. The path label is
 *      derived from the ORACLE's own outgoing jump target plus the kind byte in the ENTRY state,
 *      never from the candidate, so the coverage claim is not circular. There are three paths and
 *      only two jump targets, which is why the target alone is not the label.
 *   1. EQUAL (captured) — replayed INLINE at each dispatch during the attract run itself: clone,
 *      run both sides, compare, discard. Every dispatch, no sampling, O(1) live memory.
 *   2. CYCLES — the per-path cycle difference between oracle and candidate, measured rather than
 *      assumed. It is path-dependent — three paths, three different constants — which is precisely
 *      why the live run below uses the cycle-free engine instead of charging a constant back.
 *   3. LIVE (whole attract) — the live-out measurement: 12000 attract frames under runCycleFree with
 *      the candidate wired at 0x20A2, its per-frame trace diffed against a baseline that differs in
 *      exactly ONE thing — the body behind the same override, the same seam, the same engine. The
 *      NMI is fired on control flow at the vblank poll, so the candidate's missing cycles cannot
 *      shift it and there is nothing to charge back. Asserts the dispatch count is non-zero and
 *      identical on both sides.
 *      COVERAGE: attract only. Gameplay is not exercised live, and no other board exists for this
 *      cluster — the walk at ROM 0x1F72 returns at once unless BOARD is 1.
 *   4. EQUAL (crafted) — the entry shapes attract never delivers: the clearance boundary and either
 *      side of it, the byte wrap near the top of the screen, four kind values on a geometry that
 *      would otherwise not turn, Mario at both extremes of a byte, and a nudged record base. Each
 *      is a REAL captured state with one surgical poke applied identically to both sides.
 *   5. OBSERVED EFFECT (oracle only, not an equivalence check) — runs the ORACLE in plain attract
 *      and watches what happens to each record's horizontal step and launch speed across the
 *      dispatch. This is what the routine's role line rests on: three reads and a jump can say
 *      which tail runs, never what a tail does. Over 12000 frames, all 68 dispatches:
 *        the two turn paths (64) — the horizontal step goes -96 -> +256, or +96 -> -256, in
 *                                  1/256 px per frame: reversed, and set to exactly one whole pixel.
 *        the no-turn path (4)    — the step is left exactly as it was, +96 -> +96.
 *      The launch speed is replaced on all 68. A turn path that had left the step alone, or a
 *      no-turn path that had changed it, would have killed the role line.
 *      WHERE THE NO-TURN ARM FIRES: all 4 of its dispatches land on the lowest object rows the
 *      routine is reached at (235 and 236, against 104/137/170/203 for the rest), with Mario above
 *      the object every time — so what that arm is FOR is observed, not explained.
 *   6. TEETH — seven broken twins, plus a live-wired twin proving the LIVE arm is not inert. The
 *      test reports which twins the captured replay catches and which only a crafted entry reaches.
 *
 * THE ENTROPY PIN IS DELIBERATELY NOT INSTALLED. Pinned, attract dispatches 0x20A2 zero times in
 * 4000 frames; the routine is only reached on the unpinned RNG. Test 0 asserts the unpinned count,
 * so this cannot quietly become a zero-dispatch gate.
 *
 * ON RE-ENTRY. This routine's tail runs the rest of the object walk, which dispatches 0x20A2 again
 * for later slots, and a clone carries the source machine's override map. A single re-entry guard
 * makes the nested dispatches plain oracle delegates on BOTH sides, so each comparison is exactly
 * one candidate dispatch with the oracle underneath it.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-20a2.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_20a2 as oracle } from "../../translated/loc_20a2.js";
import { loc_20a2 } from "../loc_20a2.js";
import { Machine } from "../../machine.js";
import manifest from "../../manifest.js";
import { runCycleFree } from "../../../../core/frame-stepped.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { u8, u16 } from "../../../../core/int.js";
import { MARIO_Y, OBJ_X, OBJ_Y, STACK_SCRATCH } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x20a2;
const TURN_TAIL = 0x20b5; // ROM 0x20B5 — reverse the horizontal step, then on into the bounce
const BOUNCE_TAIL = 0x20c3; // ROM 0x20C3 — the bounce, entered directly

// Mirrored from the routine under test.
const OBJ_KIND = 0x15;
const CLEARANCE_BELOW_MARIO = 22;

// The record fields the OBSERVED EFFECT test watches: the big-endian 16-bit horizontal step, and
// the big-endian 16-bit launch speed the bounce tail rewrites.
const STEP_X_WHOLE = 0x10;
const STEP_X_FRACTION = 0x11;
const LAUNCH_SPEED_WHOLE = 0x12;
const LAUNCH_SPEED_FRACTION = 0x13;

const { pollPCs } = manifest.convergence;
const ATTRACT_FRAMES = 12000;
const LIVE_FRAMES = 12000;

const hx = (v) => "0x" + (v & 0xffff).toString(16);
const s16 = (v) => (v > 32767 ? v - 65536 : v);
const inStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;

// ── the comparison ───────────────────────────────────────────────────────────

/**
 * Run `fn` on `m` while recording every memory write in order and every routine dispatched through
 * the registry, and catching a fault so it can be compared rather than thrown.
 */
function runInstrumented(m, fn) {
  const writes = [];
  const calls = [];
  const baseWrite = m.mem.write8.bind(m.mem);
  const baseCall = m.call.bind(m);
  m.mem.write8 = (addr, value) => {
    writes.push(`${addr & 0xffff}:${value & 0xff}`);
    return baseWrite(addr, value);
  };
  m.call = (addr, ...rest) => {
    calls.push(addr);
    return baseCall(addr, ...rest);
  };
  let ret = null;
  let threw = null;
  try {
    ret = fn(m);
  } catch (e) {
    threw = `${e.name}: ${e.message}`;
  }
  m.mem.write8 = baseWrite;
  m.call = baseCall;
  return { writes, calls, ret, threw };
}

/** The whole dumped state as bytes; `skipStack` drops the dead scratch window. */
function firstStateDiff(a, b, { skipStack = false } = {}) {
  const da = a.dumpState();
  const db = b.dumpState();
  const n = Math.min(da.length, db.length);
  for (let i = 0; i < n; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (skipStack && inStack(addr)) continue;
    return { addr, a: da[i], b: db[i] };
  }
  return null;
}

/** The whole register file as a comparable string, SP included. */
const regSnapshot = (m) => REG_FIELDS.map((k) => `${k}=${m.regs[k]}`).join(" ");

/** First index at which two ordered write sequences differ, or null. */
function firstWriteDiff(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return { i, a: a[i], b: b[i] };
  if (a.length !== b.length) return { i: n, a: a[n] ?? "(end)", b: b[n] ?? "(end)" };
  return null;
}

/**
 * Replay one entry state both ways on byte-identical clones and report the whole contract. The arm
 * label comes from the ORACLE's first outgoing jump target — never from the candidate — so nothing
 * that keys on it can be steered by a wrong rewrite.
 */
function comparePair(entry, fn) {
  const o = entry.clone();
  const c = entry.clone();

  const ro = guarded(() => runInstrumented(o, oracle));
  const rc = guarded(() => runInstrumented(c, fn));

  const bothRan = ro.threw === null && rc.threw === null;
  return {
    arm: ro.calls[0] ?? null,
    state: bothRan ? firstStateDiff(o, c) : null,
    writeDiff: bothRan ? firstWriteDiff(ro.writes, rc.writes) : null,
    regsO: ro.threw === null ? regSnapshot(o) : null,
    regsC: rc.threw === null ? regSnapshot(c) : null,
    retO: ro.ret,
    retC: rc.ret,
    threwO: ro.threw,
    threwC: rc.threw,
    oracleMachine: o,
  };
}

const mismatched = (r) =>
  r.threwO !== r.threwC ||
  r.state !== null ||
  r.writeDiff !== null ||
  r.regsO !== r.regsC ||
  r.retO !== r.retC;

const describeMismatch = (r) =>
  r.threwO !== r.threwC ? `fault differs: oracle=${r.threwO ?? "(none)"} cand=${r.threwC ?? "(none)"}`
    : r.state ? `state@${hx(r.state.addr)} oracle=${r.state.a} cand=${r.state.b}`
      : r.writeDiff ? `write #${r.writeDiff.i} (addr:value) oracle=${r.writeDiff.a} cand=${r.writeDiff.b}`
        : r.regsO !== r.regsC ? `exit registers differ:\n    oracle=${r.regsO}\n    cand  =${r.regsC}`
          : `return oracle=${r.retO} cand=${r.retC}`;

// ── the attract sweep: capture and replay INLINE, at every dispatch ──────────

/**
 * The re-entry guard. The frozen tail runs the rest of the object walk, so replaying a dispatch on a
 * clone dispatches 0x20A2 again for later slots; a clone carries the override map, so those land
 * back on the hook. While it is set the hook is a plain oracle delegate, which is exactly the
 * isolation the unit comparison wants — one candidate dispatch, oracle underneath on both sides.
 */
let REPLAYING = false;

function attractSweep(frames) {
  const kept = [];
  const results = [];
  let total = 0;
  const hook = (mm) => {
    if (!REPLAYING) {
      REPLAYING = true;
      try {
        total += 1;
        const entry = mm.clone();
        kept.push(entry);
        // INLINE replay, at the dispatch: two fresh clones, both sides run, compare, discard.
        results.push({ base: mm.regs.ix, ...comparePair(entry, loc_20a2) });
      } finally {
        REPLAYING = false;
      }
    }
    return oracle(mm);
  };
  const m = new Machine(ROM, { overrides: new Map([[TARGET, hook]]) });
  const rt = runCycleFree(m, { pollPCs, maxFrames: frames, stepBudget: frames * 200000 });
  return { kept, results, total, rt };
}

/** Run a thunk and turn a fault into a comparable result rather than letting it kill the gate. */
function guarded(thunk) {
  try {
    return thunk();
  } catch (e) {
    return { writes: [], calls: [], ret: null, threw: `${e.name}: ${e.message}` };
  }
}

let SWEEP = null;
const sweep = () => (SWEEP ??= attractSweep(ATTRACT_FRAMES));

const ARM_NAME = (t) => (t === TURN_TAIL ? "turn" : t === BOUNCE_TAIL ? "no-turn" : `unexpected ${hx(t)}`);

/**
 * The PATH label. There are three code paths and only two jump targets, so the oracle's target is
 * not enough on its own; the second half is the record's kind index, read out of the ENTRY state.
 * Neither half comes from the candidate.
 */
const ALTERNATE_KIND_TURN = "turn (alternate kind)";
const COMPARE_TURN = "turn (compare)";
const NO_TURN = "no-turn";

function pathOf(entry, arm) {
  const kind = entry.mem.read8(u16(entry.regs.ix + OBJ_KIND));
  if (arm === TURN_TAIL) return kind !== 0 ? ALTERNATE_KIND_TURN : COMPARE_TURN;
  if (arm === BOUNCE_TAIL) {
    // A cross-check, not a restatement: the no-turn target is unreachable with a non-zero kind
    // index, so the oracle taking it while the entry carries one would mean the label is wrong.
    assert.equal(kind, 0, `the oracle jumped to the bounce tail with kind index ${kind}`);
    return NO_TURN;
  }
  assert.fail(`unexpected jump target ${hx(arm)}`);
}

const tally = (labels) => {
  const t = new Map();
  for (const l of labels) t.set(l, (t.get(l) ?? 0) + 1);
  return t;
};
const showTally = (t) => [...t].map(([l, n]) => `${l} x${n}`).join(", ");

// -- 0. REACHABILITY ----------------------------------------------------------

test("REACHABILITY: attract dispatches 0x20a2 on all three paths, and every dispatch is kept", () => {
  const { kept, results, total, rt } = sweep();
  assert.equal(rt.stopError, null, `the attract run errored: ${rt.stop}`);
  assert.ok(total > 0, "0x20a2 was never dispatched — a gate built on this proves nothing");
  assert.equal(kept.length, total, "every dispatch must be kept — this gate replays all of them");

  const paths = tally(results.map((r, i) => pathOf(kept[i], r.arm)));
  const bases = new Set(results.map((r) => r.base));

  for (const p of [ALTERNATE_KIND_TURN, COMPARE_TURN, NO_TURN]) {
    assert.ok(paths.get(p) > 0, `attract never took the "${p}" path`);
  }
  assert.ok(bases.size > 1, "the dispatches must span more than one record base");

  // The routine header names the object rows attract arrives on, and states that the byte wrap
  // near the top of the screen is out of their reach. This is that claim's producing line.
  const rows = [...new Set(kept.map((e) => e.mem.read8(u16(e.regs.ix + OBJ_Y))))].sort((p, q) => p - q);
  assert.deepEqual(rows, [104, 137, 170, 203, 235, 236], "the OBJ_Y rows attract delivers here have changed");
  assert.ok(rows[0] > CLEARANCE_BELOW_MARIO, "attract now reaches the byte wrap the crafted cases exist for");

  console.log(
    `  REACHABILITY: ${total} dispatches in ${ATTRACT_FRAMES} attract frames, all ${kept.length} kept; ` +
      `${showTally(paths)}; ${bases.size} record bases: ${[...bases].map(hx).join(",")}; ` +
      `OBJ_Y rows ${rows.join(",")}`,
  );
});

// -- 1. EQUAL (captured) ------------------------------------------------------

test("EQUAL (captured): loc_20a2 == oracle on every real dispatch, replayed inline", () => {
  const { results, total } = sweep();
  assert.ok(results.length > 0, "no dispatch to compare");
  for (const r of results) {
    assert.ok(!mismatched(r), `dispatch at record ${hx(r.base)} (${ARM_NAME(r.arm)} arm): ${describeMismatch(r)}`);
  }
  console.log(
    `  EQUAL/captured: ${results.length} of ${total} dispatches replayed inline (all of them) — identical ` +
      "on the full state INCLUDING STACK_SCRATCH, the whole write sequence, the exit register file and the return",
  );
});

// -- 2. CYCLES ----------------------------------------------------------------

test("CYCLES: the cycle difference is PER-PATH, which is why the LIVE run is cycle-free", () => {
  const { kept } = sweep();
  const deltas = new Map();
  REPLAYING = true;
  try {
    for (const entry of kept) {
      const o = entry.clone();
      const before0 = o.cycles;
      const calls = [];
      const baseCall = o.call.bind(o);
      o.call = (addr, ...rest) => { calls.push(addr); return baseCall(addr, ...rest); };
      oracle(o);
      const c = entry.clone();
      const before1 = c.cycles;
      loc_20a2(c);
      const path = pathOf(entry, calls[0]);
      const d = (o.cycles - before0) - (c.cycles - before1);
      if (!deltas.has(path)) deltas.set(path, new Set());
      deltas.get(path).add(d);
    }
  } finally {
    REPLAYING = false;
  }
  for (const [path, set] of deltas) {
    assert.equal(set.size, 1, `the "${path}" path's cycle delta is not constant: ${[...set].join(",")}`);
  }
  assert.equal(deltas.size, 3, "expected all three paths among the captures");
  const shown = [...deltas].map(([p, s]) => `${p} ${[...s][0]}`);
  assert.equal(new Set(shown.map((s) => s.split(" ").pop())).size, 3, "the three paths were expected to cost differently");
  console.log(
    `  CYCLES: ${shown.join(", ")} — three paths, three constants, so the LIVE run fires the NMI on ` +
      "control flow instead of charging one of them back",
  );
});

// -- 3. LIVE (whole attract) --------------------------------------------------

/**
 * One cycle-free attract run with `body` behind the override at 0x20A2. The BASELINE passes the
 * oracle as `body`, so the two runs are the same machine, the same seam and the same engine and
 * differ in exactly one thing: the function that runs at the dispatch.
 */
function liveRun(body, frames = LIVE_FRAMES) {
  const trace = [];
  let calls = 0;
  const ov = new Map([[TARGET, (mm) => {
    calls += 1;
    return body(mm);
  }]]);
  const m = new Machine(ROM, { overrides: ov });
  const rt = runCycleFree(m, {
    pollPCs,
    maxFrames: frames,
    stepBudget: frames * 200000,
    onFrame: (mm) => trace.push(Buffer.from(mm.dumpState())),
  });
  return { trace, calls, rt, addrOf: Array.from(m.dumpState(), (_, i) => m.stateOffsetToAddr(i)) };
}

let LIVE_BASELINE = null;
const liveBaseline = () => (LIVE_BASELINE ??= liveRun((mm) => oracle(mm)));

/** First (frame, address) at which two traces differ. */
function firstTraceDiff(a, b, addrOf) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const A = a[i];
    const B = b[i];
    for (let j = 0; j < A.length; j++) if (A[j] !== B[j]) return { frame: i, addr: addrOf[j], a: A[j], b: B[j] };
  }
  return a.length === b.length ? null : { frame: n, addr: null, a: a.length, b: b.length };
}

test("LIVE: wired at 0x20a2 for a whole attract run, the trace is identical to the oracle's", () => {
  const base = liveBaseline();
  assert.equal(base.rt.stopError, null, `the baseline run errored: ${base.rt.stop}`);

  const live = liveRun(loc_20a2);
  assert.equal(live.rt.stopError, null, `the live run errored: ${live.rt.stop}`);

  // THE ASSERTION THAT STOPS THIS ARM BEING VACUOUS: a live run in which the routine never executes
  // compares two identical traces and passes against anything.
  assert.ok(live.calls > 0, "the wired routine was never dispatched — this arm would prove nothing");
  assert.equal(
    live.calls, base.calls,
    `dispatch count moved (${base.calls} -> ${live.calls}) — the runs forked before the trace diff saw it`,
  );
  assert.equal(live.trace.length, base.trace.length, "the two runs did not reach the same frame count");

  const diff = firstTraceDiff(base.trace, live.trace, live.addrOf);
  assert.equal(
    diff, null,
    diff && `live attract diverged at frame ${diff.frame}, ${hx(diff.addr ?? 0)}: oracle=${diff.a} cand=${diff.b}`,
  );
  console.log(
    `  LIVE: ${live.calls} dispatches over ${LIVE_FRAMES} attract frames under the cycle-free engine — ` +
      "the whole per-frame state byte-identical to the oracle baseline, STACK_SCRATCH included",
  );
});

// -- 4. EQUAL (crafted) -------------------------------------------------------

/** Poke one real captured state; every poke is applied BEFORE the clone, so both sides see it. */
function craft(entry, { kind, objY, marioY, base } = {}) {
  const e = entry.clone();
  if (base !== undefined) e.regs.ix = base;
  const rec = e.regs.ix;
  if (kind !== undefined) e.mem.write8(u16(rec + OBJ_KIND), kind);
  if (objY !== undefined) e.mem.write8(u16(rec + OBJ_Y), objY);
  if (marioY !== undefined) e.mem.write8(MARIO_Y, marioY);
  return e;
}

function craftedEntries() {
  const { kept } = sweep();
  const entry = kept[0];
  const list = [];
  const M = 120; // a fixed Mario row, so each case's arm is stated by construction

  // The clearance boundary and either side of it: the compare is >=, on a byte.
  list.push({ name: "exactly at the clearance boundary", entry: craft(entry, { kind: 0, marioY: M, objY: M + CLEARANCE_BELOW_MARIO }) });
  list.push({ name: "one pixel above the boundary", entry: craft(entry, { kind: 0, marioY: M, objY: M + CLEARANCE_BELOW_MARIO - 1 }) });
  list.push({ name: "one pixel below the boundary", entry: craft(entry, { kind: 0, marioY: M, objY: M + CLEARANCE_BELOW_MARIO + 1 }) });

  // The byte wrap near the top of the screen — attract's lowest OBJ_Y here is far below it.
  for (const objY of [0, 1, 10, CLEARANCE_BELOW_MARIO - 1, CLEARANCE_BELOW_MARIO, CLEARANCE_BELOW_MARIO + 1]) {
    list.push({ name: `object at row ${objY}, Mario at ${M}`, entry: craft(entry, { kind: 0, marioY: M, objY }) });
  }

  // Mario at the extremes of a byte.
  list.push({ name: "Mario at row 0", entry: craft(entry, { kind: 0, marioY: 0, objY: 104 }) });
  list.push({ name: "Mario at row 255", entry: craft(entry, { kind: 0, marioY: 255, objY: 240 }) });

  // Kind values attract never delivers, each on a Y that would otherwise take the no-turn arm — so
  // a rewrite that dropped the kind test would be answering a different question here.
  for (const kind of [1, 2, 0x80, 0xff]) {
    list.push({ name: `kind ${hx(kind)} on a no-turn geometry`, entry: craft(entry, { kind, marioY: M, objY: M + 60 }) });
  }
  list.push({ name: "kind 0 on the same no-turn geometry", entry: craft(entry, { kind: 0, marioY: M, objY: M + 60 }) });

  // Record-relativity: the reads must follow the pointer, not a fixed address.
  const other = u16(entry.regs.ix + 0x20);
  list.push({ name: `nudged record base ${hx(other)}, turn geometry`, entry: craft(entry, { base: other, kind: 0, marioY: 200, objY: 104 }) });
  list.push({ name: `nudged record base ${hx(other)}, no-turn geometry`, entry: craft(entry, { base: other, kind: 0, marioY: 100, objY: 200 }) });
  return list;
}

let CRAFTED = null;
const crafted = () => (CRAFTED ??= craftedEntries());

test("EQUAL (crafted): the entry shapes attract never delivers match the oracle", () => {
  REPLAYING = true;
  try {
    const labels = [];
    for (const { name, entry } of crafted()) {
      const r = comparePair(entry, loc_20a2);
      assert.ok(!mismatched(r), `${name}: ${describeMismatch(r)}`);
      labels.push(pathOf(entry, r.arm));
    }
    // Non-vacuity: the crafted set must straddle all three paths, or it is testing one of them twice.
    const paths = tally(labels);
    for (const p of [ALTERNATE_KIND_TURN, COMPARE_TURN, NO_TURN]) {
      assert.ok(paths.get(p) > 0, `no crafted entry reaches the "${p}" path`);
    }
    console.log(`  EQUAL/crafted: ${crafted().length} crafted entries — ${showTally(paths)}`);
  } finally {
    REPLAYING = false;
  }
});

// -- 5. OBSERVED EFFECT (oracle only) -----------------------------------------

test("OBSERVED EFFECT (oracle only, not an equivalence check): the turn arms reverse the record's horizontal step and the no-turn arm leaves it alone", () => {
  // The prediction the routine header's role line makes, checked on the real ROM in a plain attract
  // run against the record bytes the tails write. It runs the ORACLE, so breaking the candidate
  // cannot make it pass or fail — it is grounding for the header, not a gate on the rewrite.
  const seen = [];
  const ov = new Map([[TARGET, (mm) => {
    const rec = mm.regs.ix;
    const rd = (d) => mm.mem.read8(u16(rec + d));
    const stepBefore = s16((rd(STEP_X_WHOLE) << 8) | rd(STEP_X_FRACTION));
    const speedBefore = s16((rd(LAUNCH_SPEED_WHOLE) << 8) | rd(LAUNCH_SPEED_FRACTION));
    const kind = rd(OBJ_KIND);
    const objY = rd(OBJ_Y);
    const marioY = mm.mem.read8(MARIO_Y);
    const out = oracle(mm);
    seen.push({
      kind, objY, marioY,
      stepBefore, stepAfter: s16((rd(STEP_X_WHOLE) << 8) | rd(STEP_X_FRACTION)),
      speedBefore, speedAfter: s16((rd(LAUNCH_SPEED_WHOLE) << 8) | rd(LAUNCH_SPEED_FRACTION)),
    });
    return out;
  }]]);
  const m = new Machine(ROM, { overrides: ov });
  const rt = runCycleFree(m, { pollPCs, maxFrames: ATTRACT_FRAMES, stepBudget: ATTRACT_FRAMES * 200000 });
  assert.equal(rt.stopError, null, `the observation run errored: ${rt.stop}`);
  assert.ok(seen.length > 0, "nothing was observed");

  // "no-turn" is stated in the terms of the ROM's own test, not the candidate's code path.
  const noTurn = seen.filter((e) => e.kind === 0 && u8(e.objY - CLEARANCE_BELOW_MARIO) >= e.marioY);
  const turn = seen.filter((e) => !(e.kind === 0 && u8(e.objY - CLEARANCE_BELOW_MARIO) >= e.marioY));
  assert.ok(noTurn.length > 0 && turn.length > 0, "attract did not produce both outcomes to observe");

  for (const e of turn) {
    assert.equal(Math.abs(e.stepAfter), 256, `a turn dispatch left a step of ${e.stepAfter}, not one whole pixel`);
    assert.ok(Math.sign(e.stepAfter) !== Math.sign(e.stepBefore), `a turn dispatch did not reverse ${e.stepBefore}`);
  }
  for (const e of noTurn) {
    assert.equal(e.stepAfter, e.stepBefore, "a no-turn dispatch changed the horizontal step");
  }
  for (const e of seen) {
    assert.notEqual(e.speedAfter, e.speedBefore, "the launch speed was expected to be replaced on every arm");
  }

  // The routine header says the no-turn arm fires in attract only on the lowest rows this routine
  // is reached at, with Mario above the object. This is that claim's producing line — the threshold
  // is derived from the observed rows, not written in.
  const rows = [...new Set(seen.map((e) => e.objY))].sort((p, q) => p - q);
  const lowestRows = rows.filter((r) => r >= rows[rows.length - 1] - 1);
  for (const e of noTurn) {
    assert.ok(lowestRows.includes(e.objY), `a no-turn dispatch fired at row ${e.objY}, not on the lowest rows`);
    assert.ok(e.marioY < e.objY, `a no-turn dispatch fired with Mario at ${e.marioY}, below the object at ${e.objY}`);
  }

  const shape = (xs) => [...new Set(xs.map((e) => `${e.stepBefore}->${e.stepAfter}`))].join(" ");
  console.log(
    `  OBSERVED EFFECT: ${turn.length} turn dispatches (${shape(turn)}), ` +
      `${noTurn.length} no-turn (${shape(noTurn)}); launch speed replaced on all ${seen.length}; ` +
      `no-turn rows ${[...new Set(noTurn.map((e) => e.objY))].sort((p, q) => p - q).join(",")} ` +
      `of ${rows.join(",")}, Mario above the object on every one`,
  );
});

// -- 6. TEETH -----------------------------------------------------------------

/** Broken twin: always turn — the clearance compare is ignored. */
function twinAlwaysTurn(m) {
  return m.call(TURN_TAIL);
}

/** Broken twin: never turn — every arm goes straight to the bounce. */
function twinNeverTurn(m) {
  return m.call(BOUNCE_TAIL);
}

/** Broken twin: the kind index is not consulted, so an alternate-kind object is put to the compare. */
function twinIgnoreKind(m) {
  const { mem8 } = m;
  const record = m.regs.ix;
  if (u8(mem8[u16(record + OBJ_Y)] - CLEARANCE_BELOW_MARIO) >= mem8[MARIO_Y]) return m.call(BOUNCE_TAIL);
  return m.call(TURN_TAIL);
}

/** Broken twin: the compare excludes its boundary. */
function twinStrictCompare(m) {
  const { mem8 } = m;
  const record = m.regs.ix;
  if (mem8[u16(record + OBJ_KIND)] !== 0) return m.call(TURN_TAIL);
  if (u8(mem8[u16(record + OBJ_Y)] - CLEARANCE_BELOW_MARIO) > mem8[MARIO_Y]) return m.call(BOUNCE_TAIL);
  return m.call(TURN_TAIL);
}

/** Broken twin: the clearance is subtracted as a signed number, so it never wraps. */
function twinNoWrap(m) {
  const { mem8 } = m;
  const record = m.regs.ix;
  if (mem8[u16(record + OBJ_KIND)] !== 0) return m.call(TURN_TAIL);
  if (mem8[u16(record + OBJ_Y)] - CLEARANCE_BELOW_MARIO >= mem8[MARIO_Y]) return m.call(BOUNCE_TAIL);
  return m.call(TURN_TAIL);
}

/** Broken twin: compares against Mario's horizontal position instead of his vertical one. */
function twinWrongMarioCell(m) {
  const { mem8 } = m;
  const record = m.regs.ix;
  if (mem8[u16(record + OBJ_KIND)] !== 0) return m.call(TURN_TAIL);
  if (u8(mem8[u16(record + OBJ_Y)] - CLEARANCE_BELOW_MARIO) >= mem8[0x6203]) return m.call(BOUNCE_TAIL);
  return m.call(TURN_TAIL);
}

/** Broken twin: reads the first record of the array instead of the one the walk is on. */
function twinFixedRecord(m) {
  const { mem8 } = m;
  const record = 0x6700;
  if (mem8[u16(record + OBJ_KIND)] !== 0) return m.call(TURN_TAIL);
  if (u8(mem8[u16(record + OBJ_Y)] - CLEARANCE_BELOW_MARIO) >= mem8[MARIO_Y]) return m.call(BOUNCE_TAIL);
  return m.call(TURN_TAIL);
}

const TEETH = [
  { name: "always turn", twin: twinAlwaysTurn },
  { name: "never turn", twin: twinNeverTurn },
  { name: "kind index ignored", twin: twinIgnoreKind },
  { name: "compare excludes its boundary", twin: twinStrictCompare },
  { name: "clearance subtracted without the byte wrap", twin: twinNoWrap },
  { name: "compares against Mario's other coordinate", twin: twinWrongMarioCell },
  { name: "reads a fixed record instead of the walk's", twin: twinFixedRecord },
];

for (const { name, twin } of TEETH) {
  test(`TEETH: a twin that ${name} is CAUGHT`, () => {
    REPLAYING = true;
    try {
      const { kept } = sweep();
      const capturedHits = kept.filter((e) => mismatched(comparePair(e, twin))).length;
      const craftedHits = crafted().filter((c) => mismatched(comparePair(c.entry, twin))).length;
      assert.ok(
        capturedHits + craftedHits > 0,
        `the gate FAILED to catch the "${name}" twin on any of ${kept.length} captured or ` +
          `${crafted().length} crafted entries — it proves nothing`,
      );
      const half = capturedHits > 0 ? (craftedHits > 0 ? "captured AND crafted" : "captured only") : "crafted only";
      console.log(
        `  TEETH/${name}: caught on ${capturedHits}/${kept.length} captured and ` +
          `${craftedHits}/${crafted().length} crafted — ${half}`,
      );
    } finally {
      REPLAYING = false;
    }
  });
}

test("LIVE TEETH: a broken twin wired live for the whole attract run DOES diverge", () => {
  // Without this the LIVE arm's green is unfalsifiable: it would look the same whether the
  // comparison has teeth or the routine simply never runs.
  const base = liveBaseline();
  const broken = liveRun(twinNeverTurn);
  const diff = broken.rt.stopError
    ? { frame: -1, addr: null, a: broken.rt.stop, b: "(faulted)" }
    : firstTraceDiff(base.trace, broken.trace, base.addrOf);
  assert.notEqual(
    diff, null,
    "a twin that never turns was expected to move the live attract trace and did not — the LIVE arm " +
      "is not measuring what it claims to",
  );
  console.log(
    `  LIVE TEETH: the "never turn" twin diverges ` +
      (diff.frame === -1 ? `by faulting: ${diff.a}` : `at frame ${diff.frame}, ${hx(diff.addr ?? 0)} ` +
        `(baseline=${diff.a} twin=${diff.b})`),
  );
});
