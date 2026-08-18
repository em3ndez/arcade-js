// SPDX-License-Identifier: GPL-3.0-only
/**
 * animateFrogHop — the four directional frog-hop handlers (DOWN/UP/RIGHT/LEFT), one multi-entry unit.
 *
 * WHAT IT IS
 *   The frog's locomotion. Frogger moves the frog in discrete 16-pixel hops, and this unit is the eight
 *   handlers that begin and animate one hop. Each direction has a BEGIN entry and an ADVANCE entry:
 *     DOWN   begin 0x1B8B   advance 0x1BBA
 *     UP     begin 0x1BE4   advance 0x1C0D
 *     RIGHT  begin 0x1C41   advance 0x1C76
 *     LEFT   begin 0x1CA0   advance 0x1CD5
 *   A BEGIN starts a hop; an ADVANCE steps that hop one frame. A hop plays out over a fixed number of
 *   frames set by the direction's reload length (seeded =9 each head pass => eight 2-pixel steps = one
 *   16-pixel tile of travel, with the ninth "drain" frame marking arrival) — so one press moves the frog
 *   exactly one tile.
 *
 * WHERE IT SITS
 *   Driven by the per-vblank input scan scanFrogInputAndDispatchHop (0x1ACB): on a fresh directional
 *   press it calls that direction's BEGIN, and every following vblank the direction stays active it calls
 *   the ADVANCE. (During the attract demo the scripted continuation advanceAttractDemoFrogHop (0x23B7)
 *   re-enters these same ADVANCE handlers under a canned hop script.) A BEGIN falls straight through into
 *   its own ADVANCE, so a single press both starts the hop and takes its first animation frame.
 *   DOWN/UP move FROG_Y (down = forward/increasing Y, up = back/decreasing Y); RIGHT/LEFT move FROG_X.
 *   UP is the forward/scoring direction: it also steps the home-bay slot cursor and scores row progress.
 *
 * GROUNDING
 *   [seen] — a MAME land-hop / attract-demo run watched the frog cells move (UP: FROG_Y climbs at
 *   -2/frame; RIGHT: FROG_X advances at +2/frame; arrival latched on the drain frame). DOWN was not
 *   exercised directly, but its shared begin body is grounded [seen] through the UP/RIGHT hops.
 *
 * LIVE-OUT
 *   Memory only — the frog position (FROG_X 0x8044 / FROG_Y 0x8047), the frog sprite code
 *   (FROG_SPRITE_CODE 0x8045), and the per-direction hop bookkeeping cells (active flag / arrival mirror
 *   / animation counter). Nothing is returned to the caller in a register.
 */
import {
  FROG_X, FROG_Y, FROG_SPRITE_CODE,
  FROG_HOP_DOWN_ACTIVE, FROG_HOP_UP_ACTIVE, FROG_HOP_RIGHT_ACTIVE, FROG_HOP_LEFT_ACTIVE,
  FROG_HOP_DOWN_ARRIVAL, FROG_HOP_UP_ARRIVAL, FROG_HOP_RIGHT_ARRIVAL, FROG_HOP_LEFT_ARRIVAL,
  FROG_HOP_DOWN_ANIM_COUNTER, FROG_HOP_UP_ANIM_COUNTER, FROG_HOP_RIGHT_ANIM_COUNTER, FROG_HOP_LEFT_ANIM_COUNTER,
  FROG_HOP_VERTICAL_DELTA, FROG_HOP_HORIZONTAL_DELTA,
  FROG_HOP_DOWN_ANIM_RELOAD, FROG_HOP_UP_ANIM_RELOAD, FROG_HOP_RIGHT_ANIM_RELOAD, FROG_HOP_LEFT_ANIM_RELOAD,
} from "./names.js";
import { loc_23eb } from "./loc_23eb.js";
import { scoreFrogRowProgress } from "./scoreFrogRowProgress.js";
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";

// Sound command 0x04 — the "hop" chirp, emitted through the sound mailbox the frame a fresh hop begins.
const HOP_SOUND = 0x04;

