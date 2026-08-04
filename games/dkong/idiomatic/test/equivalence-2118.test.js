// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for loc_2118 (ROM 0x2118).
 *
 * WHAT THIS ROUTINE MAKES AWKWARD, and how the harness answers it. ROM 0x2118 ends in a `jp`
 * tail on BOTH arms, into ROM 0x2146 and ROM 0x2153 — two routines that are still frozen and
 * whose chain runs the rest of the object sweep and can come back round to ROM 0x2118 itself
 * (0x2153 -> 0x21BA -> 0x1F8D -> the sweep's loop advance). Replaying the oracle from a captured
 * entry would therefore run thousands of instructions, drown this routine's eight stores in the
 * tail's writes, and — because Machine.clone() rebuilds from the source machine's assets and so
 * carries the capturing override with it — let the hook fire again underneath the replay.
 *
 * So the harness does two things. Every entry is REHOSTED into a fresh Machine built with no
 * overrides at all, which cannot re-enter the hook; and both tails are STUBBED on that fresh
 * machine, so what is compared is exactly this routine's own head, at the hand-off. The stub is
 * installed on the machine that actually runs (never inherited through a clone) and its liveness
 * is asserted, not assumed: a replay in which the oracle did not reach the stub exactly once is
 * reported as a breach rather than passing quietly.
 *
 * COVERAGE — ATTRACT ONLY. A hook at 0x2118 replays INLINE at every real dispatch of a
 * 12000-frame attract run; nothing is captured for later and nothing is sampled. The count is
 * cross-checked against a separate pure-oracle counting run, so a replay loop that silently
 * stopped early cannot read as coverage. No gameplay is entered. Each real entry is also
 * replayed under 9 CRAFTED variants poked onto that same real entry (never built from scratch):
 * the exact 223/224 split boundary, which no natural dispatch lands on, and five sprite-code
 * patterns for the low-two-bit mask. The crafted variants also pre-pattern the eight written
 * fields with distinct values, so a MISSING store shows as well as a spurious one.
 *
 * CONTRACT — the ordered write sequence, the full 5120-byte state dump INCLUDING STACK_SCRATCH,
 * the registers at the hand-off, the guest stack pointer, and the return value. The stack is
 * compared rather than excluded because this rewrite keeps the oracle's bracket shape exactly: a
 * `jp` tail pushes no return address on either side. That exclusion would be INERT here, and the
 * gate asserts the inertness explicitly (neither side writes into STACK_SCRATCH) instead of
 * leaving it as an unexamined habit — which is also what gives the spurious-push twin its teeth.
 * EXCLUDED, with the reason: `pc` and the cycle count (the rewrite is cycle-free and sets
 * neither), the flag register on both arms, and the accumulator on the below-224 arm — those
 * three are dead into the frozen tails, measured by poisoning them at the seam over a
 * 4000-frame attract run against a control that does diverge.
 *
 * Checks: EQUAL over every real dispatch and every crafted variant; SEVEN broken twins, each
 * pinned to the single check that can see it, with the split-boundary twin additionally shown to
 * ESCAPE every natural entry so the crafted half is documented rather than assumed; and a
 * whole-attract run with the routine wired live, asserting a non-zero dispatch count equal to the
 * independent count and a byte-identical frame trace.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-2118.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { Machine } from "../../machine.js";
import { loc_2118 as oracle } from "../../translated/loc_2118.js";
import { loc_2118 } from "../loc_2118.js";
import { OBJ_SPRITE_CODE, OBJ_Y, STACK_SCRATCH } from "../names.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/dkong/rom/maincpu.bin" }, fn);

const ATTRACT_FRAMES = 12000;

/** The two still-frozen tails ROM 0x2118 hands to, one per arm. */
const TAIL_BELOW = 0x2146;
const TAIL_AT_OR_ABOVE = 0x2153;
const TAILS = [TAIL_BELOW, TAIL_AT_OR_ABOVE];

