// SPDX-License-Identifier: GPL-3.0-only
//
// Galaxian machine — the Galaxian/Scramble-family coroutine/NMI engine (as boards/frogger + timeplt), on
// the Namco Galaxian board (boards/galaxian). Differences from frogger are only the board wiring and the
// custom-discrete-sound board (no sound CPU). Timing (60.606 Hz / 50688 cyc/frame) and the vblank-NMI model
// match frogger. SKELETON: translated/ holds only the routines decompiled so far, so reset() dispatches
// 0x0000 and throws NotImplemented at the first unresolved m.call gap — the boot-gap crawl (§3) worklist.

import { AddressSpace } from "../../boards/galaxian/memory.js";
import { Io, NotImplemented } from "../../boards/galaxian/io.js";
import {
  SCREEN_W,
  SCREEN_H,
  decodeGraphics,
  renderFrameRGB,
  renderRowsRGB,
} from "../../boards/galaxian/video.js";
import { Regs } from "../../core/cpu/z80.js";
import { makeIndexedView } from "../../core/mem-views.js";
import { buildRoutines } from "./routines.js";

/** 3072000 / 60.606061 = 50688. boards/galaxian/hardware.json cyclesPerFrame; galaxian.cpp:7499. */
export const CYCLES_PER_FRAME = 50688;

/** The vblank NMI vector. Asserted only while the irq_enable latch (0x7001 D0) is set. */
export const NMI_VECTOR = 0x0066;

/**
 * Zero: screen_vblank() asserts at vbstart, which IS our frame origin. Derived from the driver, not
 * measured. galaxian.cpp:761-767, 7501.
 */
export const NMI_CYCLE_IN_FRAME = 0;

/** 50688 / VTOTAL 264 lines. Render-timing only (raster capture); galaxian exposes no CPU scanline read. */
export const CYCLES_PER_SCANLINE = 192;

/**
 * From the frame origin (vpos = vbstart = 240) to the first visible line (vpos = vbend = 16), wrapping at
 * VTOTAL 264: (264-240)+16 = 40 lines. Render-timing only; derived from the driver, not measured.
 */
export const VBLANK_LINES = 40;

export class FramesComplete extends Error {
  constructor() {
    super("frame budget exhausted");
    this.name = "FramesComplete";
  }
}

export class Machine {
  constructor(rom, routines, opts = {}) {
    // Two forms. Legacy (internal): (rom, routinesMap, opts). Browser worker convention: (rom, opts) —
    // when the 2nd arg is not a routines Map, treat it as opts and build routines here (oracle table +
    // opts.overrides), so web/worker.js can call `new Machine(rom, {inputs, ...gfx, overrides})` sync.
    if (!(routines instanceof Map)) {
      opts = routines || {};
      routines = buildRoutines();
      if (opts.overrides) for (const [addr, fn] of opts.overrides) routines.set(Number(addr), fn);
    }
    this.io = new Io();
    this.mem = new AddressSpace(rom, this.io);
    this.regs = new Regs();
    this.routines = routines;

    // Retained so clone() can rebuild an identical machine from the same inputs.
    this.rom = rom;
    this.assets = opts;

    this.mem8 = makeIndexedView(this.mem, 8);
    this.mem16 = makeIndexedView(this.mem, 16);

    // MAME Z80 reset state, same for every MAME Z80 (boards/galaxian/hardware.json z80Reset).
    this.regs.af = 0x0040;
    this.regs.bc = 0;
    this.regs.de = 0;
    this.regs.hl = 0;
    this.regs.ix = 0xffff;
    this.regs.iy = 0xffff;
    this.regs.sp = 0;

    this.cycles = 0;
    this.pc = 0;
    this.pcKnown = true;
    this.frames = [];
    this.maxFrames = opts.maxFrames ?? Infinity;
    this.maxCycles = opts.maxCycles ?? Infinity;
    this.nextBoundary = CYCLES_PER_FRAME;
    this.nextNmi = NMI_CYCLE_IN_FRAME;
    this.nmiCount = 0;
    this.stoppedBy = null;

    // Decoded once or not at all. gfx1 is ONE region used as BOTH the tile and sprite source
    // (galaxian_charlayout/spritelayout read different strides of the same halves). Without the gfx + proms
    // images this.video stays null and the raster hooks are inert.
    this.video = opts.gfx && opts.proms ? decodeGraphics(opts.gfx, opts.gfx, opts.proms) : null;

    // Raster capture, off by default.
    this.captureVideo = false;
    this.videoFrames = [];
    this.onVideoFrame = null;
    this.rasterBuf = null;
    this.rasterRow = 0;
    this.nextRowCycle = 0;
    this.droppedFrames = 0;

    this.mem.clock = () => this.cycles;

    // NOTE: galaxian_map exposes NO CPU-readable scanline/vpos counter; the ROM's frame timing comes only
    // from the vblank NMI, so there is nothing else to wire here.
  }

