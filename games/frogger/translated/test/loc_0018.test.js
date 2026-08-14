// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_0018 (Frogger rst 0x18 = sound-command enqueue, ROM 0x0018-0x0027). Reads
// 0x83fe (playing flag): if 0, `ret z` drops the command; else bumps the ring head at 0x8300 and
// stores command byte C at 0x83<head> (push/pop HL around it). Full listing in loc_0018.js.
// Two contracts: PLAYING (0x83fe != 0) bumps head + stores at the slot (96 T); IDLE takes ret z, no
// write (32 T).

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0018 } from "../loc_0018.js";

const SENTINEL = 0xbeef; // the return address the caller's `rst 0x18` pushed; loc_0018's ret lands here

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800;
  m.push16(SENTINEL); // simulate the rst 0x18 push so the routine's ret is balanced
  return m;
}

function runPlay(fn) {
  const m = mk();
  m.regs.a = 0x2a;                 // command byte
  m.mem.workRam[0x03fe] = 0x01;    // 0x83fe: playing
  m.mem.workRam[0x0300] = 0x05;    // 0x8300: ring head starts at 5
  const c0 = m.cycles;
  fn(m);
  return { cycles: m.cycles - c0, head: m.mem.workRam[0x0300], slot: m.mem.workRam[0x0306], sp: m.regs.sp, pc: m.pc };
}

function checkPlay(res) {
  assert.equal(res.cycles, 96, "T-state total, playing path");
  assert.equal(res.head, 0x06, "ring head bumped 5 -> 6");
  assert.equal(res.slot, 0x2a, "command stored at 0x8306 (the new head slot)");
  assert.equal(res.sp, 0x8800, "HL push/pop balanced; ret consumed the caller's return (SP restored)");
  assert.equal(res.pc, SENTINEL, "ret landed on the caller's return address");
}

test("loc_0018: enqueue while playing bumps the head and stores the command; 96 T", () => {
  checkPlay(runPlay(loc_0018));
});

test("loc_0018: idle (0x83fe == 0) takes ret z and enqueues nothing; 32 T", () => {
  const m = mk();
  m.regs.a = 0x2a;
  m.mem.workRam[0x0300] = 0x05;
  const c0 = m.cycles;
  loc_0018(m);
  assert.equal(m.cycles - c0, 32, "ld c,a(4)+ld a(13)+or a(4)+ret z taken(11)");
  assert.equal(m.mem.workRam[0x0300], 0x05, "ring head untouched when not playing");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_0018.js
//   find: mem.write8(regs.hl, regs.c);
//   repl: mem.write8(regs.hl, regs.a);
//   expect: FAIL  (stores the head INDEX (A holds it after `ld a,(hl); ld l,a`)
//                  instead of the command C -- caught by slot == 0x2a)
//   verified-anchor: count == 1  (the sole ring-slot store in loc_0018.js)
test("loc_0018: the contract catches storing the wrong byte into the ring", () => {
  const mutant = (m) => {
    const { regs, mem } = m;
    regs.c = regs.a; m.step(0x0019, 4);
    regs.a = mem.read8(0x83fe); m.step(0x001c, 13);
    regs.or(regs.a); m.step(0x001d, 4);
    if (regs.fZ) { m.ret(11); return; }
    m.step(0x001e, 5);
    m.push16(regs.hl); m.step(0x001f, 11);
    regs.hl = 0x8300; m.step(0x0022, 10);
    regs.incMem8(mem, regs.hl); m.step(0x0023, 11);
    regs.a = mem.read8(regs.hl); m.step(0x0024, 7);
    regs.l = regs.a; m.step(0x0025, 4);
    mem.write8(regs.hl, regs.a); m.step(0x0026, 7); // MUTANT: stores A (head), not C
    regs.hl = m.pop16(); m.step(0x0027, 10);
    m.ret();
  };
  assert.throws(() => checkPlay(runPlay(mutant)));
});
