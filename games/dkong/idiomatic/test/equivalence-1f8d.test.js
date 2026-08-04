// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_1f8d (ROM 0x1F8D) — the object walk's between-slots step: move the
 * staging cursor onto the next ACTOR_SPRITES record, move the object cursor on by one
 * OBJ_ARRAY_67 record, drop the remaining-slot count, and loop back while slots remain.
 *
 * WHAT THIS GATE ACTUALLY COVERS, stated plainly:
 *
 *   1. REALISM (captured, ATTRACT ONLY). 0x1F8D needs no input to reach: a plain 3000-frame
 *      attract run dispatches it 15320 times. Cloning all of those is not affordable, so the
 *      run records a cheap ENTRY SHAPE for every dispatch — remaining count, object cursor,
 *      staging cursor, carry-in, and the three bytes of the record the loop-back will read —
 *      and clones the FIRST dispatch at each distinct shape. EVERY clone is then replayed, so
 *      the sample covers every shape seen BY CONSTRUCTION, and the test asserts that as well as
 *      the coverage it should see: all ten remaining values, all ten record bases, both
 *      carry-in states. The counts are printed by the run. Credited gameplay, boards 2-4 and
 *      two-player are NOT covered — the walk this belongs to runs only while BOARD is 1.
 *
 *      A replay is not one instruction's worth of work: the rewrite is installed in the
 *      replaying machine's registry, so the loop-back re-enters IT and one replay drives the
 *      whole remaining walk — every later slot, through whichever dispatch arm each one
 *      selects — against the oracle doing the same. Part 2 measures what that is worth.
 *
 *   2. COVERAGE (measured, not assumed). The same captures are replayed again, driven by the
 *      REWRITE, with the loop-back, the shared tail and the active-slot dispatch's five arms
 *      counted — so what "one replay drives the whole walk" is worth is a number rather than a
 *      claim: how many slots each replay walks, how many records it stages, and which arms it
 *      reaches. FOUR of the five arms fire in attract; the fifth (ROM 0x20EC) needs an
 *      object-record byte attract never produces here, and the test reports that hole rather
 *      than letting the count read as five.
 *
 *   3. LIVE-OUT (measured). The rewrite drops the flags the oracle's two register steps set,
 *      on the derivation that every consumer overwrites the value before reading it. That is
 *      not left as an argument: the test replays a faithful oracle twin whose only difference
 *      is the flag the object step leaves, forced BOTH ways, and asserts no RAM byte moves. It
 *      also pins WHICH polarity is the real perturbation, so it cannot pass vacuously — the
 *      object cursor runs 0x6700-0x6820 and a 32-byte step never carries out of 16 bits, so the
 *      oracle leaves that flag clear on every reachable state: forcing it SET must change it on
 *      every step, forcing it CLEAR must change nothing. Both are asserted.
 *
 *   4. EQUAL (crafted). Attract never wraps the staging cursor's page: it runs 0x6983 to
 *      0x69A7 and stops. So a crafted arm takes the real captures whose next slot is ACTIVE
 *      (the ones that reach the shared sprite-record tail and therefore actually write) and
 *      nudges the cursor's low byte to 255 on BOTH sides, forcing the wrap. The arm is proved
 *      LIVE by asserting the staged bytes really land at the wrapped address.
 *
 *   5. TEETH — five broken twins, each of which the suite MUST catch:
 *      (a) dropped staging step — the next record is staged one byte low.
 *      (b) dropped object step — the same object record is read twice.
 *      (c) full-width staging step — 16-bit instead of low-byte-only. CAUGHT ONLY BY THE
 *          CRAFTED WRAP ARM, and the test asserts BOTH halves of that: escapes every natural
 *          capture, caught on the crafted one. That is the whole reason part 4 exists.
 *      (d) inverted loop test — walks one slot instead of the rest.
 *      (e) a spurious return value, whose RAM is byte-identical to the correct routine's, so
 *          ONLY the return-value half of the contract can catch it.
 *
 * CONTRACT. RAM minus STACK_SCRATCH [0x6BE0,0x6C00), plus the propagated return value. pc and
 * SP are NOT compared: the oracle ends its tail chain with one guest `ret` that the rewrite
 * models as a plain JS return (in the live engine the translated-to-idiomatic seam performs
 * it), so SP legitimately differs by two and pc by the return address.
 *
 * THE STACK_SCRATCH EXCLUSION IS INERT HERE, and this test says so rather than implying it
 * does work: the routine writes no memory at all and the oracle's only stack op is a POP, so
 * oracle and rewrite come out byte-identical INCLUDING the stack region. The test asserts that
 * — if a future change ever does put a byte in there, this assertion is what will say so.
 *
 * THE RETURN VALUE IS `undefined` ON EVERY REPLAYED DISPATCH — the walk's tail chain always
 * ends at this routine's own fall-through. So the return comparison discriminates nothing on
 * the captured arms; twin (e) exists to prove that half of the contract is nonetheless wired
 * and would catch a rewrite that started returning something.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-1f8d.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_1f8d as oracle } from "../../translated/loc_1f8d.js";