/** A value no real tail returns, so a rewrite that forgets to propagate the tail is visible. */
const STUB_RETURN = 0x51180000;

const hx = (v) => "0x" + (v >>> 0).toString(16);

// -- rehosting, stubbing, and the per-replay instrumentation --------------------------------

/**
 * The source machine's observable state on a FRESH Machine built with no overrides.
 *
 * Machine.clone() would be wrong here: it reruns the constructor with the source's assets, so it
 * carries this file's capturing hook into every replay, where this routine's own tail chain can
 * re-enter it. A fresh machine has no override map and no call-bracket seam, so a replay is
 * hermetic. Copies exactly what clone() copies, and neutralises the frame machinery the same way
 * so that running one routine cannot trip a frame sample or fire an NMI.
 */
function rehost(m) {
  const c = new Machine(ROM);
  c.mem.workRam.set(m.mem.workRam);
  c.mem.spriteRam.set(m.mem.spriteRam);
  c.mem.videoRam.set(m.mem.videoRam);
  c.mem.discardedWrites = m.mem.discardedWrites;
  c.regs.copyFrom(m.regs);
  c.io.loadStateFrom(m.io);
  c.cycles = m.cycles;
  c.pc = m.pc;
  c.pcKnown = m.pcKnown;
  c.frame = m.frame;
  c.nmiCount = m.nmiCount;
  c.booted = m.booted;
  c.nextBoundary = Infinity;
  c.nextNmi = Infinity;
  c.maxFrames = Infinity;
  c.maxCycles = Infinity;
  return c;
}

const REG_KEYS = [
  "a", "f", "b", "c", "d", "e", "h", "l", "ix", "iy", "sp",
  "a_", "f_", "b_", "c_", "d_", "e_", "h_", "l_",
];
const snapRegs = (r) => Object.fromEntries(REG_KEYS.map((k) => [k, r[k]]));

/**
 * Stub both tails on ONE machine and record every byte written and every hand-off.
 *
 * `routines.set` is used deliberately rather than the constructor's override map: it installs the
 * stub without the call-bracket seam wrapping it, which is what a bare `jp` tail dispatch means.
 * The write hook goes on `mem.write8`, which both sides reach — the oracle calls it directly and
 * the rewrite's `mem8` view forwards to it per access.
 */
function instrument(m) {
  const log = { writes: [], handoffs: [] };
  const baseWrite = m.mem.write8.bind(m.mem);
  m.mem.write8 = (addr, value) => {
    log.writes.push([addr & 0xffff, value & 0xff]);
    return baseWrite(addr, value);
  };
  for (const tail of TAILS) {
    m.routines.set(tail, (mm) => {
      log.handoffs.push({ tail, sp: mm.regs.sp, regs: snapRegs(mm.regs) });
      return STUB_RETURN + tail;
    });
  }
  return log;
}

/** First differing state byte, with a flag for whether it lies in the excluded stack window. */
function stateDiff(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  for (let i = 0; i < da.length; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    return { addr, inStack: addr >= STACK_SCRATCH.lo && addr < STACK_SCRATCH.hi, a: da[i], b: db[i] };
  }
  return null;
}

const seqOf = (writes) => writes.map(([addr, value]) => `${hx(addr)}=${value}`).join(",");

/**
 * Replay ONE entry both ways on two independently rehosted, tail-stubbed machines and report the
 * first contract breach. `poke` (optional) is applied identically to both sides before either
 * runs, which is how a crafted arm is produced without leaving the real entry behind. A fault is
 * a RESULT, not a crash: a twin that walks off a table throws, and that must be reported rather
 * than killing the run.
 */
