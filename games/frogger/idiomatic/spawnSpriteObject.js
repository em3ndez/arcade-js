// SPDX-License-Identifier: GPL-3.0-only
/**
 * spawnSpriteObject  —  ROM 0x2C13  ·  grounding: [seen,poked]
 *
 * WHAT IT IS
 *   Dispatcher B's spawn arm for the sprite-object engine. A "sprite object" is one of Frogger's moving
 *   river/road hazards (and the rideable creature the frog can climb onto): each lives as a 16-byte
 *   record in work RAM (the IX base) that the machine advances one step per frame and stages into a
 *   hardware sprite slot. This routine is the birth of such an object: on a frame where the object slot
 *   is empty, it decides — by four draws from the spawn PRNG plus two ROM placement tables — whether to
 *   spawn a new object this frame and, if so, which kind it is and where on its lane it starts, then
 *   arms the record so the motion / staging arms take over on later frames.
 *
 * WHERE IT SITS
 *   Run once per frame by dispatcher B (updateSpriteObject, ROM 0x2B83) as the FIRST of its five arms,
 *   with IX pointing at the dispatcher-B record (0x8480 / 0x8490 for player 1 / 2). It is level-gated:
 *   the whole engine only runs objects once the level/life count LIVES_COUNT (0x83b7) reaches 3, so
 *   attract mode never dispatches this arm — which is why its equivalence test drives it from a crafted
 *   entry rather than from live play. It shares its pseudo-random source, nextSpawnRandomByte (0x0AEE),
 *   with the dispatcher-A spawn arm (spawnSpriteObjectArmA), so every draw here also advances the ring
 *   the other arm reads.
 *
 * LIVE-OUT
 *   Memory only. On the spawn path it writes eleven fields of the IX record (the tile/attribute,
 *   lane index, three position bytes, the direction/parked pair, and the two arming bytes) and, as a
 *   side effect of every PRNG draw, advances the spawn ring in work RAM. It returns nothing and leaves
 *   no register the caller reads. On any of the early gates it falls through untouched.
 */
import { LIVES_COUNT, SPAWN_VARIANT_TABLE, SPAWN_POINTER_TABLE, loc_8000 } from "./names.js";
import { nextSpawnRandomByte } from "./nextSpawnRandomByte.js";

// The engine only runs objects from level 3 up (LIVES_COUNT 0x83b7 doubles as the level counter), so
// below this the spawn arm is dormant.
const MIN_COUNT = 3;

// The variant roll keeps its low three bits (0..7) but only variants 0..4 are legal — the two ROM
// placement tables have five entries each. Rolls of 5/6/7 simply skip the spawn this frame.
const VARIANTS = 5;