import { loc_1f8d } from "../loc_1f8d.js";
import { Machine } from "../../machine.js";
import { STACK_SCRATCH, ACTOR_SPRITES, OBJ_ARRAY_67, SPRITE_BUFFER } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1f8d;
const PER_SLOT_CHECK = 0x1f83; // the routine loops back to it; still the frozen oracle (same cluster)
const SLOT_STRIDE = 32; // OBJ_ARRAY_67 record stride
const SLOTS = 10;
const ATTRACT_FRAMES = 3000;
const PAGE_END = 255; // the crafted low byte that forces the staging cursor to wrap its page

const hx = (v) => "0x" + (v & 0xffff).toString(16);
const inStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;

// -- diff plumbing ------------------------------------------------------------

/** First RAM byte that differs, skipping the dead STACK_SCRATCH region. */
function firstRamDiff(a, b) {
  const da = a.dumpState(), db = b.dumpState();
  for (let i = 0; i < Math.min(da.length, db.length); i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (inStack(addr)) continue;
    return { addr, a: da[i], b: db[i] };
  }
  return null;
}

/** First RAM byte that differs INCLUDING the stack — shows whether the exclusion does work. */
function firstAnyRamDiff(a, b) {
  const da = a.dumpState(), db = b.dumpState();
  for (let i = 0; i < Math.min(da.length, db.length); i++) {
    if (da[i] !== db[i]) return { addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] };
  }
  return null;
}

function runOracle(entry, prep) {
  const c = entry.clone();
  if (prep) prep(c);
  return { c, value: oracle(c) };
}

/**
 * Run a candidate on a fresh clone with itself installed at the loop-back target, so the
 * frozen per-slot check re-enters the CANDIDATE for every later slot of the walk rather than
 * falling back to the oracle after the first one.
 */
function runCandidate(entry, fn, prep) {
  const c = entry.clone();
  if (prep) prep(c);
  c.routines.set(TARGET, fn);
  return { c, value: fn(c) };
}

/** Contract diff: RAM − STACK_SCRATCH plus the propagated return value. */
function contractDiffs(entry, fn, prep) {
  const o = runOracle(entry, prep);
  const k = runCandidate(entry, fn, prep);
  const diffs = [];
  const ram = firstRamDiff(o.c, k.c);
  if (ram) diffs.push(`RAM@${hx(ram.addr)} oracle=${ram.a} cand=${ram.b}`);
  if (o.value !== k.value) diffs.push(`return oracle=${String(o.value)} cand=${String(k.value)}`);
  return diffs;
}

// -- capture ------------------------------------------------------------------

/**
 * What a reader can see about a dispatch before it runs: the walk's own cursors and count,
 * the carry the routine inherits, and the three bytes of the NEXT record — which is what the
 * loop-back reads and which therefore picks the arm the rest of the replay takes.
 */
