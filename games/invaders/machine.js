// SPDX-License-Identifier: GPL-3.0-only
// Space Invaders (Intel 8080) Machine. Modeled on games/pooyan/machine.js but for the 8080 + the
// mw8080bw board, and SIMPLER: no memory-mapped I/O (devices are the port space, io.portIn/portOut) and
// no per-scanline raster (the 1bpp framebuffer is read whole at each frame boundary via video.renderFrame).
//
// ★ THE ONE NOVEL PIECE: TWO maskable RST interrupts per frame (vs the Z80 games' single vblank NMI):
//   RST 1 (vector 0x08) ~mid-screen, RST 2 (vector 0x10) at vblank, both gated by the 8080 INTE
//   flip-flop (io.inte, set by EI/DI). This is the cycle-driven (translated-oracle) path used by §3
//   translation. The IDIOMATIC path (runIdiomaticGame) fires ONE NMI/frame; extending it to a mid+vblank
//   pair (a runInvadersGame variant, or a per-yield vector) is a §4 task -- see INVADERS-DRIVER-NOTES.md.
// ★ reset flags + interrupt cycle offsets are drafts to pin boot-first vs MAME i8080 (equivalence gate).

import { AddressSpace } from "../../boards/invaders/memory.js";
import { Io, NotImplemented } from "../../boards/invaders/io.js";
import { SCREEN_W, SCREEN_H, renderFrame } from "../../boards/invaders/video.js";
import { Regs } from "../../core/cpu/8080.js";
import { makeIndexedView } from "../../core/mem-views.js";
import { buildRoutines } from "./routines.js";

/** 1996800 Hz / 59.541985 Hz. MW8080BW_CPU_CLOCK / MW8080BW_60HZ (mw8080bw.h). */
export const CYCLES_PER_FRAME = 33536;

// Two RST interrupts per frame. Vector = the 8080 RST target PC; cycle = when in the frame it fires.
export const INT1_VECTOR = 0x08; // RST 1, mid-screen
export const INT2_VECTOR = 0x10; // RST 2, vblank
// mid-screen at ~vpos 96 of 262 total lines; vblank at frame end. ★ pin exact offsets vs MAME.
export const INT1_CYCLE = Math.round((96 / 262) * CYCLES_PER_FRAME); // ~12293
export const INT2_CYCLE = CYCLES_PER_FRAME; // vblank == boundary

export { SCREEN_W, SCREEN_H };

export class FramesComplete extends Error {
  constructor() {
    super("frame budget exhausted");
    this.name = "FramesComplete";
  }
}

export class Machine {
  constructor(rom, routines, opts = {}) {
    // (rom, routinesMap, opts) or the worker form (rom, opts) -- build routines here if the 2nd arg
    // is not a Map.
    if (!(routines instanceof Map)) {
      opts = routines || {};
      routines = buildRoutines();
      if (opts.overrides) for (const [addr, fn] of opts.overrides) routines.set(Number(addr), fn);
    }
    this.io = new Io();
    this.mem = new AddressSpace(rom, this.io);
    this.regs = new Regs();
    this.routines = routines;

    this.rom = rom;
    this.assets = opts;

    this.mem8 = makeIndexedView(this.mem, 8);
    this.mem16 = makeIndexedView(this.mem, 16);

    // 8080 reset: all registers 0, PC=0. MEASURED from MAME i8080 (golden config probe 2026-09-01:
    // AF=BC=DE=HL=SP=PC=0x0000) -- so reset F is 0x00, NOT the 0x02 always-1 draft. The always-1 bit
    // still reads 1 through the PSW (8080.js af getter forces it); the raw reset F register is 0.
    this.regs.a = 0; this.regs.f = 0x00;
    this.regs.b = 0; this.regs.c = 0; this.regs.d = 0; this.regs.e = 0;
    this.regs.h = 0; this.regs.l = 0; this.regs.sp = 0;

    this.cycles = 0;
    this.pc = 0;
    this.pcKnown = true;
    this.frames = [];
    this.maxFrames = opts.maxFrames ?? Infinity;
    this.maxCycles = opts.maxCycles ?? Infinity;
    this.nextBoundary = CYCLES_PER_FRAME;
    this.nextInt1 = INT1_CYCLE;
    this.nextInt2 = INT2_CYCLE;
    this.intCount = 0;
    this.stoppedBy = null;

    // Video capture: whole-framebuffer read at each boundary (no per-scanline raster).
    this.captureVideo = false;
    this.videoFrames = [];
    this.onVideoFrame = null;

    this.mem.clock = () => this.cycles;
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

    while (this.cycles >= this.nextBoundary && this.frames.length < this.maxFrames) {
      this.applyInputs(this.frames.length);
      this.applyPokes(this.frames.length);
      this.frames.push(this.mem.dumpState());
      if (this.captureVideo) this._captureFrame();
      this.nextBoundary += CYCLES_PER_FRAME;
    }

    if (this.cycles >= this.maxCycles) throw new FramesComplete();

    // Two maskable RST interrupts per frame, INTE-gated. Ordered mid then vblank.
    if (this.cycles >= this.nextInt1) {
      this.nextInt1 += CYCLES_PER_FRAME;
      if (this.io.inte) this.fireInt(INT1_VECTOR);
    }
    if (this.cycles >= this.nextInt2) {
      this.nextInt2 += CYCLES_PER_FRAME;
      if (this.io.inte) this.fireInt(INT2_VECTOR);
    }

    this.pcKnown = false;
  }

