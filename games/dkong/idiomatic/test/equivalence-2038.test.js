// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence gate for loc_2038 (ROM 0x2038) — the object sweep's fall-arming block: stamp the
 * initial vertical velocity, blank the two coordinate fractions and the two counters, move the
 * record onto the falling arm, and continue into the still-frozen shared sprite tail at ROM 0x21BA.
 *
 * WHAT THIS GATE ACTUALLY COVERS, stated before the assertions rather than implied by them:
 *
 *   - REAL CAPTURES, ALL OF THEM. An 8000-frame attract run dispatches 0x2038 exactly 42 times.
 *     All 42 are captured and all 42 are replayed — there is no sampling here and so no sampling
 *     policy to defend. They span all 7 record bases the sweep makes live (0x6700, 0x6720,
 *     0x6740, 0x6760, 0x6780, 0x67A0, 0x67C0), and the test asserts that spread rather than
 *     assuming it. This routine has no branch, so there is no arm for a shape key to miss: the
 *     only entry variation is the record base, the accumulator, and the prior contents of the
 *     seven written bytes, and the crafted arm below sweeps the latter two.
 *   - CRAFTED, and it is not decoration. The captures are narrow in two ways that hide real
 *     defects. The accumulator is 0 on every one of the 42, so a twin that writes a literal zero
 *     instead of the value it was handed is INVISIBLE to them — measured: caught on 0 of 42; and
 *     the record's +4 byte already holds 0 on 41 of the 42, so a dropped write there is caught on
 *     1 of 42 and would vanish under any sampling. The crafted arm is 35 entries — one capture per
 *     record base, all 7, crossed with 5 accumulator seeds — each with all seven written bytes
 *     pre-poisoned to a value none of them should be left holding. It catches those two twins on
 *     35 of 35 and 28 of 35. Both narrownesses are ASSERTED in the reachability and teeth tests
 *     rather than merely described here, and the teeth report prints which half caught which twin
 *     and on how many cases.
 *   - HOW MUCH RUNS PER CASE. loc_2038 tail-jumps rather than returning, so every case here runs
 *     the WHOLE frozen chain below it — the sprite copy at ROM 0x21BA, the sweep advance at ROM
 *     0x1F8D, and the rest of that frame's ten-slot sweep — on both sides before anything is
 *     compared. The comparison is of the sweep's finished work, not of seven stores.
 *   - WHAT IS COMPARED — the memory-equivalence contract for the DISSOLVED form: RAM EXCLUDING the
 *     STACK_SCRATCH window {0x6be0,0x6c00}, the final guest SP, and the forwarded return value.
 *     loc_2038 no longer reaches its tail through m.call(0x21ba): it direct-calls the idiomatic
 *     publishBarrelSprite, which direct-calls loc_1f8d, down to the still-frozen m.call(0x1f83).
 *     The frozen oracle jp-tails to the same boundary at the same SP (a jp pushes nothing), so the
 *     two runs happen to write the same bytes even inside STACK_SCRATCH — but that is a fact about
 *     this particular chain, not a contract to assert, so the window is excluded and the final SP
 *     is compared instead (a stray push in the rewrite lands in the excluded window yet still moves
 *     SP, so that check stays load-bearing). pc and the rest of the register file are dropped with
 *     the frozen bracket that used to justify them. Cycles are NOT compared: the rewrite is
 *     cycle-free by design.
 *   - RE-ENTRANCY, handled explicitly. The chain below re-enters 0x2038 (the sweep reaches a later
 *     slot in the same frame), so the capturing hook keeps firing during replay. Left alone the
 *     capture list grows underneath the loop — measured here at 42 -> 44. It is frozen before any
 *     replay, and the hook stays installed but DELEGATES TO THE ORACLE, so nested dispatches are
 *     oracle on both sides and only the outer dispatch is under test.
 *   - LIVE-WIRED, as well as replayed. The last test wires the rewrite into a real 8000-frame
 *     attract run and diffs every frame against the all-oracle baseline. It asserts a non-zero
 *     dispatch count, because a live comparison of two runs in which the routine never executed
 *     passes while proving nothing.
 *   - WHAT IS NOT COVERED. Attract only, and attract is 25m only. That is not a hole this gate
 *     could close by poking a later board: the sweep at ROM 0x1F72 returns immediately unless
 *     BOARD is 1, so poking BOARD to 2, 3 or 4 removes 0x2038 from the run rather than reaching
 *     new states. Gameplay entry to this address is untested.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-2038.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_2038 as oracle } from "../../translated/loc_2038.js";