// Per-direction frog sprite codes stamped into FROG_SPRITE_CODE (0x8045). The REST code shows the frog
// sitting still (used at hop-begin and again once the hop arrives); the MOVE code shows it mid-hop. The
// values are the ROM's tile numbers for each pose.
const HOP_DOWN_REST_CODE = 0xde, HOP_DOWN_MOVE_CODE = 0xdc;
const HOP_UP_REST_CODE = 0x1e, HOP_UP_MOVE_CODE = 0x1c;
const HOP_RIGHT_REST_CODE = 0xa1, HOP_RIGHT_MOVE_CODE = 0x9f;
const HOP_LEFT_REST_CODE = 0x21, HOP_LEFT_MOVE_CODE = 0x1f;

// Emit the hop-start chirp: push HOP_SOUND (0x04) onto the sound queue via enqueueSoundCommand (0x0018).
function enqueueHopSound(m) {
  enqueueSoundCommand(m, HOP_SOUND);
}

// Shared BEGIN body. The four begin entries funnel through here, each passing its own direction cells and
// its matching advance handler. A begin does three things: on a genuinely fresh hop it emits the hop
// chirp and stamps the rest sprite, it (re-)primes the animation counter from the reload length, and it
// drops straight into the matching ADVANCE so the press also takes the hop's first frame.
function beginHop(m, counter, reload, restCode, advance) {
  const { mem8 } = m;

  // A zero animation counter (FROG_HOP_*_ANIM_COUNTER, 0x8250-0x8253) means no hop of this direction is
  // in flight — this is a genuinely fresh press. Announce it with the hop chirp.
  if (mem8[counter] === 0) {
    enqueueHopSound(m);

    // If the frog already shows this direction's rest sprite, the press is re-triggering a hop that just
    // landed in the same direction: simply re-prime the counter from the reload length
    // (FROG_HOP_*_ANIM_RELOAD, 0x8256-0x8259) and advance — skip the counter "bump" below entirely.
    if (mem8[FROG_SPRITE_CODE] === restCode) {
      mem8[counter] = mem8[reload]; // re-prime and advance, no bump
      return advance(m);
    }

    // Otherwise stamp this direction's rest sprite into FROG_SPRITE_CODE (0x8045) so the hop visibly
    // starts from rest, then fall into the counter bump.
    mem8[FROG_SPRITE_CODE] = restCode;
  }

  // The ROM's counter "bump": increment the counter and bail only if that increment wraps 0xFF->0. On a
  // fresh hop the counter is 0 so bumped = 1 (never wraps) and control reaches the reload+advance below;
  // the wrap-bail only guards the rare case of begin re-entered on a counter already at 0xFF. In practice
  // (mechanisms.md) a fresh press always reloads and advances.
  const bumped = (mem8[counter] + 1) & 0xff;
  mem8[counter] = bumped;
  if (bumped === 0) return; // the bump wrapped: bail with the counter left at zero

  // Prime the counter from this direction's reload length (seeded =9 each head pass) — the hop will now
  // animate for that many frames — then take its first frame by dropping into the matching ADVANCE.
  mem8[counter] = mem8[reload];
  return advance(m);
}