  /** An accepted 8080 interrupt: the device supplies RST n; the CPU pushes PC and jumps to the vector.
   *  Real HW also clears INTE on accept (until the handler's EI); the handler re-enables. */
  fireInt(vector) {
    if (!this.pcKnown) {
      throw new Error(
        `interrupt at cycle ${this.cycles} but the ROM PC is unknown: a routine used tick() not ` +
          "step(), so the pushed value would be stale (it lands in diffed RAM).",
      );
    }
    this.intCount += 1;
    this.io.inte = false; // 8080 clears the enable on accept; EI in the handler re-arms it
    this.push16(this.pc);
    this.step(vector, 11);
    return this.call(vector);
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

  /** RET: the popped value IS the next PC. */
  ret(cycles = 10) {
    this.step(this.pop16(), cycles);
  }

  call(addr, ...args) {
    const fn = this.routines.get(addr);
    if (fn === undefined) {
      throw new NotImplemented(
        `call: no routine registered at 0x${addr.toString(16).padStart(4, "0")}`,
      );
    }
    return fn(this, ...args);
  }

  applyPokes(frameIndex) {
    if (!this.pokes) return;
    for (const p of this.pokes) {
      const due = frameIndex >= p.frame && (p.dur == null || frameIndex < p.frame + p.dur);
      if (due) this.mem.write8(p.addr, p.val);
    }
  }

  // Rebuilt each frame so a press releases itself; io folds in the (active-high) polarity.
  applyInputs(frameIndex) {
    if (!this.inputTape) return;
    const assert = {};
    for (const t of this.inputTape) {
      const due = frameIndex >= t.frame && (t.dur == null || frameIndex < t.frame + t.dur);
      if (due) assert[t.port] = (assert[t.port] || 0) | t.bits;
    }
    this.io.inputAssert = assert;
  }

  _captureFrame() {
    const fb = renderFrame(this.mem.ram);
    if (this.onVideoFrame) this.onVideoFrame(fb);
    else this.videoFrames.push(fb);
  }

  runFrames(count) {
    this.io.inputAssert = null;
    this.applyInputs(0);
    this.applyPokes(0);
    this.frames = [this.mem.dumpState()];
    this.maxFrames = count;
    this.maxCycles = count * CYCLES_PER_FRAME + CYCLES_PER_FRAME;
    this.cycles = 0;
    this.nextBoundary = CYCLES_PER_FRAME;
    this.nextInt1 = INT1_CYCLE;
    this.nextInt2 = INT2_CYCLE;
    this.stoppedBy = null;
    this.videoFrames = [];
    if (count <= 1) return this.frames;
    try {
      this.reset();
      this.stoppedBy = "returned"; // boot should never fall off the end
    } catch (e) {
      if (e instanceof FramesComplete) this.stoppedBy = null;
      else if (e instanceof NotImplemented) this.stoppedBy = e; // translation gap: keep captured frames
      else throw e;
    } finally {
      this.maxFrames = Infinity;
      this.maxCycles = Infinity;
      this.nextBoundary = Infinity;
    }
    return this.frames;
  }

  dumpState() {
    return this.mem.dumpState();
  }

  clone() {
    const m = new Machine(this.rom, this.routines, this.assets);
    m.regs.copyFrom(this.regs);
    m.mem.ram.set(this.mem.ram);
    m.io.loadStateFrom(this.io);
    m.cycles = this.cycles;
    m.pc = this.pc;
    m.pcKnown = this.pcKnown;
    m.nextBoundary = this.nextBoundary;
    m.nextInt1 = this.nextInt1;
    m.nextInt2 = this.nextInt2;
    return m;
  }
}
