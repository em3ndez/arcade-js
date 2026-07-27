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
- Phase 1 — OBSERVE vs MAME (win/lose, actor identity, goal/creature; ROT90 axis). [pending]
- Phase 2 — adversarial name-REVISIT with observed understanding. [pending]
- Phase 3 — blind MECHANISMS rewrite as a real game model + land. [pending]