  static async create(rom, opts = {}) {
    const routines = buildRoutines();
    if (opts.overrides) for (const [addr, fn] of opts.overrides) routines.set(Number(addr), fn);
    return new Machine(rom, routines, opts);
  }

  reset() {
    this.call(0x0000);
    this.booted = true;
  }

  step(nextAddr, cycles) {
    this.pc = nextAddr;
    this.pcKnown = true;
    this.mem.pc = nextAddr;
    this.tick(cycles);
  }

  tick(n) {
    this.cycles += n;

    // DRAIN BEFORE THE BOUNDARY — the ORDER is the guarantee. Entering the boundary loop needs cycles past
    // every row's due time, so draining first paints them all.
    this.drainRaster();

    while (this.cycles >= this.nextBoundary && this.frames.length < this.maxFrames) {
      // Frame N is about to execute: assert its inputs and apply its pokes first, so both are in effect
      // DURING frame N. The notifier fires at the END of a frame, so a per-game offset must be measured.
      this.applyInputs(this.frames.length);
      this.applyPokes(this.frames.length);
      // Sample BEFORE the boundary's NMI: state[N] holds no interrupt effects of N.
      this.frames.push(this.mem.dumpState());
      if (this.captureVideo) this.finishRasterFrame();
      this.nextBoundary += CYCLES_PER_FRAME;
    }

    this.drainRaster();

    if (this.cycles >= this.maxCycles) throw new FramesComplete();

    // The Z80 accepts an NMI only between instructions, which is where tick() runs from.
    if (this.cycles >= this.nextNmi) {
      this.nextNmi += CYCLES_PER_FRAME;
      // The irq_enable latch IS the gate; the handler clears the bit itself (0x7001 D0).
      if (this.io.nmiMask) this.fireNmi();
    }

    // A bare tick() records no successor, so the PC is stale until the next step(). Invalidating AFTER the
    // NMI check is what lets fireNmi's guard ever pass.
    this.pcKnown = false;
  }

  /** The pushed PC lands in work RAM, which IS diffed, so it must be real and not a sentinel. Reentrancy is
   *  guarded by the hardware — the handler clears the enable bit itself. */
  fireNmi() {
    if (!this.pcKnown) {
      throw new Error(
        `NMI at cycle ${this.cycles} but the ROM PC is unknown: a routine here used ` +
          "tick() rather than step(), so the pushed value would be stale. That value " +
          "lands in diffed work RAM, so pushing a guess is worse than stopping.",
      );
    }
    this.nmiCount += 1;
    this.push16(this.pc);
    this.step(NMI_VECTOR, 11);
    return this.call(NMI_VECTOR);
  }

  applyPokes(frameIndex) {
    if (!this.pokes) return;
    for (const p of this.pokes) {
      const due = frameIndex >= p.frame && (p.dur == null || frameIndex < p.frame + p.dur);
      if (due) this.mem.write8(p.addr, p.val);
    }
  }