function contractBreach(entry, candidate, poke) {
  const a = rehost(entry);
  const b = rehost(entry);
  if (poke) {
    poke(a);
    poke(b);
  }
  const la = instrument(a);
  const lb = instrument(b);

  let ra, rb;
  try {
    ra = oracle(a);
  } catch (e) {
    ra = `FAULT ${e.message}`;
  }
  try {
    rb = candidate(b);
  } catch (e) {
    rb = `FAULT ${e.message}`;
  }

  // The stub must be observably live on the oracle side, or this replay proves nothing.
  if (la.handoffs.length !== 1) {
    return { kind: "harness", detail: `the oracle reached a stubbed tail ${la.handoffs.length} times, expected 1` };
  }
  if (lb.handoffs.length !== la.handoffs.length) {
    return { kind: "handoff-count", detail: `oracle=${la.handoffs.length} rewrite=${lb.handoffs.length}` };
  }
  const ha = la.handoffs[0];
  const hb = lb.handoffs[0];
  if (ha.tail !== hb.tail) return { kind: "arm", detail: `oracle=${hx(ha.tail)} rewrite=${hx(hb.tail)}` };

  if (seqOf(la.writes) !== seqOf(lb.writes)) {
    return { kind: "write-sequence", detail: `oracle=[${seqOf(la.writes)}] rewrite=[${seqOf(lb.writes)}]` };
  }

  const ram = stateDiff(a, b);
  if (ram) {
    return {
      kind: ram.inStack ? "ram(STACK_SCRATCH)" : "ram",
      addr: ram.addr,
      detail: `${hx(ram.addr)} oracle=${ram.a} rewrite=${ram.b}`,
    };
  }

  if (ha.sp !== hb.sp) return { kind: "sp", detail: `oracle=${hx(ha.sp)} rewrite=${hx(hb.sp)}` };

  // The flag register is dead into both tails and the accumulator is dead into the below-224
  // one — both measured by poisoning at the seam. Everything else the tails could read is
  // compared, which is what catches a rewrite that clobbers a register it had no business
  // touching.
  const live = REG_KEYS.filter((k) => k !== "f" && !(k === "a" && ha.tail === TAIL_BELOW));
  for (const k of live) {
    if (ha.regs[k] !== hb.regs[k]) {
      return { kind: `handoff reg ${k}`, detail: `oracle=${hx(ha.regs[k])} rewrite=${hx(hb.regs[k])}` };
    }
  }

  if (ra !== rb) return { kind: "return", detail: `oracle=${ra} rewrite=${rb}` };

  return null;
}

/** True when neither side of a clean replay touched the excluded stack window. */
function wroteStack(entry) {
  const a = rehost(entry);
  const la = instrument(a);
  oracle(a);
  return la.writes.some(([addr]) => addr >= STACK_SCRATCH.lo && addr < STACK_SCRATCH.hi);
}

// -- the crafted variants -------------------------------------------------------------------

const setField = (m, offset, value) => m.mem.write8((m.regs.ix + offset) & 0xffff, value);

/** Fill every field this routine writes with a distinct value, so a MISSING store shows too. */
function prePattern(m) {
  const seed = [
    [1, 0x11], [2, 0x22], [14, 0x33], [16, 0x44], [17, 0x55], [18, 0x66], [19, 0x77],
  ];
  for (const [offset, value] of seed) setField(m, offset, value);
}

const craftY = (y) => (m) => {
  prePattern(m);
  setField(m, OBJ_Y, y);
};
const craftYAndCode = (y, code) => (m) => {
  prePattern(m);
  setField(m, OBJ_Y, y);
  setField(m, OBJ_SPRITE_CODE, code);
};

const CRAFTS = [
  { name: "natural", poke: null },
  { name: "y=0", poke: craftY(0) },
  { name: "y=223 (just below the split)", poke: craftY(223) },
  { name: "y=224 (exactly at the split)", poke: craftY(224) },
  { name: "y=255", poke: craftY(255) },
  { name: "y=224 code=0", poke: craftYAndCode(224, 0x00) },
  { name: "y=224 code=3", poke: craftYAndCode(224, 0x03) },
  { name: "y=224 code=170", poke: craftYAndCode(224, 0xaa) },
  { name: "y=224 code=252", poke: craftYAndCode(224, 0xfc) },
  { name: "y=224 code=255", poke: craftYAndCode(224, 0xff) },
];

