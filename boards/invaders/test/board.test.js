// SPDX-License-Identifier: GPL-3.0-only
/**
 * Space Invaders board-hardware tests (mw8080bw PCB, Intel 8080). Modeled on
 * boards/pooyan/test/board.test.js.
 *
 * Subject: boards/invaders/{memory,io}.js -- the pure ROM+RAM address space (map decode, the
 * .mirror(0x4000) RAM alias, unmapped-throws, the 8KB state dump) and the 8080 IN/OUT PORT
 * device surface (mb14241 shift register, input-port routing + global_mask 0x7, watchdog,
 * sound latches, EI/DI interrupt-enable). No ROM image needed, so this runs on a fresh clone
 * before the (gitignored) invaders romset is present.
 *
 * All grounding is MAME: midw8080/mw8080bw.cpp (invaders main_map @313, io_map @2645) and
 * devices/machine/mb14241.cpp -- never the JS itself.
 * Run: node --test boards/invaders/test/board.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  AddressSpace, UnmappedAccess,
  ROM_END, RAM_BASE, RAM_END, STATE_DUMP_SIZE,
} from "../memory.js";
import { Io, NotImplemented } from "../io.js";

const rom = () => new Uint8Array(ROM_END + 1); // main_map @316: 0x0000-0x1fff = 8KB ROM
const space = (io = new Io()) => new AddressSpace(rom(), io);

// ---- MEMORY: AddressSpace ---------------------------------------------------------------

test("ROM must be exactly 8KB (0x0000-0x1FFF); wrong sizes throw", () => {
  assert.equal(ROM_END, 0x1fff);
  assert.throws(() => new AddressSpace(new Uint8Array(0x1000), new Io()), /8192-byte ROM/);
  // Strict equality, not a >= floor: an oversized image is rejected too.
  assert.throws(() => new AddressSpace(new Uint8Array(0x4000), new Io()), /8192-byte ROM/);
  assert.doesNotThrow(() => new AddressSpace(new Uint8Array(0x2000), new Io()));
});

test("ROM reads return the image byte; ROM writes throw (main_map .rom().nopw -> here THROW)", () => {
  const r = rom();
  r[0x0000] = 0xc3; r[0x1fff] = 0x76; // JMP at reset vector, HLT at top of ROM
  const m = new AddressSpace(r, new Io());
  assert.equal(m.read8(0x0000), 0xc3);
  assert.equal(m.read8(0x1fff), 0x76);
  assert.throws(() => m.write8(0x0000, 0x00), UnmappedAccess);
  assert.throws(() => m.write8(0x1fff, 0x00), UnmappedAccess);
});

test("RAM round-trips across 0x2000-0x3FFF (work RAM + framebuffer)", () => {
  const m = space();
  m.write8(RAM_BASE, 0x11);       // 0x2000 work RAM
  m.write8(0x2400, 0x22);         // framebuffer start
  m.write8(RAM_END, 0x33);        // 0x3fff top of RAM
  assert.equal(m.read8(RAM_BASE), 0x11);
  assert.equal(m.read8(0x2400), 0x22);
  assert.equal(m.read8(RAM_END), 0x33);
});

test(".mirror(0x4000): 0x6000-0x7FFF aliases the SAME RAM (write one side, read the other)", () => {
  // main_map @317: map(0x2000,0x3fff).mirror(0x4000).ram() -- bit 0x4000 is don't-care, one 8KB RAM.
  const m = space();
  m.write8(0x2000, 0xa5);
  assert.equal(m.read8(0x6000), 0xa5, "write @0x2000 reads back @0x6000");
  m.write8(0x7fff, 0x5a);
  assert.equal(m.read8(0x3fff), 0x5a, "write @0x7fff reads back @0x3fff");
  // Mutation: the mirror is an ALIAS, not a second RAM -- overwriting via the mirror is visible at base.
  m.write8(0x6001, 0x3c);
  assert.equal(m.read8(0x2001), 0x3c, "0x6001 and 0x2001 are one cell");
});

test("read16/write16 are little-endian within RAM", () => {
  const m = space();
  m.write16(0x2000, 0x1234);
  assert.equal(m.read8(0x2000), 0x34, "low byte first");
  assert.equal(m.read8(0x2001), 0x12, "high byte second");
  assert.equal(m.read16(0x2000), 0x1234);
});

test("state dump is the whole 8KB main_ram; offset<->addr is inverse at both ends", () => {
  assert.equal(STATE_DUMP_SIZE, 8192);
  const m = space();
  assert.equal(m.dumpState().length, 8192);
  assert.equal(m.stateOffsetToAddr(0), RAM_BASE);
  assert.equal(m.stateOffsetToAddr(8191), RAM_END);
  m.write8(0x2400, 0x7e);
  assert.equal(m.dumpState()[0x2400 - RAM_BASE], 0x7e, "dump reflects a written cell");
});

test("unmapped access throws loudly (board throws where main_map leaves empty/absent)", () => {
  // 0x4000-0x5fff is main_map @318 .rom().nopw() but EMPTY on the Midway 4x2KB set and never read by
  // the 8KB program; the board treats it (and everything past RAM) as unmapped -> THROW (dkong/pooyan
  // discipline: catch a decompiler stray access instead of silently returning 0).
  const m = space();
  assert.throws(() => m.read8(0x4000), UnmappedAccess, "0x4000 empty ROM region -> throw");
  assert.throws(() => m.read8(0x8000), UnmappedAccess, "0x8000 above the map -> throw");
  assert.throws(() => m.write8(0x8000, 0x00), UnmappedAccess);
});

test("no memory-mapped hardware writes on this board (devices live on the port bus)", () => {
  // main_map is rom+ram only; io_map @2645 is where every device sits, so isHardwareWrite is never true.
  for (const a of [0x2000, 0x2400, 0x3fff, 0x6000, 0x0000]) {
    assert.equal(AddressSpace.isHardwareWrite(a), false, `0x${a.toString(16)} not a hw write`);
  }
});

// ---- IO: Io (8080 IN/OUT port space) ----------------------------------------------------

test("mb14241 shift: worked OUT4/OUT2/IN3 sequence matches mb14241.cpp for every offset", () => {
  // mb14241.cpp: data_w reg=(reg>>8)|(data<<7); count_w count=~data&7; result_r (reg>>count)&0xff.
  // That composes to result = (concat >> (8-offset)) & 0xff, concat = {last:prev} = 0xaaff here.
  const io = new Io();
  io.portOut(4, 0xff); // prev byte
  io.portOut(4, 0xaa); // last byte -> concat 0xaaff
  const expect = [0xaa, 0x55, 0xab, 0x57, 0xaf, 0x5f, 0xbf, 0x7f];
  for (let off = 0; off < 8; off++) {
    io.portOut(2, off);
    assert.equal(io.portIn(3), expect[off], `offset ${off}`);
  }
  // Mutation: offset 4 (0xAF) blends BOTH bytes -- an impl that ignored the offset would read 0xaa,
  // one that dropped the older byte would never produce the interleaved 0x?F/0x?? values.
  io.portOut(2, 4);
  assert.equal(io.portIn(3), 0xaf);
});

test("mb14241 shift: high bits of the OUT2 count byte are don't-care (only low 3)", () => {
  // count_w masks &7; the JS reads (value & 0x07). 0xfc -> offset 4, same as OUT2 4 above.
  const io = new Io();
  io.portOut(4, 0xff); io.portOut(4, 0xaa);
  io.portOut(2, 0xfc);
  assert.equal(io.portIn(3), 0xaf, "0xfc low-3 == 4");
});

test("IN ports route: 0->IN0, 1->IN1, 2->IN2, 3->shift result (io_map @2635-2649)", () => {
  const io = new Io();
  io.in0 = 0x81; io.in1 = 0x42; io.in2 = 0x24;
  io.portOut(4, 0x00); io.portOut(4, 0x99); io.portOut(2, 0); // shift result -> 0x99
  assert.equal(io.portIn(0), 0x81);
  assert.equal(io.portIn(1), 0x42);
  assert.equal(io.portIn(2), 0x24);
  assert.equal(io.portIn(3), 0x99);
});

test("port decode masks to 3 bits (io_map @2634 global_mask 0x7)", () => {
  const io = new Io();
  io.in0 = 0x5a;
  assert.equal(io.portIn(0x08), 0x5a, "IN 0x08 aliases IN 0 (mask 0x7)");
  io.portOut(0x0c, 0x33); // OUT 0x0c aliases OUT 4 (shift data)
  io.portOut(0x0a, 0);    // OUT 0x0a aliases OUT 2 (offset 0)
  assert.equal(io.portIn(0x0b), 0x33, "IN 0x0b aliases IN 3, reads the shifted data");
});

test("OUT 6 kicks the watchdog (io_map @2642 watchdog reset_w)", () => {
  const io = new Io();
  assert.equal(io.watchdogKicks, 0);
  io.portOut(6, 0x00);
  io.portOut(6, 0xff);
  assert.equal(io.watchdogKicks, 2, "each OUT6 is one kick; the data byte is ignored");
});

test("OUT 3 / OUT 5 latch the two sound ports and fire the audio sink (io_map_noshift @2640/2641)", () => {
  const io = new Io();
  const seen = [];
  io.onSoundWrite = (port, v) => seen.push([port, v]);
  io.portOut(3, 0x2a);
  io.portOut(5, 0x1b);
  assert.deepEqual(io.soundData, [0x2a, 0x1b]);
  assert.deepEqual(seen, [[3, 0x2a], [5, 0x1b]], "callback carries the OUT port number, not the index");
});

test("mixed-polarity inputs: active-high START1 sets, active-low COIN1 clears from its idle pull-up", () => {
  // io.js folds each pressed bit per its driver polarity (mw8080bw INPUT_PORTS): START1 (IN1 b2) is
  // active-high; COIN1 (IN1 b0) and the unused pull-up (IN1 b3) are active-low (idle 1, pressed 0).
  const io = new Io();
  assert.equal(io.portIn(1), 0x09, "idle IN1 = COIN + unused pull-ups (0x01 | 0x08)");
  io.inputAssert = { 1: 0x04 }; // START1 (active-high) -> bit2 set
  assert.equal(io.portIn(1), 0x0d, "0x09 idle with START1 bit2 set");
  io.inputAssert = { 1: 0x01 }; // COIN1 (active-low) -> bit0 CLEARED
  assert.equal(io.portIn(1), 0x08, "coin press clears bit0 from the idle-high; unused bit3 stays");
  io.inputAssert = null;
  assert.equal(io.portIn(1), 0x09, "released reads idle");
});

test("--input targeting a non-input port is rejected (only 0,1,2 are input ports)", () => {
  const io = new Io();
  io.inputAssert = { 3: 0x01 }; // 3 is the shift-result read, not an input port
  assert.throws(() => io.portIn(0), NotImplemented);
});

test("EI/DI drive the interrupt-enable flip-flop read by the 2-RST gate", () => {
  // 8080 EI/DI set INTE; the vblank/mid-screen RST gate is masked by it (machine.js reads nmiMask).
  const io = new Io();
  assert.equal(io.nmiMask, false, "INTE clear at construction");
  io.setInte(true);
  assert.equal(io.nmiMask, true);
  io.setInte(false);
  assert.equal(io.nmiMask, false);
});

test("unimplemented OUT port throws NotImplemented (no io_map write handler for port 1)", () => {
  // io_map writes exist only for 2,3,4,5,6; port 1 has no .w() -> the board throws rather than silently drop.
  const io = new Io();
  assert.throws(() => io.portOut(1, 0x00), NotImplemented);
});

test("loadStateFrom copies the full port state (state-diff restore)", () => {
  const a = new Io();
  a.in0 = 0x11; a.in1 = 0x22; a.in2 = 0x33;
  a.portOut(4, 0xde); a.portOut(4, 0xad); a.portOut(2, 3);
  a.portOut(6, 0); a.setInte(true); a.soundData = [0x77, 0x88];
  const b = new Io();
  b.loadStateFrom(a);
  assert.equal(b.portIn(3), a.portIn(3), "shift register carried over");
  assert.deepEqual([b.in0, b.in1, b.in2], [0x11, 0x22, 0x33]);
  assert.equal(b.watchdogKicks, a.watchdogKicks);
  assert.equal(b.nmiMask, true);
  assert.deepEqual(b.soundData, [0x77, 0x88]);
  b.soundData[0] = 0; // was sliced, not aliased
  assert.equal(a.soundData[0], 0x77);
});