import { loc_2038 } from "../loc_2038.js";
import { Machine } from "../../machine.js";
import { STACK_SCRATCH } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x2038;
const ATTRACT_FRAMES = 8000;

// The seven record fields this routine writes, and what it writes into each. "A" means the value
// handed in through the accumulator. Mirrors loc_2038.js; the gate needs them to poison and to
// check, and a wrong copy here shows up as a failure rather than as silent agreement.
const ARM_SELECT = 2;
const X_FRACTION = 4;
const Y_FRACTION = 6;
const SUBSTATE = 14;
const INITIAL_VY_HI = 18;
const INITIAL_VY_LO = 19;
const AIRBORNE_FRAMES = 20;
const WRITES = [
  [INITIAL_VY_HI, 255],
  [INITIAL_VY_LO, 240],
  [AIRBORNE_FRAMES, "A"],
  [SUBSTATE, "A"],
  [X_FRACTION, "A"],
  [Y_FRACTION, "A"],
  [ARM_SELECT, 8],
];

// The boundary where the frozen chain resumes: loc_1f8d's still-live m.call(0x1f83) back into the
// object-walk step. loc_2038 is now DISSOLVED — it direct-calls publishBarrelSprite, which
// direct-calls loc_1f8d — so its whole fragment above 0x1f83 runs cycle-free; 0x1f83 and below
// stay frozen and charge their own T-states.
const WALK_STEP = 0x1f83;

const hx = (v) => "0x" + (v & 0xffff).toString(16);
const hb = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");

// ---------------------------------------------------------------------------
// Capture: every real dispatch in an attract run, cloned at the instant of entry.
//
// `capturing` is what stops the re-entrancy corruption described in the header: the hook is still
// installed on every clone (that is how nested dispatches stay oracle on both sides) but it stops
// appending the moment the attract run is over.
// ---------------------------------------------------------------------------
let CAPTURES = null;
let LIVE_GROWTH = 0; // how much the list WOULD have grown during replay, for the header's claim
function captures() {
  if (CAPTURES === null) {
    const caught = [];
    let capturing = true;
    const host = new Machine(ROM, {
      overrides: new Map([[TARGET, (mm) => {
        if (capturing) caught.push(mm.clone());
        else LIVE_GROWTH += 1;
        return oracle(mm);
      }]]),
    });
    host.runFrames(ATTRACT_FRAMES);
    capturing = false;
    CAPTURES = caught; // frozen: nothing below can lengthen it
  }
  return CAPTURES;
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

/** First differing state byte OUTSIDE the excluded STACK_SCRATCH window (the memory-equivalence
 * contract — see the header). The frozen side and the dissolved side reach loc_1f8d's live
 * m.call(0x1f83) with the same guest SP, so they write the same bytes into that window; excluding
 * it is belt-and-braces against any bracket residue, and the final SP is compared separately. */
function firstRamDiff(a, b) {
  const da = a.dumpState(), db = b.dumpState();
  const n = Math.min(da.length, db.length);
  for (let i = 0; i < n; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= STACK_SCRATCH.lo && addr < STACK_SCRATCH.hi) continue;
    return { addr, a: da[i], b: db[i] };
  }
  return null;
}

/**
 * Run the oracle and a candidate on two fresh, byte-identical clones of one entry state and
 * report the first contract breach. A FAULT is a RESULT, not a crash: a broken twin can walk the
 * frozen chain below into unmapped memory, and a gate that dies instead of reporting proves
 * nothing.
 */
