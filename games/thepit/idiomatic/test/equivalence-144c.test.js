// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence gate for routeIdleObjectByMoveCommand (ROM 0x144c) — the at-rest object's move-command router.
 * It reads the object's per-frame move command (in L), and on the first set direction bit
 * runs one of four still-oracle handlers (0x1493 / 0x167f / 0x1468 / 0x186f); with no
 * direction bit it clears the animation-phase byte 0x801a and either runs the goal handler
 * (when the goal latch 0x80e7 is set) or defers the frame through the record builder stageObjectSpriteRecord.
 *
 * OBSERVABLE-EQUIVALENCE CONTRACT. Every arm delegates: the four direction arms m.call the
 * SAME frozen oracle handler both sides run, so those chains are byte-identical; the idle
 * fall-through calls the already-decompiled stageObjectSpriteRecord DIRECTLY, which drops the stack frame
 * the oracle's tail-jump carried (its ret pops the caller return address, SP += 2, and its
 * body leaves different value registers). Those residuals are all DEAD — the caller reads no
 * register back from this router — so the gate compares OBSERVABLE state only: the full RAM
 * dump. pc, SP and the value registers are excluded. RAM is diffed in full with no exclusion
 * window: a tail-jump only READS the return address off the stack, it writes nothing there,
 * so no stack-scratch byte ever differs.
 *
 * REACHABILITY. The three direction arms are dispatched naturally in attract (measured: 286
 * dispatches over 2000 frames — the two-bit phase arm 227×, the tile-row arm 36×, the
 * position arm 23×), so they are gated on real captured entries. The two standing-still arms
 * never occur in attract (the demo always holds a direction), so they are gated on those same
 * real entries with the move command cleared and the goal latch poked set (goal handler) or
 * clear (record-builder deferral) — a real state with a surgical nudge, both sides identical.
 *
 * FIVE checks:
 *   1. EQUAL (real captured attract entries) — every naturally-dispatched arm leaves the same
 *      RAM as the oracle. Proves it on real machine states across the reached arms.
 *   2. EQUAL (crafted standing-still arms) — with the command cleared and the goal latch set
 *      then clear, both the goal-handler arm and the record-builder-deferral arm match.
 *   3. NON-VACUOUS — on the record-builder arm, pre-set the phase byte to a sentinel and
 *      confirm both arms reset it to 0 and agree, so a no-op twin cannot pass.
 *   4. TEETH (mis-route) — a twin that always defers to the record builder (ignoring the
 *      command bits) MUST be caught: on a phase-arm entry it runs the wrong handler.
 *   5. TEETH (dropped register pass-through) — a twin that zeroes the position delta before
 *      the still-oracle position handler MUST be caught: the handler then plots elsewhere.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-144c.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_144c as oracle } from "../../translated/loc_144c.js";
import { routeIdleObjectByMoveCommand as idiomatic } from "../routeIdleObjectByMoveCommand.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { GOAL_TILE_LATCH } from "../ram.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x144c;
const PLAYER_ANIM_PHASE = 0x801a; // the object's animation-phase byte, reset on the idle path
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is
// async, so build the factory once.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/** Classify which arm an entry takes, purely from its inputs (L and the goal latch). */
function armOf(entry) {
  const l = entry.regs.l;
  if (l & 0x01) return "position";
  if (l & 0x02) return "tileRow";
  if (l & 0x0c) return "phase";
  return entry.mem.read8(GOAL_TILE_LATCH) !== 0 ? "goal" : "defer";
}

/**
 * Hook 0x144c in a real attract run and clone the machine at each dispatch, keeping up to
 * `perArm` entries per naturally-reached arm. Each clone is a genuine mid-play machine state.
 */
function captureEntries(maxFrames, perArm) {
  const byArm = new Map();
  const snapshot = new Map([[TARGET, (mm) => {
    const arm = armOf(mm);
    const list = byArm.get(arm) ?? [];
    if (list.length < perArm) { list.push(mm.clone()); byArm.set(arm, list); }
    return oracle(mm);
  }]]);
  const host = makeMachine(snapshot);
  host.runFrames(maxFrames);
  return byArm;
}

/** Run oracle and candidate on independent clones of `entry`; return the first differing
 *  RAM byte (or null). RAM only — pc/SP/value registers are the declared-dead live-out. */