// -- driving attract ---------------------------------------------------------------------------

/** A pure-oracle attract run that only COUNTS dispatches — the independent cross-check. */
function countDispatches() {
  let dispatches = 0;
  const arms = new Map();
  const bases = new Map();
  const m = new Machine(ROM, {
    overrides: {
      "2118": (mm) => {
        dispatches++;
        const tail = mm.mem.read8((mm.regs.ix + OBJ_Y) & 0xffff) < 224 ? TAIL_BELOW : TAIL_AT_OR_ABOVE;
        arms.set(tail, (arms.get(tail) ?? 0) + 1);
        bases.set(mm.regs.ix, (bases.get(mm.regs.ix) ?? 0) + 1);
        return oracle(mm);
      },
    },
  });
  m.runFrames(ATTRACT_FRAMES);
  return { dispatches, arms, bases };
}

const PROBE = ROM_PRESENT ? countDispatches() : { dispatches: 0, arms: new Map(), bases: new Map() };

/**
 * Replay `candidate` inline at every real dispatch. `crafts` selects which variants run; the host
 * itself always continues on the pure oracle, so the attract run this walks is the same one the
 * counting probe walked.
 */
function replayAll(candidate, crafts = CRAFTS) {
  const breaches = [];
  let dispatches = 0;
  let replays = 0;
  const m = new Machine(ROM, {
    overrides: {
      "2118": (mm) => {
        dispatches++;
        for (const { name, poke } of crafts) {
          replays++;
          const breach = contractBreach(mm, candidate, poke);
          if (breach) breaches.push({ dispatch: dispatches, craft: name, ...breach });
        }
        return oracle(mm);
      },
    },
  });
  m.runFrames(ATTRACT_FRAMES);
  return { dispatches, replays, breaches };
}

const REAL = ROM_PRESENT ? replayAll(loc_2118) : { dispatches: 0, replays: 0, breaches: [] };

// -- 1. EQUAL ----------------------------------------------------------------------------------

test("EQUAL: loc_2118 matches the oracle at every real dispatch and every crafted variant", () => {
  assert.ok(PROBE.dispatches > 0, "attract never dispatched 0x2118 — this gate would prove nothing");
  assert.equal(
    REAL.dispatches,
    PROBE.dispatches,
    "the replaying run saw a different dispatch count from the independent pure-oracle count — " +
      "the hook perturbed the run it was measuring",
  );
  assert.equal(REAL.replays, REAL.dispatches * CRAFTS.length, "not every dispatch ran every crafted variant");
  assert.equal(
    REAL.breaches.length,
    0,
    REAL.breaches.length
      ? `${REAL.breaches.length} breach(es), first: dispatch ${REAL.breaches[0].dispatch} ` +
        `craft "${REAL.breaches[0].craft}" ${REAL.breaches[0].kind} ${REAL.breaches[0].detail}`
      : "",
  );
  const arms = [...PROBE.arms].map(([t, n]) => `${hx(t)}x${n}`).join(" ");
  const bases = [...PROBE.bases].map(([b, n]) => `${hx(b)}x${n}`).join(" ");
  console.log(
    `  EQUAL: ${REAL.dispatches} of ${PROBE.dispatches} real dispatches in ${ATTRACT_FRAMES} attract ` +
      `frames, each replayed as 1 natural + ${CRAFTS.length - 1} crafted entries = ${REAL.replays} ` +
      `replays; arms ${arms}; record bases ${bases}`,
  );
});

