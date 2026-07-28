# The Pit — clarify/observe/name pass: what worked, what didn't

Running log for updating the cross-game methodology rules (docs/) after game #2.
Karl's persistence rule for this effort: **keep going while making progress; then re-spend
the same effort once more at the frontier to see if more is there.** MAME 0.288 = ground truth.

## What WORKED
- **Parallel decompile workflows, proposer≠confirmer per routine.** Scaled cleanly to many
  routines in flight at once; the adversarial reviewer caught real stale-m.call leaks the
  memory-equivalence gate is blind to.
- **The `no-stale-mcall` guard is load-bearing.** Decompiling a shared callee strands its
  callers' `m.call`s; the repo-wide guard (target-has-idiomatic-file) is the only thing that
  catches it. Keep it; whitelist genuine forever-loop boundaries explicitly.
- **proposer≠confirmer for NAMING (RAM + routines), not just decompiling.** The confirmer
  rejected 4 of 10 over-eager routine promotions (over-claim / sibling-name shadow / composite)
  and independently caught the "bonus/lives"→coinage mislabel and the FEATURE_TILE_LATCH 0x26
  correction. Adversarial confirmation measurably improved name quality.
- **Partition propagation by FILE.** Disjoint file-sets → parallel rename agents never collide.
- **Blind MECHANISMS rewrite** (writer has NO access to the previous version) produced a fresh,
  honest, count-accurate doc that didn't inherit stale framing. Preserve the old for comparison.
- **Documented `m.call` boundaries** for never-returning tail-calls: the pragmatic escape.

## What DIDN'T work / traps (→ rules for next game)
- **Forever-loop dissolution is cascade-fragile.** Dissolving a link into a never-returning
  routine (main loop / display hold) bypasses the registry stub that bounded UP-CHAIN tests,
  so they hang. The whole boot-spine cluster resisted clean dissolution twice.
  → RULE: for a routine that never returns, KEEP `m.call` as a documented boundary + guard
  whitelist. Do not dissolve it; a direct call is behaviorally identical and the test would be
  a fragile artifact.
- **Judging agent health by output silence = wrong.** I stopped a progressing agent twice on
  ~19-min output quiet; it was doing long analysis, not stuck (7/9→8/9 across the "silence").
  → RULE: judge a background agent by PROGRESS (files changed / task count), never by
  output-mtime quiet. Only intervene on genuine no-progress over a long window.
- **Early names lock in with partial understanding.** First-pass names, chosen at ~⅓ machine
  understanding, need a late re-derivation pass once fully decompiled + observed.
  → RULE: schedule an adversarial name-REVISIT pass at the end (question existing names, not
  just fill gaps), gated on observation.
- **Code-only reconstruction has a hard ceiling.** win/lose, actor identity, goal/creature
  meaning cannot be resolved by reading code — the game must be OBSERVED played.
  → RULE: bake a "poke-to-trigger + watch in MAME" observation step into the pipeline; it also
  extends the pixel gate to deep-gameplay paths.
- **Verify hardware/driver citations against the ACTUAL MAME source.** I "fixed" the driver
  citation to a nonexistent file (`thepit.cpp`) off an unverified web summary; the original
  `taito/roundup.cpp` was right (confirmed via `gh` code search on mamedev/mame).
  → RULE: the ungated board layer's driver citation must be checked against the real repo, not
  a search summary.
- **Agent-session cap bit mid-pipeline** (hit 200). → RULE: size the agent budget up front for
  the full decompile+dissolve+name+observe pipeline.

## Phase log (this effort)
- Phase 0 — commit the clarify pass (169/169 + names + blind MECHANISMS + documented spine
  boundaries). [in progress]
