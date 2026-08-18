// SPDX-License-Identifier: GPL-3.0-only
/**
 * spawnSpriteObjectArmA  —  ROM 0x2a6a  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   Dispatcher A's SPAWN arm — the first of the five per-object arms that dispatcher A
 *   (dispatchSpriteObjectArmsA, ROM 0x29b9) runs against one sprite-object record every frame. Its job is
 *   to decide, on the frames when that object's slot is empty, whether to bring a new free-drifting
 *   two-tile river/road creature onto the screen and, if so, WHERE across the lane to place it.
 *   Dispatcher-A creatures are the ones that sweep back and forth between band edges (as opposed to
 *   dispatcher B's single rideable object that steers toward a fixed lane target).
 *
 * WHERE IT SITS
 *   It is called once per frame for each dispatcher-A object, but is triply gated so the overwhelming
 *   majority of calls fall straight through without spawning anything:
 *     • LEVEL gate — the level/slot count LIVES_COUNT (0x83b7) must be >= 3. Dispatcher A itself is only
 *       dispatched from level 3 up (a second object joins from level 6), so below 3 this arm is dormant.
 *     • TIMER gate — every frame it ticks the record's own +0x0a spawn timer down by one and does nothing
 *       until it expires. Retirement (placeSpriteObjectSlotAndRetire) reseeds that timer to 0x20, so an
 *       object reappears roughly 0x20 frames after it leaves the screen.
 *     • IDLE gate — it only spawns into an empty slot (record +0x06 == 0); an already-armed object is left
 *       to the animate / motion / stage arms.
 *   Once all three pass, it draws from the shared spawn PRNG (nextSpawnRandomByte, ROM 0x0aee) to
 *   density-gate the spawn, walks the horizontal placement bands to choose a screen position (or parks the
 *   object off-screen), seeds the object's timers, and falls into the shared spawn tail
 *   raiseSpriteArmOneShotAndQueueSound (ROM 0x2ae6). Because attract mode never reaches level 3, live play
 *   never drives this leaf in attract — its equivalence test drives it from a crafted IX record instead.
 *
 * PARAMETER
 *   ix — base address of the object's 16-byte record (the Z80 IX register). Defaults to the live m.regs.ix
 *   so the dispatcher can call it register-free; the equivalence test passes an explicit base.
 *
 * LIVE-OUT
 *   Memory only. It rewrites the object record's band-edge / position / attribute / direction / state /
 *   timer fields, advances the shared spawn PRNG ring as a side effect of every draw, and (via the tail)
 *   latches the per-turn one-shot PER_TURN_SCRATCH (0x8371) and queues the spawn sound. It returns nothing
 *   the caller reads.
 */
import { LIVES_COUNT, FREE_RUNNING_POS_COUNTER, SPRITE_SPAWN_X_STRIDE, SPRITE_SPAWN_BAND_SCAN_COUNT } from "./names.js";
import { nextSpawnRandomByte } from "./nextSpawnRandomByte.js";
import { raiseSpriteArmOneShotAndQueueSound } from "./raiseSpriteArmOneShotAndQueueSound.js";

// LIVES_COUNT (0x83b7) is the life/level count, which doubles as the population dial for sprite objects:
// driveSpriteObjectCluster runs one dispatcher-A object from level 3 and a second from level 6. Below this
// threshold dispatcher A is never dispatched, so the spawn arm is dormant.
const MIN_SLOTS = 3;
// One placement band is 0x40 pixels wide. The band walk steps downward 0x40 at a time, and the on-screen
// placement reuses 0x40 as the span between the object's two band-boundary X limits (record +0 and +1).
const BAND_PITCH = 0x40;