test("the STACK_SCRATCH exclusion would be INERT here, so the full dump is compared instead", () => {
  let checked = 0;
  let touched = 0;
  const m = new Machine(ROM, {
    overrides: {
      "2118": (mm) => {
        checked++;
        if (wroteStack(mm)) touched++;
        return oracle(mm);
      },
    },
  });
  m.runFrames(ATTRACT_FRAMES);
  assert.ok(checked > 0, "no dispatch was checked — this assertion would be vacuous");
  assert.equal(touched, 0, `the oracle wrote into STACK_SCRATCH on ${touched} of ${checked} dispatches`);
  console.log(
    `  INERT: neither side writes into [${hx(STACK_SCRATCH.lo)},${hx(STACK_SCRATCH.hi)}) on any of ` +
      `${checked} dispatches, so that window is compared rather than excluded`,
  );
});

// -- 2. TEETH ----------------------------------------------------------------------------------

/** Broken twin: the sprite code keeps its old low two bits instead of being forced to 01. */
function twinNoCodeMask(m) {
  const { mem8 } = m;
  const record = m.regs.ix;
  if (mem8[record + OBJ_Y] < 224) return m.call(TAIL_BELOW);
  mem8[record + OBJ_SPRITE_CODE] = mem8[record + OBJ_SPRITE_CODE] | 0x01;
  return finishAtOrAbove(m, record);
}

/** Broken twin: the low byte of the horizontal velocity is never written. */
function twinDropVelocityLow(m) {
  const { mem8 } = m;
  const record = m.regs.ix;
  if (mem8[record + OBJ_Y] < 224) return m.call(TAIL_BELOW);
  mem8[record + OBJ_SPRITE_CODE] = (mem8[record + OBJ_SPRITE_CODE] & 0xfc) | 0x01;
  mem8[record + 1] = 0;
  mem8[record + 2] = 0;
  mem8[record + 16] = 255;
  mem8[record + 18] = 0;
  mem8[record + 19] = 176;
  mem8[record + 14] = 1;
  m.regs.a = 0;
  return m.call(TAIL_AT_OR_ABOVE);
}

/** Broken twin: the launch speed is stored before the velocity — same bytes, wrong order. */
function twinSwappedStoreOrder(m) {
  const { mem8 } = m;
  const record = m.regs.ix;
  if (mem8[record + OBJ_Y] < 224) return m.call(TAIL_BELOW);
  mem8[record + OBJ_SPRITE_CODE] = (mem8[record + OBJ_SPRITE_CODE] & 0xfc) | 0x01;
  mem8[record + 1] = 0;
  mem8[record + 2] = 0;
  mem8[record + 18] = 0;
  mem8[record + 19] = 176;
  mem8[record + 16] = 255;
  mem8[record + 17] = 0;
  mem8[record + 14] = 1;
  m.regs.a = 0;
  return m.call(TAIL_AT_OR_ABOVE);
}

/** Shared body for the twins that only differ before the stores. */
function finishAtOrAbove(m, record) {
  const { mem8 } = m;
  mem8[record + 1] = 0;
  mem8[record + 2] = 0;
  mem8[record + 16] = 255;
  mem8[record + 17] = 0;
  mem8[record + 18] = 0;
  mem8[record + 19] = 176;
  mem8[record + 14] = 1;
  m.regs.a = 0;
  return m.call(TAIL_AT_OR_ABOVE);
}

/** Broken twin: the accumulator is not zeroed, so the frozen tail stores whatever it finds. */
function twinNoAccumulator(m) {
  const { mem8 } = m;
  const record = m.regs.ix;
  if (mem8[record + OBJ_Y] < 224) return m.call(TAIL_BELOW);
  mem8[record + OBJ_SPRITE_CODE] = (mem8[record + OBJ_SPRITE_CODE] & 0xfc) | 0x01;
  mem8[record + 1] = 0;
  mem8[record + 2] = 0;
  mem8[record + 16] = 255;
  mem8[record + 17] = 0;
  mem8[record + 18] = 0;
  mem8[record + 19] = 176;
  mem8[record + 14] = 1;
  return m.call(TAIL_AT_OR_ABOVE);
}