- Phase 1 — OBSERVE vs MAME (win/lose, actor identity, goal/creature; ROT90 axis). [in progress]
  - ✅ ROT90 axis RESOLVED: OBJ_STEP_X = screen-horizontal, OBJ_STEP_Y = vertical. Existing
    `_X`/`_Y` labels correct (sprite-format swap × ROT90 swap cancel); CARVE_SEAM_LEFT/RIGHT =
    screen left/right (horizontal). Confirmed 3 ways (renderer-compute from MAME sprite RAM +
    direct annotated-frame read + video.js code trace). FIX: ram.js `OBJ_X — X (column)` /
    `OBJ_Y — Y (row)` parentheticals are inverted vs the ×32 VRAM math — OBJ_X drives the row
    stride, OBJ_Y the column. (→ Phase 2 name-revisit.)
  - ✅ WORKS (rule for next game): agent-driven MAME observation — headless `-video none
    -aviwrite` capture + a per-frame Lua notifier logging the RAM cells + reading annotated PNG
    frames — resolves render/axis/identity questions that code-reading can't. Cross-check the
    frame reading against the validated renderer's own computation for a second, independent yes.
  - ⚠ GOTCHA (rule): a loose ROM-chip dump (`~/Downloads/thepit/*.ic*`) lacks the `.icNN`
    filenames MAME's `-verifyroms` needs; build a proper verified romset first (now at
    `scratchpad/mameroms/thepitu1`). Capture the AVI in DISPLAYED orientation (rotation applied,
    not `-norotate`) so the frames match what the player sees.
  - ✅ WIN/LOSE RESOLVED (all [seen]; 2 prior guesses CORRECTED): level-complete = the digger
    SURFACING at the top rung (OBJ_Y==0x23) with completion gate 0x8078 set — NOT collect-all-loot,
    NOT the goal tile 0x27; the LOOT_10/20 counts only pick the bonus TIER (SINGLE/DOUBLE/TRIPLE =
    5000/10000/15000). Death = an OBJ1/OBJ2 mover overlapping the digger's box → death pose (sprite
    0x35 blink) → MEN_LEFT-- → respawn; MEN→0 = GAME OVER → attract. The mystery "ZUN…" label is
    "ZONKER" (the enemy tank). Still open: what EARNS gate 0x8078; the goal-tile 0x27 traverse
    mechanic; the initials-entry path (score never qualified in these runs).
  - ⚠ GOTCHA (rule): MAME's `add_machine_frame_notifier` token MUST be retained in a global, or
    the Lua GC silently unregisters it after ~40 frames (the per-frame log just stops).
  - ✅ ACTOR CAST RESOLVED (sprite slot ↔ RAM entity, 100% match in both attract + gameplay runs):
    player = the DIGGER (slots 0+1, a little man); enemies = the maze MOVERS OBJ1 (slot4) / OBJ2
    (slot5, pink claw-creatures) + the two-sprite ACTOR (slots 6+7) = a flying SAUCER that descends
    then continues solo as a maze creature; BG_SPRITE (slot3) = a small left-chamber SPIDER — NOT
    the top-band UFO (guess REFUTED). The apparent enemies ZONKER (a tank banner), the top-left
    "UFO" (a dock graphic), and the entire bottom-band "creatures" are DECORATIVE TILEMAP, not
    sprites (guess REFUTED — the real enemies are the maze movers). Still [guess]: OBJ1's on-screen
    look (never entered view) + the saucer's game-role (player's ship vs enemy UFO).
  - GAME MODEL (now [seen]): dig down through the pit, then SURFACE at the top rung (with the
    completion gate earned) to clear the level; the claw-creatures/saucer kill you on contact.
  - Persistence rule in action: three rounds each landed big corrections, so a THIRD observation
    round is warranted (what EARNS gate 0x8078 = the actual objective; goal-tile 0x27; initials
    entry; OBJ1 on-screen).
  - ✅ LOOSE ENDS RESOLVED [seen]: (a) initials-entry works — the "never appeared" mystery is that
    the default high-score table is seeded to all-zero scores and insertHighScore needs candidate >
    table[rank3], so a score of 0 doesn't beat 0; any nonzero score qualifies (poked 250000 →
    "CONGRATULATIONS… RECORD YOUR INITIALS," full dial-3 flow confirmed). (b) OBJ1 = the SAME pink
    claw-creature as OBJ2, just normally parked clipped above the top edge. (c) the two-sprite
    SAUCER/ACTOR is an ENEMY — kills the player on contact via the SAME shared collision driver
    (loc_319d/handleObjectBoxOverlap) as the claw-creatures (positive test + negative control).
    → RULE: an "is X an enemy?" test must force the mover ACTIVE (MOVER_STATE≠0) AND actually
    overlap it onto the player; a same-cell pin on a dormant mover fires nothing (why an earlier
    death test was inconclusive).
  - ✅ OBJECTIVE RESOLVED [seen] — the whole game model, captured end-to-end in a NATURAL run
    (zero latch pokes): DIG DOWN into the pit; cross a FEATURE tile (0x26, sets FEATURE_TILE_LATCH
    0x8076 — the prerequisite that unlocks pickup); COLLECT the DIAMONDS (tiles 59-61, +20 each =
    the treasure; grabbing one sets the completion gate 0x8078 + LOOT_20PT_COUNT); then CLIMB UP
    and SURFACE at the top rung (OBJ_Y 0x806b == 0x23) with the gate set → SPAWN_PHASE fires (the
    completion actor) → LEVEL++. A/B proven (gate set → clears; gate clear → doesn't). The goal
    tile 0x27 is SEPARATE: crossing it → GOAL latches → auto-walk + progressive terrain
    scroll-reveal (REVEAL_CURSOR counts down, opens the next pit section); NOT required to complete.
    The 3 diamonds = the full treasure set (showBonusScreen tallies ==3 → bonus tier).
    → GOTCHA (game logic): the down-path collector refuses a diamond unless FEATURE_TILE_LATCH is
    set first — so a "drive straight through the diamonds" run collects nothing (stumped many runs).
  - ✅ COMPLETENESS-CRITIC round (the "do it once more") — all four targets [seen], WELL IS DRY:
    (1) Layout is LEVEL-INDEPENDENT — fixed board mode 160, same 3 diamonds + 4 dirt-gems + geometry
    every level; only DIFFICULTY scales (enemy periods 7→5, main-loop delay 9→8, reveal 5→4), and
    it's LATCHED PER-ROUND at setup (poking LEVEL mid-round doesn't retro-change seeded knobs).
    (2) 2-PLAYER: GAME_MODE 0x8001 = player COUNT; GAME_STATE2 0x8002 = active-player index (watched
    the P1→P2 handoff + saved-record swap end-to-end on a forced P1 death). (3) BONUS TIERS confirmed
    verbatim — SINGLE/DOUBLE/TRIPLE = 5000/10000/15000; mapping = collect the full 4-gem + 3-diamond
    set → TRIPLE (10-pt ==4, 20-pt ==3); over-collecting past the exact count via pokes DROPS the tier
    (explains the earlier loot20=6→SINGLE fluke). US licensee "CENTURI". (4) WEAK NAMES observed:
    CLIMB_GATE 0x8080 REFUTED (stayed 0 through a full dig-down+climb-up → keep hex); ANIM_RAND 0x808b
    = a decrementing DWELL/CADENCE timer tied to actor activity, NOT noise; ACTOR_STATE 0x8084 cycles
    with the saucer actor (defensible); VARIANT 0x8048 dormant (keep hex).
    → HONEST FLOOR (one more round won't move these — structural, not unlooked): sound-command→audio
    mapping stays [guess] (no audio oracle, tunes BYO-recorded by ear); VARIANT + CLIMB_GATE roles are
    dormant in every reachable play path (pinnable only by a mode/condition never entered).
  - ✅ Phase 1 verdict: the entire game — objective, cast, win/lose, mechanics — is now [seen],
    a leap the code-only doc could never make. GROUNDING (observation) phase COMPLETE after 4 rounds;
    → Phase 2 (name-revisit, proposer done + confirmer running) + Phase 3 (rewrite as a real game
    model). RULE for next game: this "grounding" pass runs on the REAL ROM in MAME so it needs NO JS
    build — front-load the BEHAVIORAL half (objective/cast/win-lose/mechanics) at day zero, before
    naming, to avoid the early-names-lock-in trap; the STRUCTURAL half (behavior↔addresses) threads
    through the decompile as the memory map fills in.
- Phase 2 — adversarial name-REVISIT with observed understanding. [pending]
- Phase 3 — blind MECHANISMS rewrite as a real game model + land. [pending]