function runPair(entry, candidate) {
  const a = entry.clone(), b = entry.clone();
  let retA, retB, faultA = null, faultB = null;
  try { retA = oracle(a); } catch (e) { faultA = String(e.message); }
  try { retB = candidate(b); } catch (e) { faultB = String(e.message); }

  if (faultA !== faultB) return { kind: "fault", detail: `oracle=${faultA} candidate=${faultB}` };
  if (faultA !== null) return null; // both faulted identically: not a difference

  const ram = firstRamDiff(a, b);
  if (ram) return { kind: "ram", detail: `${hx(ram.addr)} oracle=${hb(ram.a)} candidate=${hb(ram.b)}`, addr: ram.addr };

  // Final guest SP is KEPT (a stray push in the dissolved form lands in the excluded window but
  // still moves SP, so this stays load-bearing); pc and the rest of the register file are dropped
  // with the frozen call bracket that used to make them comparable.
  if (a.regs.sp !== b.regs.sp) return { kind: "sp", detail: `oracle=${hx(a.regs.sp)} candidate=${hx(b.regs.sp)}` };
  if (retA !== retB) return { kind: "return", detail: `oracle=${retA} candidate=${retB}` };
  return null;
}

/** Replay a list of entry states; return the first case that breaches, or null. */
function sweep(entries, candidate) {
  for (const [i, e] of entries.entries()) {
    const breach = runPair(e, candidate);
    if (breach) return { i, base: e.regs.ix, acc: e.regs.a, ...breach };
  }
  return null;
}

/** How many of the entries breach — the teeth report quotes it, so "caught" is not just "once". */
function breachCount(entries, candidate) {
  let n = 0;
  for (const e of entries) if (runPair(e, candidate)) n += 1;
  return n;
}

const describe = (b) => b && `case ${b.i} (base ${hx(b.base)}, A=${hb(b.acc)}): ${b.kind} — ${b.detail}`;

// A FRESH, override-free Machine carrying the source machine's observable state. Machine.clone()
// would rerun the constructor with the live override installed and re-enter this routine through
// its own tail chain; a fresh machine dispatches purely through the oracle registry, so pricing
// the oracle here is hermetic.
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

// What the ORACLE spends on the fragment this rewrite replaces cycle-free: loc_2038's seven stores,
// the dissolved sprite tail and loc_1f8d, up to — but NOT including — the frozen m.call(0x1f83).
// Measured on a rehosted machine with that boundary stubbed to zero cost, so the price is exactly
// the fragment and not the frozen subtree past it (which the live run charges for itself when its
// own JS chain reaches the same frozen call). This replaces the old fixed 143-cycle charge, which
// modelled the pre-dissolution jp-tail into 0x21BA and left the dissolved 0x21BA/0x1F8D fragment
// uncharged, forking the run on the spin counter (and dropping the dispatch count 42 -> 34).
function priceDissolved(m) {
  const probe = rehost(m);
  probe.routines.set(WALK_STEP, () => 0);
  const before = probe.cycles;
  oracle(probe);
  return probe.cycles - before;
}

// ---------------------------------------------------------------------------
// Crafted entries: a REAL capture with the seven written bytes poisoned and the accumulator
// re-seeded. Every poisoned byte is one this routine overwrites, so a correct rewrite leaves a
// state that does not depend on the poison at all — the poison is visible only when a write is
// missing or wrong. The capture's own stack, index register and shadow bank are left alone.
// ---------------------------------------------------------------------------
const POISON = 0x5b; // equal to nothing this routine writes, for any seeded accumulator below
const SEED_ACC = [0, 1, 0x37, 0xa5, 0xff];

function crafted(base, acc) {
  const e = base.clone();
  for (const [off] of WRITES) e.mem.write8(e.regs.ix + off, POISON);
  e.regs.a = acc;
  return e;
}

function craftedEntries(bases) {
  const out = [];
  for (const b of bases) for (const acc of SEED_ACC) out.push(crafted(b, acc));
  return out;
}

/** One capture per DISTINCT record base — the crafted arm is built on all 7, not on a repeat. */
function distinctBaseCaptures() {
  const seen = new Map();
  for (const c of captures()) if (!seen.has(c.regs.ix)) seen.set(c.regs.ix, c);
  return [...seen.values()].sort((x, y) => x.regs.ix - y.regs.ix);
}

// ===========================================================================
// 0. Reachability — measured first, because it decides what everything else can claim
// ===========================================================================