function entryShape(m) {
  const { regs } = m;
  const next = (d) => m.mem.read8((regs.ix + SLOT_STRIDE + d) & 0xffff);
  return `rem=${regs.b} obj=${hx(regs.ix)} stage=${hx(regs.hl)} carry=${regs.f & 1} ` +
    `next=${next(0)},${next(1)},${next(2)}`;
}

/**
 * Hook 0x1F8D through a plain attract run. Every dispatch contributes its shape; only the
 * first at each distinct shape is cloned, which is what keeps 15320 dispatches affordable.
 * Capturing stops before the clones are replayed, so a replay's own re-entries (which resolve
 * through the same hook — a clone rebuilds its registry from the host's assets) do not
 * recurse back into the capture.
 */
function captureAttract(frames = ATTRACT_FRAMES) {
  const caps = [];
  const shapes = new Set();
  let capturing = true;
  let total = 0;
  const hook = (mm) => {
    if (capturing) {
      total++;
      const s = entryShape(mm);
      if (!shapes.has(s)) { shapes.add(s); caps.push(mm.clone()); }
    }
    return oracle(mm);
  };
  const host = new Machine(ROM, { overrides: new Map([[TARGET, hook]]) });
  host.runFrames(frames);
  capturing = false;
  return { caps, shapes, total };
}

// -- 1. REALISM (captured, attract only) --------------------------------------

test("REALISM: real captured 0x1F8D attract dispatches — loc_1f8d matches the oracle walk", () => {
  const { caps, shapes, total } = captureAttract();
  assert.ok(total > 0, "expected real 0x1F8D dispatches during attract");
  assert.equal(caps.length, shapes.size, "one clone per distinct entry shape");

  // Coverage the walk must show if the capture is honest: every slot position, every record
  // base, and both carry-in states (the second is what makes the memory-only live-out claim
  // measurable rather than asserted).
  const remaining = new Set(caps.map((c) => c.regs.b));
  const bases = new Set(caps.map((c) => c.regs.ix));
  const carries = new Set(caps.map((c) => c.regs.f & 1));
  for (let n = 1; n <= SLOTS; n++) assert.ok(remaining.has(n), `no capture with ${n} slots remaining`);
  for (let i = 0; i < SLOTS; i++) {
    const base = OBJ_ARRAY_67 + i * SLOT_STRIDE;
    assert.ok(bases.has(base), `no capture with the object cursor at ${hx(base)}`);
  }
  assert.deepEqual([...carries].sort(), [0, 1], "expected both carry-in states among the captures");

  // The cursor arithmetic the routine's header rests on: entering slot `10 - remaining`, the
  // staging cursor sits on that record's last byte inside ACTOR_SPRITES.
  for (const c of caps) {
    const expected = ACTOR_SPRITES + (SLOTS - c.regs.b) * 4 + 3;
    assert.equal(c.regs.hl, expected,
      `staging cursor ${hx(c.regs.hl)} is not ACTOR_SPRITES + 4*(10-${c.regs.b}) + 3 = ${hx(expected)}`);
  }

  let stackOnly = 0, anyDiff = 0;
  for (let i = 0; i < caps.length; i++) {
    const diffs = contractDiffs(caps[i], loc_1f8d);
    assert.equal(diffs.length, 0, `captured dispatch #${i} (${entryShape(caps[i])}): ${diffs.join("; ")}`);

    const any = firstAnyRamDiff(runOracle(caps[i]).c, runCandidate(caps[i], loc_1f8d).c);
    if (any) { anyDiff++; if (inStack(any.addr)) stackOnly++; }
  }
  // Stated rather than assumed: the exclusion is doing nothing for this routine, because the
  // rewrite leaves the stack region byte-identical too. If that ever changes, say so here.
  assert.equal(anyDiff, 0,
    `expected the rewrite to match the oracle even INSIDE STACK_SCRATCH (${anyDiff} replays differed, ${stackOnly} only in the stack)`);

  console.log(`  REALISM: ${caps.length} of ${total} real 0x1F8D dispatches replayed (${ATTRACT_FRAMES} attract frames) — ` +
    `the first at each of ${shapes.size} distinct entry shapes, covering ${remaining.size} slot positions, ` +
    `${bases.size} record bases and both carry-in states; RAM identical to the oracle including STACK_SCRATCH`);
});