// Shared ADVANCE body for the three plain directions (DOWN/RIGHT/LEFT; UP has its own body below). It
// steps one hop by one frame: guard against re-stepping a hop that already landed, mark the hop active,
// tick the animation counter down, and on drain land the hop, else step the frog by the hop delta.
function advanceHop(m, arrival, active, counter, restCode, moveCode, step) {
  const { mem8 } = m;

  // The arrival mirror (FROG_HOP_*_ARRIVAL, 0x824c-0x824f) is the one-hop-per-press latch: set the moment
  // a hop lands, cleared only when the input scan reads the stick unpressed. While it stays set, re-entry
  // returns without moving — so holding the stick produces exactly one hop.
  if (mem8[arrival] !== 0) return; // this hop has already arrived

  // Raise this direction's active flag (FROG_HOP_*_ACTIVE, 0x8248-0x824b): a hop is now in flight, and
  // the input scan will keep dispatching ADVANCE here each vblank until it drains.
  mem8[active] = 1;

  // Tick the animation counter (FROG_HOP_*_ANIM_COUNTER, 0x8250-0x8253) down one frame.
  const left = (mem8[counter] - 1) & 0xff;
  mem8[counter] = left;

  // Counter drained: the hop has landed on its new tile. Clear active, set the arrival latch, and stamp
  // the rest sprite — the frog now sits still until the next press.
  if (left === 0) {
    mem8[active] = 0;
    mem8[arrival] = 1;
    mem8[FROG_SPRITE_CODE] = restCode;
    return;
  }

  // Still mid-hop: move the frog one delta step in this direction and show the moving sprite. Over the
  // eight stepped frames of a reload-9 hop the frog travels 8 * 2 = 16px — exactly one tile.
  step(m);
  mem8[FROG_SPRITE_CODE] = moveCode;
}

// The per-frame position steps handed to advanceHop. DOWN adds the vertical delta
// (FROG_HOP_VERTICAL_DELTA 0x8254, =2) to FROG_Y (0x8047) — down = increasing Y. RIGHT adds / LEFT
// subtracts the horizontal delta (FROG_HOP_HORIZONTAL_DELTA 0x8255, =2) on FROG_X (0x8044). (UP subtracts
// the vertical delta inline in its own advance body, since UP does not use the shared advanceHop.)
const stepHopDown = (m) => {
  m.mem8[FROG_Y] = m.mem8[FROG_Y] + m.mem8[FROG_HOP_VERTICAL_DELTA];
};
const stepHopRight = (m) => {
  m.mem8[FROG_X] = m.mem8[FROG_X] + m.mem8[FROG_HOP_HORIZONTAL_DELTA];
};
const stepHopLeft = (m) => {
  m.mem8[FROG_X] = m.mem8[FROG_X] - m.mem8[FROG_HOP_HORIZONTAL_DELTA];
};

// ── DOWN hop (begin 0x1B8B / advance 0x1BBA) ─────────────────────────────────────────────
export function beginFrogHopDown(m) {
  // Position guard: no down-hop once the frog is already at the bottom edge (FROG_Y 0x8047 >= 0xF0).
  if (m.mem8[FROG_Y] >= 0xf0) return; // frog at the bottom edge: no down-hop
  return beginHop(m, FROG_HOP_DOWN_ANIM_COUNTER, FROG_HOP_DOWN_ANIM_RELOAD, HOP_DOWN_REST_CODE, advanceFrogHopDown);
}
export function advanceFrogHopDown(m) {
  advanceHop(m, FROG_HOP_DOWN_ARRIVAL, FROG_HOP_DOWN_ACTIVE, FROG_HOP_DOWN_ANIM_COUNTER, HOP_DOWN_REST_CODE, HOP_DOWN_MOVE_CODE, stepHopDown);
}

