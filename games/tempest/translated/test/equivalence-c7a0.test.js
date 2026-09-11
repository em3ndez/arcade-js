// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_c7a0 (ROM 0xc7a0). The main frame loop: jsr cd95, then forever wait for
// frame counter $53>=9, clear it, and run jsr c7bd/c891/b1b6. It never returns (an IRQ advances $53),
// so the harness stops it by throwing when a chosen callee is reached.
// Run: node --test games/tempest/translated/test/equivalence-c7a0.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_c7a0 } from "../loc_c7a0.js";

const STOP = Symbol("stop");

function makeMachine(opts = {}) {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const frameReads = opts.frameReads; // optional array of successive $53 values
  let readIdx = 0;
  const mem = {
    read8: (a) => {
      if ((a & 0xffff) === 0x53 && frameReads) {
        const v = frameReads[Math.min(readIdx, frameReads.length - 1)];
        readIdx++;
        return v & 0xff;
      }
      return ram[a & 0xffff];
    },
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, pcSeq: [], calls: [], get reads() { return readIdx; },
    step(next, c) { this.pc = next; this.cycles += c; this.pcSeq.push(next); },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) {
      this.calls.push(a);
      if (this._retPushed) { this._retPushed = false; this.pull16(); }
      if (a === opts.stopTarget) throw STOP;
      return undefined;
    },
  };
}

test("loc_c7a0: $53>=9 -> wait exits at once, clears $53/$00, first frame jsr chain reaches c7bd, 29 T", () => {
  const m = makeMachine({ stopTarget: 0xc7bd });
  m.regs.s = 0xfd;
  m.mem.write8(0x53, 0x09);

  try { loc_c7a0(m); assert.fail("should not return"); }
  catch (e) { if (e !== STOP) throw e; }

  assert.deepEqual(m.calls, [0xcd95, 0xc7bd], "jsr cd95 then first-frame jsr c7bd");
  assert.equal(m.mem.read8(0x53), 0x00, "$53 cleared at c7af");
  assert.equal(m.mem.read8(0x00), 0x00, "$00 cleared at c7a5");
  assert.equal(m.cycles, 29, "6 + 2 + 3 + (3+2+2) + 2 + 3 + 6");
});

test("loc_c7a0: wait loop spins while $53<9 (reads 3,7 -> loop, 9 -> exit), 3 reads", () => {
  const m = makeMachine({ stopTarget: 0xc7bd, frameReads: [3, 7, 9] });
  m.regs.s = 0xfd;

  try { loc_c7a0(m); assert.fail("should not return"); }
  catch (e) { if (e !== STOP) throw e; }

  assert.equal(m.reads, 3, "$53 read three times: 3(<9), 7(<9), 9(>=9 exit)");
  assert.deepEqual(m.calls, [0xcd95, 0xc7bd]);
});