export function spawnSpriteObject(m, record = m.regs.ix) {
  const { mem8, mem16 } = m;

  // ── Gate 1: is the object engine even live at this level? ─────────────────────────────
  // LIVES_COUNT (0x83b7) is the life/level count; the sprite-object engine only populates objects from
  // level 3 up. Below that, no dispatcher-B object exists to spawn.
  const count = mem8[LIVES_COUNT];
  if (count < MIN_COUNT) return;

  // ── Gate 2: is this record already occupied? ──────────────────────────────────────────
  // Field +6 is the active/state byte: 0 = idle, non-zero = armed/animating. Spawn only fills an EMPTY
  // slot; if an object is already living here every arm early-returns on +6 and we are done.
  if (mem8[(record + 6)] !== 0) return; // already active

  // ── Gate 3: density roll — spawn more readily at higher levels ────────────────────────
  // Draw the first PRNG byte and compare it to a threshold that RISES with the level (8*count + 128,
  // taken mod 256). The higher the level the larger the threshold, so the more rolls pass — i.e. denser
  // traffic. Abort the frame's spawn when the roll exceeds the threshold.
  const densityRoll = nextSpawnRandomByte(m);
  if (((8 * count + 128) & 0xff) < densityRoll) return; // density gate

  // ── Gate 4: pick a variant (the object's kind) ────────────────────────────────────────
  // Draw the second PRNG byte and keep its low three bits. Only 0..4 are legal object kinds; 5/6/7 are
  // "no object" and skip this frame.
  const variant = nextSpawnRandomByte(m) & 0x07;
  if (variant >= VARIANTS) return;

  // ── Tile / row attribute (field +4) ───────────────────────────────────────────────────
  // Field +4 is the row/category attribute: it selects the screen row the object collides on and encodes
  // its kind. Each variant occupies a 16-tile band starting at 48, so the attribute is variant*16 + 48.
  mem8[(record + 4)] = variant * 16 + 48;

  // ── Discarded PRNG draw (ring advance) ────────────────────────────────────────────────
  // The ROM pulls a third byte here whose VALUE it never uses; the draw exists only for its side effect
  // of advancing the shared spawn ring. It must stay — the equivalence oracle expects the ring in the
  // same state, and dropping it would desync every later draw (this arm's and the dispatcher-A arm's).
  nextSpawnRandomByte(m);

  // ── Variant table: primary span, lane index, and start position ───────────────────────
  // SPAWN_VARIANT_TABLE (0x2ce6) is a ROM table of byte pairs indexed by variant. The even byte is the
  // PRIMARY subtraction span walked below; the odd byte is the lane index. That lane index is stored in
  // field +0x0b (record + 11) and also indexes the page-0x80 lane table loc_8000 (0x8000) to fetch the
  // object's starting position on its lane.
  const spanA = mem8[(SPAWN_VARIANT_TABLE + 2 * variant)];
  const laneIndex = mem8[(SPAWN_VARIANT_TABLE + 2 * variant + 1)];
  mem8[(record + 11)] = laneIndex;
  const seedPos = mem8[(loc_8000 + laneIndex)];

  // ── Pointer table: secondary span and the walk's iteration count ──────────────────────
  // SPAWN_POINTER_TABLE (0x2cdc) holds a little-endian pointer per variant. The byte that pointer aims
  // at gives the SECONDARY span (spanB) after a rotate-right-by-two and a −16 bias; the byte two cells
  // further on (reached by advancing only the pointer's LOW byte, so the read stays within the same
  // 256-byte page — the Z80 `inc l` idiom) gives the loop's iteration count. A count byte of 0 means the
  // Z80 djnz runs the full 256 times, hence the `|| 256`.
  const ptr = mem16[(SPAWN_POINTER_TABLE + 2 * variant)];
  const cell = mem8[ptr];
  const spanB = ((((cell >> 2) | (cell << 6)) & 0xff) - 16) & 0xff;
  const spanCount = mem8[(ptr & ~0xff) | ((ptr + 2) & 0xff)] || 256; // 0 runs the loop 256 times

  // ── Placement walk: subtract the two spans down from the seed position ────────────────
  // Starting at the seed position, repeatedly subtract the primary span (spanA), then probe/subtract the
  // secondary span (spanB), up to spanCount times. Three ways out:
  //   • spanA underflows          → the object does not fit this frame; abort the whole spawn.
  //   • spanB underflows          → stop and capture the post-spanA value (walkAcc = pos − spanB).
  //   • the walk exhausts         → stop on the final pass and capture pos after both subtractions.
  // walkAcc is the raw Z80 accumulator at the break; remainder rebuilds the pre-spanB value by adding
  // spanB back (mod 256). remainder is the offset the three position bytes are measured from.
  let pos = seedPos;
  let walkAcc = null;
  for (let i = 0; i < spanCount; i++) {
    if (pos < spanA) return;
    pos = pos - spanA;
    if (pos < spanB) { walkAcc = (pos - spanB) & 0xff; break; }
    pos = pos - spanB;
    if (i === spanCount - 1) { walkAcc = pos; break; }
  }
  const remainder = (walkAcc + spanB) & 0xff;

  // ── Position bytes (fields +2 / +1 / +0) ──────────────────────────────────────────────
  // +2 is the position accumulator (the raw seed). +1 is the near band edge (seed − remainder). +0 is
  // the far band edge, one secondary span above the near edge (+1 + spanB). The motion/steer arms bounce
  // the object between these +0/+1 limits. (The stores land in a Uint8Array, which masks to a byte, so
  // the un-masked arithmetic here is intentional — no `& 0xff` needed.)
  mem8[(record + 2)] = seedPos;
  mem8[(record + 1)] = seedPos - remainder;
  mem8[record] = seedPos - remainder + spanB;

  // ── Launch direction (fields +5 / +3) ─────────────────────────────────────────────────
  // A fourth PRNG draw's low bit picks how the object enters. +5 is the direction/flip bit; +3 is the
  // vertical/parked byte (0x00 = on the play row, 0xf0 = parked off-screen). An ODD draw reveals it on
  // screen (+5 = 0, +3 = 0); an EVEN draw parks it off-screen (+5 = 0x80, +3 = 0xf0).
  if (nextSpawnRandomByte(m) & 1) {
    mem8[(record + 5)] = 0;
    mem8[(record + 3)] = 0;
  } else {
    mem8[(record + 5)] = 0x80;
    mem8[(record + 3)] = 0xf0;
  }

  // ── Arm the record ────────────────────────────────────────────────────────────────────
  // Flip +6 (active/state byte) to 1 = armed, so the motion/staging arms begin advancing this object on
  // the next frame, and seed +9, the motion timer, to its reload value 8.
  mem8[(record + 6)] = 1;
  mem8[(record + 9)] = 8;
}