function ramDiff(entry, fn) {
  const a = entry.clone(); // oracle
  const b = entry.clone(); // candidate
  oracle(a);
  fn(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

// -- 1. EQUAL over real captured attract entries (naturally-reached arms) ------

test("EQUAL: routeIdleObjectByMoveCommand leaves the same RAM as the oracle over real captured attract entries", () => {
  const byArm = captureEntries(2000, 6);
  const reached = [...byArm.keys()].sort();
  assert.ok(reached.length >= 1, "expected at least one 0x144c dispatch during attract");

  let n = 0;
  for (const [arm, entries] of byArm) {
    for (const entry of entries) {
      const d = ramDiff(entry, idiomatic);
      assert.equal(d, null, d && `${arm}: RAM diff at ${hx(d.addr ?? 0)}: oracle=${d.a} idiomatic=${d.b}`);
      n++;
    }
  }
  console.log(`  EQUAL: ${n} real captured entries across arms [${reached.join(", ")}] — RAM identical to the oracle`);
});

// -- 2. EQUAL over the crafted standing-still arms -----------------------------

test("EQUAL (crafted idle arms): move command cleared, goal latch set then clear, both match", () => {
  const byArm = captureEntries(2000, 1);
  // Any real 0x144c entry is a faithful base for the idle arms — the router reads only L and
  // the goal latch, both poked here. Prefer a phase-arm entry (most common); fall back to any.
  const base = (byArm.get("phase") ?? [...byArm.values()][0])[0];
  assert.ok(base, "need a real 0x144c entry to craft the idle arms from");

  for (const latch of [0x27, 0x00]) {
    const entry = base.clone();
    entry.regs.l = 0x00; // clear the move command -> the standing-still fall-through
    entry.mem.write8(GOAL_TILE_LATCH, latch); // set -> goal handler; clear -> record builder
    const d = ramDiff(entry, idiomatic);
    assert.equal(
      d,
      null,
      d && `latch=${hx(latch)}: RAM diff at ${hx(d.addr ?? 0)}: oracle=${d.a} idiomatic=${d.b}`,
    );
  }
  console.log("  EQUAL/crafted: goal-handler arm and record-builder-deferral arm both identical to the oracle");
});

// -- 3. NON-VACUOUS: the idle path really resets the phase byte ----------------

test("NON-VACUOUS: with the phase byte pre-set to a sentinel, both arms reset it to 0 and agree", () => {
  const byArm = captureEntries(2000, 1);
  const base = (byArm.get("phase") ?? [...byArm.values()][0])[0];
  assert.ok(base, "need a real 0x144c entry to seed the non-vacuous check");

  const SENTINEL = 0x55;
  const entry = base.clone();
  entry.regs.l = 0x00; // standing-still fall-through
  entry.mem.write8(GOAL_TILE_LATCH, 0x00); // record-builder arm (does not touch the phase byte)
  entry.mem.write8(PLAYER_ANIM_PHASE, SENTINEL);

  const a = entry.clone(); // oracle
  const b = entry.clone(); // idiomatic
  oracle(a);
  idiomatic(b);

  assert.notEqual(b.mem.read8(PLAYER_ANIM_PHASE), SENTINEL, "idiomatic left the phase byte unwritten");
  assert.equal(b.mem.read8(PLAYER_ANIM_PHASE), 0, "idiomatic did not reset the phase byte to 0");
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.equal(d, null, d && `RAM diff at ${hx(d.addr ?? 0)}: oracle=${d.a} idiomatic=${d.b}`);
  console.log("  NON-VACUOUS: phase byte reset from the sentinel to 0, arms agree");
});

// -- 4. TEETH (mis-route): always-defer twin is caught ------------------------

/** Broken twin: ignores the command bits and always defers to the record builder. */
function twinAlwaysDefer(m) {
  const { mem8 } = m;
  mem8[PLAYER_ANIM_PHASE] = 0;
  return m.call(0x1b5b); // BUG: skips the direction-bit handlers
}

test("TEETH (mis-route): a twin that ignores the command bits is CAUGHT on a phase-arm entry", () => {
  const byArm = captureEntries(2000, 1);
  const entry = (byArm.get("phase") ?? [])[0];
  assert.ok(entry, "expected a phase-arm (0x0c) dispatch during attract to seed the teeth check");

  const d = ramDiff(entry, twinAlwaysDefer);
  assert.notEqual(d, null, "the gate FAILED to catch an always-defer twin — it proves nothing");

  // and the correct routine is EQUAL on the very same entry
  assert.equal(ramDiff(entry, idiomatic), null, "idiomatic must pass the entry the twin fails");
  console.log(`  TEETH/mis-route: always-defer twin caught at ${hx(d.addr ?? 0)} (oracle=${d.a} broken=${d.b})`);
});

// -- 5. TEETH (dropped register pass-through): clobbered delta is caught -------

/** Broken twin: zeroes the object's position delta (E) before the still-oracle handler. */
function twinClobberDelta(m) {
  m.regs.e = 0; // BUG: the position handler reads E; the correct router passes it through
  return idiomatic(m);
}

test("TEETH (register pass-through): a twin that zeroes the position delta is CAUGHT", () => {
  const byArm = captureEntries(2000, 6);
  // Find a position-arm entry whose delta is nonzero, so zeroing it actually changes the plot.
  const cand = (byArm.get("position") ?? []).find((e) => e.regs.e !== 0);
  assert.ok(cand, "expected a position-arm (bit0) dispatch with a nonzero delta to seed the teeth check");

  const d = ramDiff(cand, twinClobberDelta);
  assert.notEqual(d, null, "the gate FAILED to catch a clobbered-delta twin — the pass-through is unguarded");

  assert.equal(ramDiff(cand, idiomatic), null, "idiomatic must pass the entry the twin fails");
  console.log(`  TEETH/pass-through: clobbered-delta twin caught at ${hx(d.addr ?? 0)} (oracle=${d.a} broken=${d.b})`);
});