/** Broken twin: the split is off by one — 224 takes the below arm. */
function twinOffByOneSplit(m) {
  const { mem8 } = m;
  const record = m.regs.ix;
  if (mem8[record + OBJ_Y] <= 224) return m.call(TAIL_BELOW);
  mem8[record + OBJ_SPRITE_CODE] = (mem8[record + OBJ_SPRITE_CODE] & 0xfc) | 0x01;
  return finishAtOrAbove(m, record);
}

/** Broken twin: the tail runs but its result is dropped. */
function twinNoReturn(m) {
  loc_2118(m);
}

/**
 * Broken twin: the guest stack pointer is moved without a store, as a mis-modelled `dec sp` pair
 * would move it. Invisible to RAM, to the write sequence and to the return value; only the stack
 * pointer at the hand-off can see it, which is what makes that comparison load-bearing rather
 * than decorative.
 */
function twinSilentStackShift(m) {
  m.regs.sp = (m.regs.sp - 2) & 0xffff;
  return loc_2118(m);
}

/** Broken twin: a return address is pushed around the tail, which a `jp` never does. */
function twinSpuriousPush(m) {
  const { mem8 } = m;
  const record = m.regs.ix;
  if (mem8[record + OBJ_Y] < 224) {
    m.push16(0x2146);
    return m.call(TAIL_BELOW);
  }
  mem8[record + OBJ_SPRITE_CODE] = (mem8[record + OBJ_SPRITE_CODE] & 0xfc) | 0x01;
  mem8[record + 1] = 0;
  mem8[record + 2] = 0;
  mem8[record + 16] = 255;
  mem8[record + 17] = 0;
  mem8[record + 18] = 0;
  mem8[record + 19] = 176;
  mem8[record + 14] = 1;
  m.regs.a = 0;
  m.push16(0x2153);
  return m.call(TAIL_AT_OR_ABOVE);
}

const TEETH = [
  { name: "sprite code not masked to 01", twin: twinNoCodeMask, kind: "write-sequence" },
  { name: "dropped velocity low byte", twin: twinDropVelocityLow, kind: "write-sequence" },
  { name: "stores in the wrong order", twin: twinSwappedStoreOrder, kind: "write-sequence" },
  { name: "accumulator not zeroed into the tail", twin: twinNoAccumulator, kind: "handoff reg a" },
  { name: "split off by one at 224", twin: twinOffByOneSplit, kind: "arm" },
  { name: "tail result dropped", twin: twinNoReturn, kind: "return" },
  { name: "silent stack-pointer shift", twin: twinSilentStackShift, kind: "sp" },
  // The spurious push is caught by the write sequence BEFORE the stack pointer is reached — a
  // push is a store, and the write hook sees it first. Pinned to what actually catches it.
  { name: "spurious push around the tail", twin: twinSpuriousPush, kind: "write-sequence" },
];

for (const { name, twin, kind } of TEETH) {
  test(`TEETH: a twin with the ${name} is CAUGHT`, () => {
    const run = replayAll(twin);
    assert.ok(
      run.breaches.length > 0,
      `the gate FAILED to catch the "${name}" twin over ${run.replays} replays — it proves nothing`,
    );
    const first = run.breaches[0];
    assert.equal(
      first.kind,
      kind,
      `the "${name}" twin was caught by ${first.kind}, not the ${kind} check it is meant to exercise`,
    );
    console.log(
      `  TEETH/${name}: caught on ${run.breaches.length} of ${run.replays} replays; first at dispatch ` +
        `${first.dispatch} craft "${first.craft}" via ${first.kind} — ${first.detail}`,
    );
  });
}

/**
 * The split boundary is structurally invisible to attract: OBJ_Y is never exactly 224 at a real
 * dispatch. Both halves are asserted, so the crafted arm's necessity is a documented fact rather
 * than an assumption — the twin ESCAPES every natural entry and the crafted entry CATCHES it.
 */