// -- 2. COVERAGE: what a replay actually drives --------------------------------

// The active-slot dispatch, the shared sprite-record tail, and the five arms that dispatch can
// pick. All still the frozen oracle; counted, not swapped.
const ACTIVE_SLOT_DISPATCH = 0x1f93;
const SPRITE_RECORD_TAIL = 0x21ba;
const DISPATCH_ARMS = [0x1fac, 0x1fe5, 0x1fef, 0x2053, 0x20ec];

test("COVERAGE: one replay drives the whole remaining walk, through four of the five arms", () => {
  const { caps } = captureAttract();
  const counted = [PER_SLOT_CHECK, ACTIVE_SLOT_DISPATCH, SPRITE_RECORD_TAIL, ...DISPATCH_ARMS];
  const hits = new Map(counted.map((a) => [a, 0]));

  for (const cap of caps) {
    const c = cap.clone();
    for (const addr of counted) {
      const base = c.routines.get(addr);
      c.routines.set(addr, (mm, ...args) => { hits.set(addr, hits.get(addr) + 1); return base(mm, ...args); });
    }
    c.routines.set(TARGET, loc_1f8d); // count what the REWRITE drives, not the oracle
    loc_1f8d(c);
  }

  assert.ok(hits.get(PER_SLOT_CHECK) > caps.length,
    `each replay must loop back more than once (${hits.get(PER_SLOT_CHECK)} loop-backs over ${caps.length} replays)`);
  assert.ok(hits.get(SPRITE_RECORD_TAIL) > 0, "no replay reached the shared sprite-record tail — nothing was staged");
  // Four of the five arms fire without input. The fifth is stated, not claimed: 0x20EC needs an
  // object-record byte attract never produces from here, so it rests on derivation alone.
  for (const addr of [0x1fac, 0x1fe5, 0x1fef, 0x2053]) {
    assert.ok(hits.get(addr) > 0, `the replays never reached the dispatch arm at ${hx(addr)}`);
  }

  console.log(`  COVERAGE: ${caps.length} replays -> ${hits.get(PER_SLOT_CHECK)} per-slot checks, ` +
    `${hits.get(ACTIVE_SLOT_DISPATCH)} active slots, ${hits.get(SPRITE_RECORD_TAIL)} staged records; arms ` +
    DISPATCH_ARMS.map((a) => `${hx(a)}=${hits.get(a)}`).join(", ") +
    ` (${hx(0x20ec)} is NOT reached in attract — derivation only)`);
});

// -- 3. LIVE-OUT: the flag the object step leaves is not observable -------------

/**
 * A faithful twin of the frozen oracle whose ONLY difference is the flag left by the object
 * step — forced on or off. If the rewrite is right to drop that flag, this must move no RAM.
 * It keeps the oracle's stack and cycle modelling so nothing else can differ.
 */
function makeFlagForcedOracle(bit, tally) {
  return function flagForced(m) {
    const { regs } = m;
    regs.l = regs.inc8(regs.l);
    m.step(0x1f8e, 4);
    regs.addIx(regs.de);
    m.step(0x1f90, 15);
    const before = regs.f & 1;
    regs.f = bit ? regs.f | 1 : regs.f & 0xfe;
    if ((regs.f & 1) !== before) tally.changed++;
    tally.calls++;
    regs.b = (regs.b - 1) & 0xff;
    if (regs.b !== 0) { m.step(0x1f83, 13); return m.call(0x1f83); }
    m.step(0x1f92, 8);
    m.ret(10);
  };
}