  // Rebuilt from scratch each frame, so a press releases itself. io folds in the polarity.
  applyInputs(frameIndex) {
    if (!this.inputTape) return;
    const assert = {};
    for (const t of this.inputTape) {
      const due = frameIndex >= t.frame && (t.dur == null || frameIndex < t.frame + t.dur);
      if (due) assert[t.port] = (assert[t.port] || 0) | t.bits;
    }
    this.io.inputAssert = assert;
  }

  /**
   * The cycle budget runs PAST the last sample so effects landing just after a boundary still happen,
   * uncaptured. Boot never returns, so FramesComplete is how a bounded run unwinds.
   */
  runFrames(count) {
    this.io.inputAssert = null;
    this.applyInputs(0);
    this.applyPokes(0);
    this.frames = [this.mem.dumpState()]; // state[0], power-on
    this.maxFrames = count;
    this.maxCycles = count * CYCLES_PER_FRAME + CYCLES_PER_FRAME;
    this.cycles = 0;
    this.nextBoundary = CYCLES_PER_FRAME;
    this.nextNmi = NMI_CYCLE_IN_FRAME;
    this.stoppedBy = null;
    this.videoFrames = [];
    this.droppedFrames = 0;
    if (this.captureVideo) this.startRasterFrame(0);
    if (count <= 1) return this.frames;
    try {
      this.reset();
      this.stoppedBy = "returned"; // boot fell off the end — it should not
    } catch (e) {
      if (e instanceof FramesComplete) {
        this.stoppedBy = null;
      } else if (e instanceof NotImplemented) {
        // Translation ran out; the captured frames localise the gap, so keep them. ONLY this kind is
        // absorbed — a real JS bug must not read as a translation gap.
        this.stoppedBy = e;
      } else {
        throw e;
      }
    } finally {
      this.maxFrames = Infinity;
      this.maxCycles = Infinity;
      this.nextBoundary = Infinity;
    }
    return this.frames;
  }

  drainRaster() {
    if (!this.captureVideo || this.rasterBuf === null) return;
    while (this.rasterRow < SCREEN_H && this.cycles >= this.nextRowCycle) {
      renderRowsRGB(this.rasterBuf, this.rasterRow, this.rasterRow, this.mem, this.video, {
        flipScreenX: this.io.flipScreenX,
        flipScreenY: this.io.flipScreenY,
      });
      this.rasterRow++;
      this.nextRowCycle += CYCLES_PER_SCANLINE;
    }
  }

  startRasterFrame(n) {
    if (!this.video) throw new Error("raster capture needs the gfx and proms images");
    this.rasterBuf = new Uint8Array(SCREEN_W * SCREEN_H * 3);
    this.rasterRow = 0;
    this.nextRowCycle = n * CYCLES_PER_FRAME + VBLANK_LINES * CYCLES_PER_SCANLINE;
  }

  /**
   * INDEXING: called after state[N] was pushed, so frames.length is N+1 and the frame to start is
   * frames.length-1. A frame with rows unpainted is DROPPED.
   */
  finishRasterFrame() {
    if (this.rasterBuf !== null && this.rasterRow === SCREEN_H) {
      if (this.onVideoFrame) this.onVideoFrame(this.rasterBuf);
      else this.videoFrames.push(this.rasterBuf);
    } else if (this.rasterBuf !== null) {
      this.droppedFrames += 1;
    }
    this.startRasterFrame(this.frames.length - 1);
  }

  renderFrame() {
    if (!this.video) throw new Error("renderFrame needs the gfx and proms images");
    return renderFrameRGB(this.mem, this.video, {
      flipScreenX: this.io.flipScreenX,
      flipScreenY: this.io.flipScreenY,
    });
  }

  push16(value) {
    const { regs, mem } = this;
    regs.sp = (regs.sp - 2) & 0xffff;
    mem.write8(regs.sp, value & 0xff);
    mem.write8((regs.sp + 1) & 0xffff, (value >> 8) & 0xff);
  }

