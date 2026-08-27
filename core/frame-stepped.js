// SPDX-License-Identifier: GPL-3.0-only
// Cycle-free ("frame-stepped") engines: fire the vblank NMI at the game's vblank yield, not on a cycle
// count. runCycleFree (poll-PC, translated), runWatchdogGame (watchdog read), runIdiomaticGame (coroutine,
// the model for a new game). TEST seams; the shipped game stays cycle-driven. Go-live traps and poll-PC
// choice: docs/idiomatic-generation.md and docs/integration-testing.md "Go-live". Validate via convergence.mjs.

// Unwinds out of the call tree when a run is done; boot + main loop never return. Not an error.
class RunComplete extends Error {
  constructor(reason) {
    super(reason);
    this.name = "RunComplete";
  }
}

// Cycle-free from reset: onFrame at frame 0 (power-on) and at each poll PC reached with NMI unmasked.
// Wraps step() in place -- construct a fresh Machine per run. opts: {pollPCs, maxFrames, onFrame, stepBudget}.
export function runCycleFree(machine, { pollPCs, maxFrames = Infinity, onFrame, stepBudget = 6e8 } = {}) {
  const poll = pollPCs instanceof Set ? pollPCs : new Set(pollPCs);
  if (poll.size === 0) throw new Error("runCycleFree needs at least one poll PC");

  // Neutralise the cycle scheduler; this engine fires the NMI on control flow only.
  machine.nextBoundary = Infinity;
  machine.maxFrames = Infinity;
  machine.maxCycles = Infinity;
  machine.nextNmi = Infinity;

  const realFire = machine.fireNmi.bind(machine);
  const realStep = machine.step.bind(machine);
  machine.fireNmi = function () {};

  let steps = 0;
  let inNmi = false;
  let frame = 0;

  if (onFrame) onFrame(machine, 0);

  machine.step = function (nextAddr, cycles) {
    realStep(nextAddr, cycles);
    if (++steps > stepBudget) throw new RunComplete("step-budget (unpolled spin?)");
    // A poll PC reached with NMI unmasked IS a frame boundary; inNmi blocks the handler re-triggering
    // (its final m.ret steps back to the poll PC it interrupted).
    if (!inNmi && poll.has(this.pc) && this.io.nmiMask) {
      frame += 1;
      if (onFrame) onFrame(this, frame);
      if (frame >= maxFrames) throw new RunComplete("reached maxFrames");
      this.pcKnown = true; // realStep set a genuine next-instruction address, so fireNmi's guard holds
      inNmi = true;
      try {
        realFire();
      } finally {
        inNmi = false;
      }
    }
  };

  let stop = "reached maxFrames";
  let stopError = null;
  try {
    machine.reset();
    stop = "returned";
  } catch (e) {
    if (e instanceof RunComplete) {
      stop = e.message;
    } else {
      // Boot gap / unmapped access: frames already sampled stay valid, so surface why we stopped.
      stop = `${e.name}: ${e.message}`;
      stopError = e;
    }
  } finally {
    machine.step = realStep;
    machine.fireNmi = realFire;
  }

  return { frames: frame, steps, stop, stopError };
}

// runWatchdogGame -- whole game idiomatic, no T-state clock. Idiomatic polls never call m.step, so the
// watchdog KICK (a read of watchdogPort) is the vblank yield. Superseded by runIdiomaticGame. opts:
// {watchdogPort, nmiReturnPC, maxFrames, onFrame, readBudget}.
export function runWatchdogGame(machine, { watchdogPort, nmiReturnPC, maxFrames = Infinity, onFrame, readBudget = 5e6 } = {}) {
  if (watchdogPort == null || nmiReturnPC == null) throw new Error("runWatchdogGame needs watchdogPort and nmiReturnPC");

  machine.nextBoundary = Infinity;
  machine.maxFrames = Infinity;
  machine.maxCycles = Infinity;
  machine.nextNmi = Infinity;

  const realFire = machine.fireNmi.bind(machine);
  const realRead = machine.mem.read8.bind(machine.mem);
  machine.fireNmi = function () {};

  let frame = 0;
  let readsSinceFrame = 0;

  if (onFrame) onFrame(machine, 0);

  machine.mem.read8 = function (addr) {
    const v = realRead(addr);
    if (++readsSinceFrame > readBudget) throw new RunComplete("per-frame read budget (unpolled spin?)");
    if ((addr & 0xffff) === watchdogPort && machine.io.nmiMask) {
      // NO "in NMI" guard: a watchdog read under a live NMI means that handler long-jumped into a new
      // forever loop (coin path) -- a genuine boundary that MUST fire or the game freezes on the credit
      // screen. Safe: the handler never reads the watchdog. Cost: one leaked host-stack frame per restart.
      frame += 1;
      readsSinceFrame = 0;
      if (onFrame) onFrame(machine, frame);
      if (frame >= maxFrames) throw new RunComplete("reached maxFrames");
      machine.pcKnown = true;
      machine.pc = nmiReturnPC;
      realFire();
    }
    return v;
  };

  let stop = "returned";
  let stopError = null;
  try {
    machine.reset();
    stop = "returned";
  } catch (e) {
    if (e instanceof RunComplete) stop = e.message;
    else { stop = `${e.name}: ${e.message}`; stopError = e; }
  } finally {
    machine.mem.read8 = realRead;
    machine.fireNmi = realFire;
  }

  return { frames: frame, stop, stopError };
}