test("REACHABILITY: 0x2038 is dispatched in attract across every record base the sweep uses", () => {
  const caps = captures();
  assert.ok(caps.length > 0, "no real dispatch of 0x2038 was captured — every capture case below would be vacuous");

  const bases = [...new Set(caps.map((c) => c.regs.ix))].sort((x, y) => x - y);
  assert.equal(bases.length, 7, `expected all 7 record bases of the sweep, saw ${bases.length}`);
  assert.deepEqual(bases, [0x6700, 0x6720, 0x6740, 0x6760, 0x6780, 0x67a0, 0x67c0]);

  // The two narrownesses the crafted arm exists to widen — asserted, not asserted about.
  assert.ok(caps.every((c) => c.regs.a === 0), "attract presents exactly one accumulator value here");
  const alreadyZero = caps.filter((c) => c.mem.read8(c.regs.ix + X_FRACTION) === 0).length;
  assert.ok(
    alreadyZero >= caps.length - 1,
    `expected +${X_FRACTION} to already hold the written value on all but one capture, got ${alreadyZero}/${caps.length}`,
  );

  console.log(
    `  REACHABILITY: ${caps.length} dispatches in ${ATTRACT_FRAMES} attract frames; bases ` +
      `${bases.map(hx).join(", ")}; accumulator 0 on all ${caps.length}; +${X_FRACTION} already ` +
      `holds the written value on ${alreadyZero} of ${caps.length}`,
  );
});

// ===========================================================================
// 1. EQUAL on every real dispatch
// ===========================================================================

test("EQUAL (all real captures): loc_2038 == oracle over RAM − STACK_SCRATCH, final SP and return", () => {
  const caps = captures();
  const before = caps.length;
  const bad = sweep(caps, loc_2038);
  assert.equal(bad, null, describe(bad));
  assert.equal(caps.length, before, "the capture list grew during replay — the count above is not what was replayed");

  // Non-vacuity: the routine must actually have stamped all seven bytes on a real entry.
  const e = caps[0];
  const after = e.clone();
  loc_2038(after);
  for (const [off, val] of WRITES) {
    const want = val === "A" ? e.regs.a : val;
    assert.equal(after.mem.read8(e.regs.ix + off), want, `record byte +${off} was not stamped`);
  }

  console.log(
    `  EQUAL/captures: ${caps.length} of ${caps.length} real dispatches replayed, whole frozen ` +
      `chain on both sides; re-entrant dispatches during replay: ${LIVE_GROWTH} (delegated to the oracle)`,
  );
});

// ===========================================================================
// 2. EQUAL on crafted entries
// ===========================================================================

test("EQUAL (crafted): loc_2038 == oracle with all seven written bytes poisoned and A swept", () => {
  const bases = distinctBaseCaptures();
  assert.equal(bases.length, 7, "the crafted arm claims one entry per record base");
  const entries = craftedEntries(bases);
  assert.equal(entries.length, bases.length * SEED_ACC.length);

  const bad = sweep(entries, loc_2038);
  assert.equal(bad, null, describe(bad));

  console.log(
    `  EQUAL/crafted: ${entries.length} entries — all ${bases.length} captured record bases ` +
      `(${bases.map((b) => hx(b.regs.ix)).join(", ")}) x accumulator ${SEED_ACC.map(hb).join(",")}, ` +
      `all seven written bytes pre-poisoned to ${hb(POISON)}`,
  );
});

// ===========================================================================
// 3. TEETH — five twins, each the real routine with exactly one behaviour removed
// ===========================================================================

function twin(bug) {
  return (m) => {
    const { mem8 } = m;
    const record = m.regs.ix;
    const a = m.regs.a;
    const blank = bug === "hardcodedZero" ? 0 : a; // BUG: ignores the value handed in

    mem8[record + INITIAL_VY_HI] = bug === "wrongVelocityHigh" ? 0 : 255; // BUG: initial velocity sign
    if (bug !== "dropVelocityLow") mem8[record + INITIAL_VY_LO] = 240; // BUG: low byte never stamped
    mem8[record + AIRBORNE_FRAMES] = blank;
    mem8[record + SUBSTATE] = blank;
    if (bug !== "dropXFraction") mem8[record + X_FRACTION] = blank; // BUG: fraction left stale
    mem8[record + Y_FRACTION] = blank;
    mem8[record + ARM_SELECT] = bug === "wrongArm" ? 4 : 8; // BUG: record kept on a walking arm

    return m.call(0x21ba);
  };
}

const TWINS = ["wrongVelocityHigh", "dropVelocityLow", "dropXFraction", "wrongArm", "hardcodedZero"];