  pop16() {
    const { regs, mem } = this;
    const lo = mem.read8(regs.sp);
    const hi = mem.read8((regs.sp + 1) & 0xffff);
    regs.sp = (regs.sp + 2) & 0xffff;
    return lo | (hi << 8);
  }

  /** RET: the popped value IS the next PC, which is why it cannot be a JS return. */
  ret(cycles = 10) {
    this.step(this.pop16(), cycles);
  }

  call(addr, ...args) {
    const fn = this.routines.get(addr);
    if (fn === undefined) {
      // NotImplemented, not a bare Error: runFrames absorbs THIS and rethrows the rest, so a real JS bug
      // cannot be reported as a translation gap.
      throw new NotImplemented(
        `m.call: no routine registered at 0x${addr.toString(16).padStart(4, "0")}`,
      );
    }
    return fn(this, ...args);
  }

  /**
   * LDI: one block-copy step, WITH the flags. Clears H and N, PV from BC nonzero after the decrement,
   * undocumented F3/F5 from (A + the byte copied), S/Z/C untouched. F is diffed, so a site that open-codes
   * this without F diverges for real.
   */
  ldi(nextAddr) {
    const { regs, mem } = this;
    const byte = mem.read8(regs.hl);
    mem.write8(regs.de, byte);
    regs.hl = (regs.hl + 1) & 0xffff;
    regs.de = (regs.de + 1) & 0xffff;
    regs.bc = (regs.bc - 1) & 0xffff;

    const n = (regs.a + byte) & 0xff;
    regs.f =
      (regs.f & (0x80 | 0x40 | 0x01)) |
      (regs.bc !== 0 ? 0x04 : 0) |
      (n & 0x08 ? 0x08 : 0) |
      (n & 0x02 ? 0x20 : 0);
    this.step(nextAddr, 16);
  }

  /**
   * LDIR at an arbitrary site: LDI in a loop, leaving its last LDI's flag state. 21 T-states per repeat, 16
   * on exit. F IS WRITTEN ON EVERY ITERATION: a repeat ends in a `step` that can accept the NMI, whose
   * handler pushes AF into work RAM, which IS diffed.
   */
  ldirAt(self, nextAddr) {
    const { regs, mem } = this;
    for (;;) {
      const byte = mem.read8(regs.hl);
      mem.write8(regs.de, byte);
      regs.hl = (regs.hl + 1) & 0xffff;
      regs.de = (regs.de + 1) & 0xffff;
      regs.bc = (regs.bc - 1) & 0xffff;

      const n = (regs.a + byte) & 0xff;
      regs.f =
        (regs.f & (0x80 | 0x40 | 0x01)) |
        (regs.bc !== 0 ? 0x04 : 0) |
        (n & 0x08 ? 0x08 : 0) |
        (n & 0x02 ? 0x20 : 0);

      if (regs.bc === 0) {
        this.step(nextAddr, 16);
        return;
      }
      // A REPEAT then OVERWRITES F3/F5 from the high byte of this instruction's own address: MAME's `ldir`
      // does `PC -= 2` back onto the opcode, then `yx_val = PC >> 8`.
      regs.f = (regs.f & ~0x28) | ((self >> 8) & 0x28);
      this.step(self, 21);
    }
  }

  /** LDDR: ldirAt with both pointers descending. Same flags, same T-states. */
  lddrAt(self, nextAddr) {
    const { regs, mem } = this;
    for (;;) {
      const byte = mem.read8(regs.hl);
      mem.write8(regs.de, byte);
      regs.hl = (regs.hl - 1) & 0xffff;
      regs.de = (regs.de - 1) & 0xffff;
      regs.bc = (regs.bc - 1) & 0xffff;

      const n = (regs.a + byte) & 0xff;
      regs.f =
        (regs.f & (0x80 | 0x40 | 0x01)) |
        (regs.bc !== 0 ? 0x04 : 0) |
        (n & 0x08 ? 0x08 : 0) |
        (n & 0x02 ? 0x20 : 0);

      if (regs.bc === 0) {
        this.step(nextAddr, 16);
        return;
      }
      regs.f = (regs.f & ~0x28) | ((self >> 8) & 0x28);
      this.step(self, 21);
    }
  }