export function spawnSpriteObjectArmA(m, ix = m.regs.ix) {
  const { mem8 } = m;

  // ── Level gate ───────────────────────────────────────────────────────────────────────
  // LIVES_COUNT (0x83b7) is the level/slot count. Dispatcher A is only dispatched from level 3, so this
  // arm produces no object below MIN_SLOTS.
  const count = mem8[LIVES_COUNT];
  if (count < MIN_SLOTS) return;

  // ── Spawn-timer gate ─────────────────────────────────────────────────────────────────
  // Record byte +0x0a is this object's own spawn/respawn countdown. Tick it down one per frame and write
  // the new value back; until it reaches 0 the object is still cooling down and no spawn is attempted.
  const timer = (mem8[(ix + 0x0a)] - 1) & 0xff;
  mem8[(ix + 0x0a)] = timer;
  if (timer !== 0) return;                        // spawn timer still counting

  // ── Idle gate ────────────────────────────────────────────────────────────────────────
  // Record byte +0x06 is the active/state byte: 0 = idle, non-zero = armed/animating. Only spawn into an
  // empty slot; if the object is already live, leave it to the other arms.
  if (mem8[(ix + 0x06)] !== 0) return;   // object already active

  // ── Density gate (rises with the level) ──────────────────────────────────────────────
  // Draw one byte from the shared spawn PRNG (nextSpawnRandomByte, ROM 0x0aee) and accept the spawn only
  // when it lands at or below the threshold (count*8 + 0x80) & 0xff. That threshold climbs with the level
  // count, so higher levels spawn objects more readily. Every draw also advances the ring all spawn arms
  // share, so the sequence stays coupled across the whole cluster.
  const roll = nextSpawnRandomByte(m);
  if (((count * 8 + 0x80) & 0xff) < roll) return; // probability gate

  // ── Band roll: one-in-four skips the band walk ───────────────────────────────────────
  // A second PRNG draw. One time in four (both low bits clear) the object bypasses the horizontal band
  // search entirely and goes straight to the park-or-reveal tail — so a quarter of accepted spawns get no
  // computed on-screen band.
  const bandRoll = nextSpawnRandomByte(m);
  if ((bandRoll & 0x03) === 0) return parkOrReveal();

  // ── Derive the per-band X stride ─────────────────────────────────────────────────────
  // SPRITE_SPAWN_X_STRIDE (0x8276) seeds the horizontal pitch subtracted once per band during the walk.
  // The ROM rotates the seed right twice — (seed >> 2) drops the low two bits, ((seed & 0x03) << 6)
  // reinserts them at the top, so it is a rotate (no bits lost), not a shift — then adds 0x24.
  const strideSeed = mem8[SPRITE_SPAWN_X_STRIDE];
  const stride = ((((strideSeed >> 2) | ((strideSeed & 0x03) << 6)) & 0xff) + 0x24) & 0xff;

  // ── Walk the placement bands down from the free-running counter ───────────────────────
  // FREE_RUNNING_POS_COUNTER (0x8014) rises +1 every frame and wraps at 0xff — the frog-independent
  // position source every sprite object drifts along. Start 0x10 below it and step downward: each band
  // subtracts one BAND_PITCH (0x40) then one stride, spending the band budget in
  // SPRITE_SPAWN_BAND_SCAN_COUNT (0x8278). If the counter is already below 0x10 the first subtraction
  // would underflow, so park instead of walking.
  let bands = mem8[SPRITE_SPAWN_BAND_SCAN_COUNT];
  if (mem8[FREE_RUNNING_POS_COUNTER] < 0x10) return parkOrReveal();
  let bandWalk = (mem8[FREE_RUNNING_POS_COUNTER] - 0x10) & 0xff;
  for (;;) {
    // Landed inside the final BAND_PITCH → this band fits: place the object on-screen at the residual.
    if (bandWalk < BAND_PITCH) return placeOnScreen(bandWalk);
    bandWalk = (bandWalk - BAND_PITCH) & 0xff;
    // Not enough room left for a full stride → no band fits this frame: park off-screen.
    if (bandWalk < stride) return parkOrReveal();
    bandWalk = (bandWalk - stride) & 0xff;
    // Band budget spent without landing → park off-screen.
    bands = (bands - 1) & 0xff;
    if (bands === 0) return parkOrReveal();
  }

  // Place the object on the visible play row at the band the walk found.
  function placeOnScreen(band) {
    // +2 is the position accumulator — seed it with the current free-running counter, the value the motion
    // and slot-staging arms drift/subtract against.
    const pos = mem8[FREE_RUNNING_POS_COUNTER];
    mem8[(ix + 0x02)] = pos;
    // +1 / +0 are the near/far band-boundary X limits the creature bounces between: +1 is the low edge
    // (counter minus the landing band), +0 is that low edge plus one band span (BAND_PITCH). The +0 store
    // truncates to 8 bits in the byte array, matching the Z80's 8-bit write.
    const rel = (pos - band) & 0xff;
    mem8[(ix + 0x01)] = rel;
    mem8[(ix + 0x00)] = rel + BAND_PITCH;
    // +4 is the row/category attribute; 0x4e (< 0x60) marks an on-screen "moving" object.
    mem8[(ix + 0x04)] = 0x4e;
    return revealSlot();
  }

  // No on-screen band was chosen (band roll skip, counter underflow, or a failed walk): stage the object
  // as "parked/fixed", then flip a coin to either reveal it on the play row after all or hide it fully.
  function parkOrReveal() {
    // +4 = 0x7e (>= 0x60) marks the "parked/fixed" category.
    mem8[(ix + 0x04)] = 0x7e;
    // One more PRNG draw. Odd → reveal on the play row (revealSlot sets +3 = 0x00). Even → hide it: clear
    // the +5 direction bit and set +3 = 0xf0, parking the object off the bottom of the screen.
    const parkRoll = nextSpawnRandomByte(m);
    if ((parkRoll & 0x01) !== 0) return revealSlot();
    mem8[(ix + 0x05)] = 0x00;
    mem8[(ix + 0x03)] = 0xf0; // parked off-screen
    return armTimers();
  }

  // Bring the object onto the visible play row: +5 sets the direction / horizontal-flip bit, +3 = 0x00
  // puts it on the play row (as opposed to 0xf0 = parked off-screen).
  function revealSlot() {
    mem8[(ix + 0x05)] = 0x80;
    mem8[(ix + 0x03)] = 0x00;
    return armTimers();
  }

  // Final step on every spawn path: arm the record, seed its animation/motion timers, and fall into the
  // shared spawn tail.
  function armTimers() {
    mem8[(ix + 0x06)] = 0x01;               // +6 = 1: object armed (idle -> live)
    mem8[(ix + 0x08)] = 0x0b;               // +8: animation-frame timer seed
    mem8[(ix + 0x09)] = 0x08;               // +9: motion timer seed
    // Shared spawn tail (raiseSpriteArmOneShotAndQueueSound, ROM 0x2ae6): a per-turn one-shot that latches
    // PER_TURN_SCRATCH (0x8371) and queues the spawn sound (command 0x90) the first time any arm spawns
    // this turn; later arms in the same turn find the flag set and do nothing.
    raiseSpriteArmOneShotAndQueueSound(m);
  }
}
