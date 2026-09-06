// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_145c — crafted-entry equivalence vs the frozen slot-activation handler.
 * Live-outs: memory — the trigger flag at (HL) cleared, the object record at IX (active=1, phase=0,
 * spawn code, source index), and the command word appended to the queue at 0x40a0 (delegates the
 * enqueue) — all covered by ramDiff; and a register — HL is returned unchanged (the caller reads its
 * low byte back), checked with a regDiff helper. The source index is the low byte of the trigger
 * pointer. Positive controls prove the oracle mutates; teeth show a no-op, a wrong source index, a
 * RAM scribble, and an HL-clobber twin each diverge.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { loc_145c as cand } from "../loc_145c.js";
import { loc_145c as oracle } from "../../translated/loc_145c.js";
import { OBJ_TABLE, loc_40a0, loc_4000 } from "../names.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const OBJ = OBJ_TABLE; // object-record base seated in IX
const TRIGGER = 0x4108; // trigger-flag pointer (HL); low byte 0x08 is the source index
const SPAWN_CODE = 0x25;
const HEAD_START = 0xc0; // free queue write-head we seat
const SLOT = loc_4000 + HEAD_START;

const F_ACTIVE = 0, F_PHASE = 2, F_SPAWN_CODE = 6, F_SOURCE = 7;

const seeded = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mm.regs.ix = OBJ;
  mm.regs.hl = TRIGGER; // also sets L = 0x08 (the source index)
  mm.regs.c = SPAWN_CODE;
  mem[TRIGGER] = 1; // armed, so clearing to 0 is observable
  mem[OBJ + F_ACTIVE] = 0;
  mem[OBJ + F_PHASE] = 7; // nonzero, so the clear is observable
  mem[loc_40a0] = HEAD_START;
  mem[SLOT] = 0x80; // slot free (bit 7)
});

// HL is a register live-out (not in the state dump); read it off the machine directly.
function hlAfter(fn, entry) {
  const m = entry.clone(); m.routines = STUBS; fn(m); return m.regs.hl;
}

function runOracle(entry) {
  const a = entry.clone(); a.routines = STUBS; oracle(a); return a;
}

test("EQUAL (crafted): loc_145c == oracle activates the slot and enqueues", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, seeded()), null, "loc_145c diverged in RAM");
  assert.equal(hlAfter(cand, seeded()), hlAfter(oracle, seeded()), "HL live-out diverged");
  console.log("  EQUAL: loc_145c == oracle (RAM + HL preserved)");
});

test("positive controls: the oracle actually mutates", { skip }, () => {
  const a = runOracle(seeded());
  assert.equal(a.mem8[TRIGGER], 0, "trigger flag not consumed");
  assert.equal(a.mem8[OBJ + F_ACTIVE], 1, "slot not activated");
  assert.equal(a.mem8[OBJ + F_PHASE], 0, "phase not cleared");
  assert.equal(a.mem8[OBJ + F_SPAWN_CODE], SPAWN_CODE, "spawn code not stored");
  assert.equal(a.mem8[OBJ + F_SOURCE], TRIGGER & 0xff, "source index not stored");
  assert.equal(a.mem8[SLOT], 1, "command hi byte not enqueued");
  assert.equal(a.mem8[loc_4000 + HEAD_START + 1], TRIGGER & 0xff, "command lo byte not enqueued");
  assert.equal(a.mem8[loc_40a0], (HEAD_START + 2) & 0xff, "write-head not advanced");
  assert.equal(hlAfter(oracle, seeded()), TRIGGER, "HL not preserved");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongSource = (m) => { oracle(m); m.mem8[m.regs.ix + F_SOURCE] ^= 1; };
  const scribble = (m) => { cand(m); m.mem8[OBJ + 16] ^= 0xff; };
  const clobberHl = (m) => { cand(m); m.regs.hl = (m.regs.hl + 1) & 0xffff; };

  assert.ok(ramDiff(oracle, noOp, seeded()), "no-op escaped");
  assert.ok(ramDiff(oracle, wrongSource, seeded()), "wrong-source escaped");
  assert.ok(ramDiff(oracle, scribble, seeded()), "scribble escaped (ramDiff teeth)");
  assert.notEqual(hlAfter(clobberHl, seeded()), hlAfter(oracle, seeded()), "HL-clobber escaped (regDiff teeth)");
  console.log("  TEETH: no-op, wrong-source, scribble (RAM), HL-clobber (reg) all caught");
});