// ── UP hop (begin 0x1BE4 / advance 0x1C0D) ───────────────────────────────────────────────
// UP is the forward/scoring direction and the only direction with no position guard at begin — the frog
// may always attempt an up-hop (the home-row logic upstream decides what happens once it reaches the top).
export function beginFrogHopUp(m) {
  return beginHop(m, FROG_HOP_UP_ANIM_COUNTER, FROG_HOP_UP_ANIM_RELOAD, HOP_UP_REST_CODE, advanceFrogHopUp);
}
// advanceFrogHopUp does NOT use the shared advanceHop body: the ROM inlines the arrival/active/counter
// logic here because UP does two extra things — it drives the home-bay slot cursor every frame, and it
// scores row progress on landing.
export function advanceFrogHopUp(m) {
  const { mem8 } = m;

  // Step the home-bay slot cursor (loc_23eb 0x23eb) once per UP-advance frame; its A output is scratch
  // here and discarded — UP-advance just piggybacks the cursor tick that the goal machinery expects.
  loc_23eb(m); // advance the home-bay slot cursor; its A output is discarded below

  // One-hop-per-press latch, same meaning as the shared body (FROG_HOP_UP_ARRIVAL 0x824d).
  if (mem8[FROG_HOP_UP_ARRIVAL] !== 0) return;

  // Mark the up-hop active (FROG_HOP_UP_ACTIVE 0x8249) and tick its counter (FROG_HOP_UP_ANIM_COUNTER
  // 0x8251) down one frame.
  mem8[FROG_HOP_UP_ACTIVE] = 1;
  const left = (mem8[FROG_HOP_UP_ANIM_COUNTER] - 1) & 0xff;
  mem8[FROG_HOP_UP_ANIM_COUNTER] = left;

  // Counter drained: the up-hop lands. Clear active, set arrival, stamp the up rest sprite (0x1E), and —
  // uniquely for UP — score the row via scoreFrogRowProgress (0x1FD6), which awards a point when the frog
  // has reached a new furthest row. Only forward (up) hops score; DE is scratch there, not live-out.
  if (left === 0) {
    mem8[FROG_HOP_UP_ACTIVE] = 0;
    mem8[FROG_HOP_UP_ARRIVAL] = 1;
    mem8[FROG_SPRITE_CODE] = HOP_UP_REST_CODE;
    scoreFrogRowProgress(m); // DE is scratch here, not live-out
    return;
  }

  // Still mid-hop: move the frog UP by subtracting the vertical delta (FROG_HOP_VERTICAL_DELTA 0x8254)
  // from FROG_Y (0x8047) — up = decreasing Y — and show the up moving sprite (0x1C).
  mem8[FROG_Y] = mem8[FROG_Y] - mem8[FROG_HOP_VERTICAL_DELTA];
  mem8[FROG_SPRITE_CODE] = HOP_UP_MOVE_CODE;
}

// ── RIGHT hop (begin 0x1C41 / advance 0x1C76) ────────────────────────────────────────────
export function beginFrogHopRight(m) {
  const { mem8 } = m;
  // Position guards: no hop while above the field top (FROG_Y 0x8047 < 0x30) or at the right edge
  // (FROG_X 0x8044 >= 0xE0).
  if (mem8[FROG_Y] < 0x30) return; // frog above the field top: no hop
  if (mem8[FROG_X] >= 0xe0) return; // frog at the right edge: no right-hop
  return beginHop(m, FROG_HOP_RIGHT_ANIM_COUNTER, FROG_HOP_RIGHT_ANIM_RELOAD, HOP_RIGHT_REST_CODE, advanceFrogHopRight);
}
export function advanceFrogHopRight(m) {
  advanceHop(m, FROG_HOP_RIGHT_ARRIVAL, FROG_HOP_RIGHT_ACTIVE, FROG_HOP_RIGHT_ANIM_COUNTER, HOP_RIGHT_REST_CODE, HOP_RIGHT_MOVE_CODE, stepHopRight);
}

// ── LEFT hop (begin 0x1CA0 / advance 0x1CD5) ─────────────────────────────────────────────
export function beginFrogHopLeft(m) {
  const { mem8 } = m;
  // Position guards: no hop while above the field top (FROG_Y 0x8047 < 0x30) or at the left edge
  // (FROG_X 0x8044 < 0x20).
  if (mem8[FROG_Y] < 0x30) return; // frog above the field top: no hop
  if (mem8[FROG_X] < 0x20) return; // frog at the left edge: no left-hop
  return beginHop(m, FROG_HOP_LEFT_ANIM_COUNTER, FROG_HOP_LEFT_ANIM_RELOAD, HOP_LEFT_REST_CODE, advanceFrogHopLeft);
}
export function advanceFrogHopLeft(m) {
  advanceHop(m, FROG_HOP_LEFT_ARRIVAL, FROG_HOP_LEFT_ACTIVE, FROG_HOP_LEFT_ANIM_COUNTER, HOP_LEFT_REST_CODE, HOP_LEFT_MOVE_CODE, stepHopLeft);
}