// runIdiomaticGame -- the COROUTINE engine, model for a new game. The idiomatic spine (boot, main/wait
// loops) are GENERATORS that yield at each vblank wait; the engine resumes to the next yield, samples
// pre-NMI, fires the NMI. A coin/start/level/game-over transition is a WARM RESTART: the handler sets
// machine.nextMain to a factory and the engine swaps it, so the abandoned generator is collected and the
// host stack stays flat (removing runWatchdogGame's per-restart leak). opts: {bootAddr, nmiReturnPC, maxFrames, onFrame}.
export function runIdiomaticGame(machine, { bootAddr = 0x0000, nmiReturnPC, maxFrames = Infinity, onFrame } = {}) {
  machine.nextBoundary = Infinity;
  machine.maxFrames = Infinity;
  machine.maxCycles = Infinity;
  machine.nextNmi = Infinity;

  const realFire = machine.fireNmi.bind(machine);
  machine.fireNmi = function () {};
  machine.idiomaticNmi = true; // this engine fires the vblank NMI as a direct JS call (see the board fireNmi)
  machine.booted = true;
  machine.nextMain = null;

  let frame = 0;
  let stop = "returned";
  let stopError = null;

  if (onFrame) onFrame(machine, 0);

  // m.call of a generator returns the generator object; a spine tail delegates with yield*.
  let gen = machine.call(bootAddr);

  try {
    for (;;) {
      // Apply any pending warm restart BEFORE resuming, so an abandoned loop is never resumed.
      if (machine.nextMain) { gen = machine.nextMain(); machine.nextMain = null; }
      let r;
      try {
        r = gen.next();
      } catch (e) {
        // MID-FRAME warm restart: a service deep in the gameplay tree abandoned the frame (no NMI fires).
        if (e === machine.RESTART && machine.nextMain) continue;
        throw e;
      }
      if (r.done) {
        if (machine.nextMain) continue; // returned AND handed off (boot -> attract) -> swap
        stop = "returned";
        break;
      }
      frame += 1;
      if (onFrame) onFrame(machine, frame); // sample PRE-NMI, at the vblank yield
      if (frame >= maxFrames) { stop = "reached maxFrames"; break; }
      machine.pcKnown = true;
      if (nmiReturnPC != null) machine.pc = nmiReturnPC;
      realFire();

      // Reproduce a COLLAPSED multi-frame busy-wait (the board wipe): a routine may declare N extra
      // DISPLAYED frames. Fire N NMI-only frames, foreground generator paused -- the CPU sits in the
      // busy-wait, the NMI keeps firing -- so the count matches MAME. Optional busyDelayRender(m,i,total)
      // animates it (display-only; the memory end-state is already set).
      const busyTotal = machine.busyDelayFrames | 0;
      const busyRender = machine.busyDelayRender;
      machine.busyDelayFrames = 0;
      machine.busyDelayRender = null;
      for (let i = 0; i < busyTotal && frame < maxFrames; i++) {
        if (busyRender) busyRender(machine, i, busyTotal);
        frame += 1;
        if (onFrame) onFrame(machine, frame);
        machine.pcKnown = true;
        if (nmiReturnPC != null) machine.pc = nmiReturnPC;
        realFire();
      }
    }
  } catch (e) {
    stop = `${e.name}: ${e.message}`;
    stopError = e;
  } finally {
    machine.fireNmi = realFire;
  }

  return { frames: frame, stop, stopError };
}
