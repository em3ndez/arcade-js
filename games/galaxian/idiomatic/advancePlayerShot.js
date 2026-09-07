// SPDX-License-Identifier: GPL-3.0-only
//
// advancePlayerShot (ROM 0x08bc, [seen]) -- the timing engine for the ship's single bullet.
//
// WHAT IT IS
//   Galaxian lets the player have only one shot in the air at a time, tracked by four adjacent work
//   cells. This routine is the whole state machine for that shot: it flies an airborne bullet up the
//   screen, and when no bullet is out it re-parks the shot at the bottom, seeded from the ship's column.
//   It touches no hardware -- it only advances the four RAM cells that advancePlayerShotAndStageSprite
//   (ROM 0x0898) later reads back and renders into the shot's sprite cells.
//
// ROLE IN THE MACHINE
//   GATE (loc_4208) bit0 means "a shot is in flight". While armed, COUNTER (loc_4209) is the bullet's
//   vertical position, drained 4/frame as it climbs, and FLAG (loc_420b) is the retire flag raised as
//   the bullet nears the top. When GATE is clear (no bullet airborne) COUNTER is re-parked at 220 (the
//   screen bottom) and FIELD (loc_420a) is seeded from the ship's X reference SOURCE (loc_4202) -- but
//   only while the object subsystem is live, gated by TRIGGER (OBJ_ACTIVE_FLAG, 0x4200) bit0; otherwise
//   FIELD is zeroed. That way a freshly fired bullet inherits the ship's column. (mechanisms.md, "The
//   player shot".)
//
// LIVE-OUT: COUNTER (0x4209), FIELD (0x420a), FLAG (0x420b).
import { loc_4208, loc_4209, loc_420a, loc_420b, OBJ_ACTIVE_FLAG, loc_4202 } from "./names.js";

// Local aliases name the four shot cells and the two inputs by the role each plays in this routine.
const GATE = loc_4208;
const COUNTER = loc_4209;
const FIELD = loc_420a;
const FLAG = loc_420b;
const TRIGGER = OBJ_ACTIVE_FLAG;
const SOURCE = loc_4202;

export function advancePlayerShot(m) {
  const { mem8 } = m;

  // GATE bit0 set: a bullet is airborne. Drain its position counter by four -- the bullet climbs the
  // screen one step per frame.
  if (mem8[GATE] & 0x01) {
    mem8[COUNTER] -= 4;
    const drained = mem8[COUNTER];
    // As the counter passes the narrow window 14..17 near the top of the screen, raise the retire flag.
    // A single decrement then a plain range test: landing in 14..17 raises the flag as the bullet tops out.
    if (drained >= 14 && drained <= 17) mem8[FLAG] = 1;
    return;
  }

  // GATE clear: no bullet out. Re-park the counter at 220 (bottom of the screen), ready for the next
  // shot to fire from there.
  mem8[COUNTER] = 220;
  // Seed the field from the ship's X while the object subsystem is live (TRIGGER bit0), else zero it,
  // so the next fired bullet starts in the ship's current column.
  mem8[FIELD] = mem8[TRIGGER] & 0x01 ? mem8[SOURCE] : 0;
}