  dumpState() {
    return this.mem.dumpState();
  }

  stateOffsetToAddr(off) {
    return this.mem.stateOffsetToAddr(off);
  }

  clone() {
    const c = new Machine(this.rom, this.routines, this.assets);
    c.mem.workRam.set(this.mem.workRam);
    c.mem.videoRam.set(this.mem.videoRam);
    c.mem.objRam.set(this.mem.objRam);
    c.mem.watchdogReads = this.mem.watchdogReads;
    c.mem.unmappedWrites = this.mem.unmappedWrites;

    c.regs.copyFrom(this.regs);
    c.io.loadStateFrom(this.io);

    c.cycles = this.cycles;
    c.pc = this.pc;
    c.pcKnown = this.pcKnown;
    c.nmiCount = this.nmiCount;

    c.nextBoundary = Infinity;
    c.nextNmi = Infinity;
    c.maxFrames = Infinity;
    c.maxCycles = Infinity;
    return c;
  }
}

const GeneratorFunction = Object.getPrototypeOf(function* () {}).constructor;

export function withOmittedRet(fn, addr = null) {
  // A SPINE GENERATOR PASSES THROUGH UNWRAPPED: calling one builds the iterator without running the body,
  // so the seam would read the unmoved stack as an omitted ret.
  if (fn instanceof GeneratorFunction) return fn;

  const at = addr === null ? "" : ` at 0x${(addr & 0xffff).toString(16).padStart(4, "0")}`;
  return (m, ...args) => {
    const seat = m.regs.sp;
    const callerRet = m.mem.read16(seat);
    const r = fn(m, ...args);
    // A PLAIN ROUTINE HANDING BACK A COROUTINE HAS NOT FINISHED — no ret owed, stack mid-flight.
    if (r && typeof r.next === "function" && typeof r.throw === "function") return r;
    const moved = (((m.regs.sp - seat) & 0xffff) << 16) >> 16;
    if (moved === 0) {
      m.ret();
      return r;
    }
    if (moved === 2 && m.pc === callerRet) return r;
    throw new Error(
      `the seam cannot place this dispatch${at}: it moved SP by ${moved} and left pc at ` +
        `0x${(m.pc & 0xffff).toString(16).padStart(4, "0")}, with the caller's return address ` +
        `0x${callerRet.toString(16).padStart(4, "0")} at 0x${seat.toString(16).padStart(4, "0")}. ` +
        "A rewrite either omits its ROM `ret`, leaving SP where it found it, or reaches that ret through " +
        "a transfer into still-translated code, which pops the caller's slot and lands pc on it. Neither " +
        "happened here: either this ROM form is not one net `ret`, or the stack was already adrift when " +
        "the dispatch began and this is the first place that showed.",
    );
  };
}

export async function resolveOverrides(spec = {}, baseUrl = import.meta.url) {
  const map = new Map();
  for (const [key, ent] of Object.entries(spec)) {
    const addr = parseInt(key, 16);
    const mod = await import(new URL(ent.module, baseUrl).href);
    const fn = mod[ent.export];
    if (typeof fn !== "function") {
      throw new Error(`override ${key}: module ${ent.module} has no function export "${ent.export}"`);
    }
    map.set(addr, withOmittedRet(fn, addr));
  }
  return map;
}

export async function resolveAllIdiomatic(baseUrl = import.meta.url) {
  const { ROUTINES } = await import(new URL("idiomatic/names.js", baseUrl).href);
  const spec = {};
  for (const [addr, meta] of Object.entries(ROUTINES)) {
    spec[Number(addr).toString(16)] = {
      module: `./idiomatic/${meta.name}.js`,
      export: meta.entry ?? meta.name,
    };
  }
  return resolveOverrides(spec, baseUrl);
}