test("TEETH: the off-by-one split ESCAPES every natural entry and is caught only by the crafted one", () => {
  const natural = replayAll(twinOffByOneSplit, [{ name: "natural", poke: null }]);
  assert.equal(
    natural.breaches.length,
    0,
    "a natural entry did land on the boundary after all — this test's premise is wrong, not its subject",
  );
  const crafted = replayAll(twinOffByOneSplit, [
    { name: "y=224 (exactly at the split)", poke: craftY(224) },
  ]);
  assert.equal(
    crafted.breaches.length,
    crafted.replays,
    "the crafted boundary entry did not catch the off-by-one on every dispatch",
  );
  console.log(
    `  TEETH/boundary: 0 of ${natural.replays} natural entries catch the off-by-one; ` +
      `${crafted.breaches.length} of ${crafted.replays} crafted y=224 entries catch it`,
  );
});

// -- 3. LIVE ------------------------------------------------------------------------------------

/**
 * What the ORACLE spends on its own head, per dispatch, with both tails stubbed so the price is
 * the fragment this routine replaces and not the whole sweep behind it. Measured on a rehosted
 * machine, which is override-free and so cannot re-enter the routine being priced.
 */
function priceHead(m) {
  const probe = rehost(m);
  for (const tail of TAILS) probe.routines.set(tail, () => 0);
  const before = probe.cycles;
  oracle(probe);
  return probe.cycles - before;
}

/**
 * The unit checks compare one hand-off at a time, so they cannot see anything a caller reads back
 * after the whole chain returns. This wires the rewrite LIVE at 0x2118 for a whole attract run and
 * diffs the frame trace against the pure-oracle baseline.
 *
 * The baseline is a plain oracle machine, which is the right control precisely because this
 * rewrite direct-calls nothing: both tails are still frozen, so the ONLY difference between the
 * two runs is this routine's head.
 *
 * The head is cycle-free, so its cost is restored — measured per dispatch and charged AT THE
 * HAND-OFF, where the oracle finished charging it, with the program counter set to the tail. The
 * charge is only the head: the frozen tail still runs through the registry and charges its own
 * subtree, so adding the oracle's total would double-count it. The charging shim goes on
 * `routines` directly, not through the override map, so the call-bracket seam is not involved.
 */
test("LIVE: wired live at 0x2118 for a whole attract run, the rewrite leaves the same trace", () => {
  const baseline = new Machine(ROM).runFrames(ATTRACT_FRAMES);

  let dispatches = 0;
  let owed = 0;
  const host = new Machine(ROM, {
    overrides: {
      "2118": (m) => {
        dispatches++;
        owed = priceHead(m);
        return loc_2118(m);
      },
    },
  });
  for (const tail of TAILS) {
    const frozen = host.routines.get(tail);
    host.routines.set(tail, (m) => {
      if (owed) {
        const cost = owed;
        owed = 0;
        m.step(tail, cost);
      }
      return frozen(m);
    });
  }
  const live = host.runFrames(ATTRACT_FRAMES);

  assert.ok(dispatches > 0, "the live run never dispatched 0x2118 — it would compare two runs of the oracle");
  assert.equal(
    dispatches,
    PROBE.dispatches,
    `the live run dispatched 0x2118 ${dispatches} times against the oracle's ${PROBE.dispatches}`,
  );
  assert.equal(live.length, baseline.length, "the two runs did not reach the same frame count");
  for (let f = 0; f < baseline.length; f++) {
    for (let i = 0; i < baseline[f].length; i++) {
      if (baseline[f][i] === live[f][i]) continue;
      assert.fail(
        `frame ${f}: ${hx(host.stateOffsetToAddr(i))} baseline=${baseline[f][i]} live=${live[f][i]}`,
      );
    }
  }
  console.log(
    `  LIVE: ${ATTRACT_FRAMES} attract frames byte-identical with 0x2118 wired live over ` +
      `${dispatches} dispatches (head cost restored per dispatch at the hand-off)`,
  );
});