test("LIVE-OUT: forcing the flag the object step leaves, either way, moves no RAM byte", () => {
  const { caps } = captureAttract();
  const tallies = {};

  for (const bit of [0, 1]) {
    const tally = { calls: 0, changed: 0 };
    const twin = makeFlagForcedOracle(bit, tally);
    for (let i = 0; i < caps.length; i++) {
      const o = runOracle(caps[i]).c;
      const k = caps[i].clone();
      k.routines.set(TARGET, twin); // every iteration of the walk is perturbed, not just the first
      twin(k);
      const ram = firstRamDiff(o, k);
      assert.equal(ram, null,
        `forcing the flag to ${bit} changed RAM@${ram ? hx(ram.addr) : ""} on capture #${i} ` +
        `(${entryShape(caps[i])}) — the memory-only live-out is WRONG`);
    }
    tallies[bit] = tally;
  }

  // Non-vacuity, and a measurement in its own right: the object cursor runs 0x6700-0x6820 and a
  // 32-byte step never carries out of 16 bits, so the oracle leaves that flag CLEAR on every
  // reachable state. Forcing it SET is therefore a real perturbation on every single step —
  // and forcing it CLEAR is a no-op. Both are asserted so neither can drift into a false claim.
  assert.equal(tallies[1].changed, tallies[1].calls,
    `forcing the flag SET must be a real perturbation on every step (${tallies[1].changed} of ${tallies[1].calls})`);
  assert.ok(tallies[1].calls > caps.length, "the perturbed twin must have run for the whole walk, not one slot");
  assert.equal(tallies[0].changed, 0,
    `forcing the flag CLEAR should be a no-op — the object step cannot carry (${tallies[0].changed} of ${tallies[0].calls} changed)`);

  console.log(`  LIVE-OUT: ${caps.length} captures replayed with the flag forced both ways, RAM unmoved — ` +
    `set: really changed on ${tallies[1].changed}/${tallies[1].calls} steps; ` +
    `clear: a no-op on all ${tallies[0].calls} (the object step never carries)`);
});

// -- 4. EQUAL (crafted): the staging cursor's page wrap ------------------------

/** Real capture, one surgical nudge: the staging cursor sits on the last byte of its page. */
const wrapCursor = (m) => { m.regs.l = PAGE_END; };

/** The captures whose NEXT slot is active — the ones that reach the tail that actually writes. */
const activeNext = (caps) => caps.filter((c) => c.mem.read8((c.regs.ix + SLOT_STRIDE) & 0xffff) === 1);

test("EQUAL (crafted): a staging cursor that wraps its page matches the oracle", () => {
  const { caps } = captureAttract();
  const wrapping = activeNext(caps);
  assert.ok(wrapping.length > 0, "expected a capture whose next slot is active to craft from");

  // The arm is LIVE: with the cursor wrapped, the staged bytes land at the start of the page
  // instead of inside ACTOR_SPRITES, and that is observable.
  const entry = wrapping[0];
  const plain = runOracle(entry).c;
  const wrapped = runOracle(entry, wrapCursor).c;
  assert.equal(plain.mem.read8(SPRITE_BUFFER), entry.mem.read8(SPRITE_BUFFER),
    "an unwrapped walk must not touch the start of the page");
  assert.notEqual(wrapped.mem.read8(SPRITE_BUFFER), entry.mem.read8(SPRITE_BUFFER),
    "the crafted wrap did not actually stage anything at the wrapped address — the arm would be vacuous");

  for (let i = 0; i < wrapping.length; i++) {
    const diffs = contractDiffs(wrapping[i], loc_1f8d, wrapCursor);
    assert.equal(diffs.length, 0, `wrapped capture #${i} (${entryShape(wrapping[i])}): ${diffs.join("; ")}`);
  }
  console.log(`  EQUAL/crafted: ${wrapping.length} captures replayed with the staging cursor wrapping its page ` +
    `(attract runs it ${hx(ACTOR_SPRITES + 3)}-${hx(ACTOR_SPRITES + 39)} and never wraps)`);
});

// -- 5. TEETH ------------------------------------------------------------------