test("TEETH: five broken twins are caught, and the report says which half caught which", () => {
  const caps = captures();
  const craftedCases = craftedEntries(distinctBaseCaptures());

  // Sanity: the correct routine passes both suites, so a caught twin is a real defect signal and
  // not a suite that reds everything.
  assert.equal(sweep(caps, loc_2038), null, "the correct routine must pass the capture suite");
  assert.equal(sweep(craftedCases, loc_2038), null, "the correct routine must pass the crafted suite");

  const lines = [];
  for (const bug of TWINS) {
    const t = twin(bug);
    const onCaptures = sweep(caps, t);
    const onCrafted = sweep(craftedCases, t);
    assert.notEqual(onCrafted, null, `the CRAFTED suite failed to catch the "${bug}" twin`);
    assert.ok(
      onCaptures !== null || bug === "hardcodedZero",
      `the CAPTURE suite failed to catch the "${bug}" twin, and only "hardcodedZero" is expected to escape it`,
    );
    const nCap = breachCount(caps, t);
    const nCraft = breachCount(craftedCases, t);
    lines.push(
      `${bug}: captures ${onCaptures ? `CAUGHT on ${nCap}/${caps.length} (${onCaptures.kind} ${onCaptures.detail})` : `BLIND on all ${caps.length}`}` +
        `, crafted CAUGHT on ${nCraft}/${craftedCases.length} (${onCrafted.kind} ${onCrafted.detail})`,
    );
  }

  // The claim the header makes about WHY the crafted arm exists, asserted rather than asserted about:
  // attract's uniform accumulator makes the hardcoded-zero twin invisible to every real capture.
  assert.equal(sweep(caps, twin("hardcodedZero")), null,
    "attract was expected to be blind to the hardcoded-zero twin; if it is not, the crafted arm's stated purpose is wrong");

  console.log("  TEETH:\n    " + lines.join("\n    "));
});

// ===========================================================================
// 4. The live-out claim, measured over a whole run
// ===========================================================================

test("LIVE-OUT (measured): the rewrite wired live keeps a whole attract run byte-identical", () => {
  const trace = (overrides) => {
    const m = new Machine(ROM, overrides ? { overrides } : {});
    const frames = m.runFrames(ATTRACT_FRAMES);
    return { frames, addrOf: (o) => m.stateOffsetToAddr(o) };
  };

  // loc_2038 is cycle-free and, dissolved, so is the whole 0x21BA/0x1F8D fragment below it.
  // Cycle-free code charges none, which shifts the vblank interrupt and forks the run on the spin
  // counter a few hundred frames later for reasons that have nothing to do with this routine.
  // Restore the fragment's true oracle cost, measured per dispatch and charged at the frozen
  // walk-step boundary, then compare.
  let dispatches = 0;
  const wired = (mm) => {
    dispatches += 1;
    const owed = priceDissolved(mm);
    if (owed) mm.step(WALK_STEP, owed);
    return loc_2038(mm);
  };

  const base = trace(null);
  const cand = trace(new Map([[TARGET, wired]]));
  assert.ok(dispatches > 0, "the live run never dispatched 0x2038 — this comparison would be vacuous");
  assert.equal(dispatches, captures().length,
    `the live run dispatched 0x2038 ${dispatches} times but the capture run saw ${captures().length}`);
  assert.equal(base.frames.length, cand.frames.length, "the two runs did not reach the same frame count");

  let firstDiff = null;
  for (let f = 0; f < base.frames.length && firstDiff === null; f++) {
    const A = base.frames[f], B = cand.frames[f];
    for (let i = 0; i < A.length; i++) {
      if (A[i] === B[i]) continue;
      firstDiff = { frame: f, addr: base.addrOf(i), a: A[i], b: B[i] };
      break;
    }
  }
  assert.equal(
    firstDiff,
    null,
    firstDiff && `live run diverges at frame ${firstDiff.frame}, ${hx(firstDiff.addr ?? 0)} ` +
      `(oracle ${hb(firstDiff.a)} -> live ${hb(firstDiff.b)})`,
  );

  console.log(
    `  LIVE-OUT: ${ATTRACT_FRAMES} live frames, ${dispatches} real dispatches wired, ` +
      "fragment cost restored per dispatch at the walk-step boundary — every frame byte-identical " +
      "to the all-oracle baseline",
  );
});