/** (a) never makes the fourth staging move: the next record is staged one byte low. */
function brokenDroppedStagingStep(m) {
  const { regs } = m;
  regs.ix = regs.ix + regs.de;
  regs.b = regs.b - 1;
  if (regs.b !== 0) return m.call(PER_SLOT_CHECK);
}

/** (b) never moves the object cursor: the same record is read again. */
function brokenDroppedObjectStep(m) {
  const { regs } = m;
  regs.l = regs.l + 1;
  regs.b = regs.b - 1;
  if (regs.b !== 0) return m.call(PER_SLOT_CHECK);
}

/** (c) moves the staging cursor full-width, so it leaves its page instead of wrapping. */
function brokenFullWidthStagingStep(m) {
  const { regs } = m;
  regs.hl = regs.hl + 1;
  regs.ix = regs.ix + regs.de;
  regs.b = regs.b - 1;
  if (regs.b !== 0) return m.call(PER_SLOT_CHECK);
}

/** (d) inverted loop test: stops after this slot instead of walking the rest. */
function brokenInvertedLoop(m) {
  const { regs } = m;
  regs.l = regs.l + 1;
  regs.ix = regs.ix + regs.de;
  regs.b = regs.b - 1;
  if (regs.b === 0) return m.call(PER_SLOT_CHECK);
}

/** (e) correct in RAM, wrong at the boundary: hands its caller a value it never had. */
function brokenSpuriousReturn(m) {
  const { regs } = m;
  regs.l = regs.l + 1;
  regs.ix = regs.ix + regs.de;
  regs.b = regs.b - 1;
  if (regs.b !== 0) return m.call(PER_SLOT_CHECK);
  return false;
}

test("TEETH: five broken twins are all CAUGHT", () => {
  const { caps } = captureAttract();
  const wrapping = activeNext(caps);
  assert.ok(caps.length > 0 && wrapping.length > 0, "need both natural and wrappable captures");

  const countCaught = (twin, entries, prep) => {
    let caught = 0, first = null;
    for (const e of entries) {
      let diffs;
      try { diffs = contractDiffs(e, twin, prep); } catch (err) { diffs = [`threw ${err.message}`]; }
      if (diffs.length) { caught++; if (!first) first = diffs.join("; "); }
    }
    return { caught, of: entries.length, first };
  };

  const report = [];
  for (const [name, twin] of [
    ["dropped staging step", brokenDroppedStagingStep],
    ["dropped object step", brokenDroppedObjectStep],
    ["inverted loop test", brokenInvertedLoop],
    ["spurious return value", brokenSpuriousReturn],
  ]) {
    const r = countCaught(twin, caps);
    assert.ok(r.caught > 0, `the "${name}" twin escaped every natural capture — the gate is worthless`);
    report.push(`${name} ${r.caught}/${r.of} (${r.first})`);
  }

  // The spurious-return twin must be caught by the RETURN half of the contract and by nothing
  // else — that is what proves the return comparison is wired rather than decorative.
  const retTwin = countCaught(brokenSpuriousReturn, caps);
  assert.equal(retTwin.caught, caps.length, "the spurious return must be caught on every capture");
  assert.ok(retTwin.first.startsWith("return "),
    `the spurious-return twin must be caught by the return comparison, not by RAM: ${retTwin.first}`);

  // The full-width twin is the reason the crafted arm exists: attract cannot see it.
  const natural = countCaught(brokenFullWidthStagingStep, caps);
  assert.equal(natural.caught, 0,
    `the full-width staging step was expected to ESCAPE every natural capture (attract never wraps the page), but ${natural.caught} caught it`);
  const crafted = countCaught(brokenFullWidthStagingStep, wrapping, wrapCursor);
  assert.equal(crafted.caught, crafted.of,
    `the crafted wrap arm must catch the full-width staging step on every wrappable capture (${crafted.caught}/${crafted.of})`);
  report.push(`full-width staging step 0/${natural.of} natural, ${crafted.caught}/${crafted.of} crafted (${crafted.first})`);

  console.log(`  TEETH: ${report.join("; ")}`);
});
