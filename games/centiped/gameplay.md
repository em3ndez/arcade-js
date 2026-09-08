# Centipede (Atari, 1981) — gameplay

**Blind design document.** Written outside-in from **public web sources only, before and independent of the ROM/disassembly** (runbook §0). Its job is to describe what the game *does* from the player's side, so it can adjudicate mechanics the code alone can't settle later. Every non-obvious claim is attributed; items that are single-source, contradictory, or that only real play / MAME grounding can settle are marked **[FLAG]**.

**On sources:** most of this is drawn from independent play-facing sources (Wikipedia, strategy guides, retrospectives). A handful of numeric internals (per-wave speed thresholds, independent-head spawn frames, the 46-mushroom field, the 14-scheme color cycle) come from the community **6502disassembly.com** ROM analysis — that is *ROM-derived*, so those are **confirmation targets against our own MAME grounding, not independent adjudicators**; they are marked *[disasm]*.

MAME set being ported: **`centiped3`** (Centipede revision 3 — the ROM dump on hand); machine/driver `centiped`, **ROT270**. Gameplay is identical across revisions 1–4.

---

## 1. Objective & play field

Shoot every segment of a centipede that winds down a vertical, mushroom-filled playfield while surviving the other insects. Clearing all segments starts the next wave. The game is score-driven and endless (no win state) [Wikipedia].

- **The garden.** The field is seeded with **mushrooms** scattered across it (initial field holds up to **46** *[disasm]*). Mushrooms are both obstacles that steer the centipede and shootable targets.
- **The shooter ("Bug Blaster").** A small insect-like shooter at the **bottom** of the screen, moved with a **trackball**, firing darts upward [Wikipedia].
- **The player zone.** The shooter is confined to a band across the **bottom** of the screen (secondary sources: "the bottom fifth"). Its mushroom density drives the flea (§4), and contact deaths happen here.
  - **[FLAG]** Exact height of the player band, and whether the shooter moves vertically as well as horizontally within it — sources agree the trackball gives fluid movement in the lower area but don't pin the bounds. Confirm in play.

---

## 2. Controls

- **Trackball** (the defining control): free **horizontal** movement, **restricted vertical** movement within the bottom band. Gives Centipede its fast analog feel [Wikipedia; StrategyWiki].
- **Fire button** (single): holding produces continuous/rapid fire, but **only one dart on screen at a time** — the next fires automatically as soon as the current one hits something or leaves the top. Hold to sweep, tap for precision (e.g. the spider) [StrategyWiki].
  - **[FLAG]** Confirm the one-dart-at-a-time refire behavior and the band bounds in play.

---

## 3. The cast

### 3.1 Centipede

- **Composition.** A chain of body segments led by a head. **Segment count is the one number sources disagree on:** 12 (head + 11) [PixelatedArcade; 8 Bit Horse], "10 or 12" [The Game Hoard; Wikipedia]. *[disasm]* describes a 12-slot object (11-segment body + head). **[FLAG]** confirm first-wave length and how it decrements per wave.
- **Descent.** Enters at the **top** moving horizontally; travels straight until it hits **a mushroom or the screen edge**, then **drops one row and reverses direction** [Wikipedia; 8 Bit Horse]. Denser mushrooms → faster, more erratic descent.
- **Shooting a body segment → SPLIT + mushroom.** Destroys that segment, **leaves a mushroom** there, and **splits the chain into two independent centipedes**; the rear half sprouts its **own new head** [Wikipedia; The Game Hoard; 8 Bit Horse].
- **Shooting the head.** Destroys the head; the **next segment becomes the new head** and the chain continues [Wikipedia].
- **Every** destroyed segment (head or body) drops a mushroom, steadily thickening the garden.
- **At the bottom (player zone).** The centipede does **not** exit — it stays in the player area snaking back and forth, and **single-segment "head" centipedes periodically appear from the sides** (fast, length-1) [Wikipedia; The Game Hoard].
  - **[FLAG]** Whether reinforcement heads spawn continuously vs. on a timer, and any cap. *[disasm]* suggests a spawn delay starting ~192 frames, −8 per head created, floor ~96, tightening every 10,000 pts.
- **Ending a wave:** only when **every** segment (all splits + detached heads) is destroyed. Then a new centipede enters. Per Wikipedia, "each successive centipede is one segment shorter and accompanied by one detached, faster-moving head" **[FLAG single-source]**.

### 3.2 Spider

- Enters the **player area** from a side; present across most of the game, independent of the centipede [Wikipedia; RGDZ].
- **Movement:** crosses the player zone in a **zig-zag** (45° bounces, with an apparent random component); "never turns around until it has crossed the field" [Wikipedia; RGDZ; StrategyWiki].
- **Eats mushrooms** it passes over (thins the lower field — can then trigger the flea).
- **Lethal on contact.** Dies to a single shot (uncontested but **[FLAG]** worth verifying).
- **Proximity scoring — 300 / 600 / 900:** the only variable-value target; closer when shot = more points [Wikipedia; StrategyWiki].
  - **[FLAG]** Exact distance thresholds for the three bands.

### 3.3 Flea

- **Trigger:** appears only when the **lower player area is too sparse** with mushrooms — the game's mechanism for refilling a depleted garden [Wikipedia; RGDZ; 8 Bit Horse]. First appears **wave 2** [PixelatedArcade].
- **Behavior:** **falls straight down** from the top, dropping a **column of new mushrooms**, then vanishes at the bottom.
- **Two hits:** the **first shot only speeds up its descent**; the second destroys it [RGDZ; PixelatedArcade; 8 Bit Horse]. Accelerates further after 60,000 pts *[disasm/strategy]*.
- **Lethal on contact.** Killing one can immediately trigger another while the field is still sparse.
  - **[FLAG]** The exact mushroom-count threshold that arms the flea, and its two fall speeds.

### 3.4 Scorpion

- First appears **wave 3** [PixelatedArcade + search] **[FLAG — not in Wikipedia]**.
- **Movement:** travels **horizontally straight across the upper field** (above the player zone); never enters the player band, so it is not itself a contact threat in normal play.
- **Poisons every mushroom it passes** (color-changed) [Wikipedia; RGDZ; 8 Bit Horse].
- **Effect on the centipede:** a segment/head touching a **poison mushroom** abandons the zig-zag and **drives straight down** to the bottom, then resumes normal movement — can dump a centipede into the player zone fast, which is why the scorpion is considered the most dangerous enemy despite never touching the player.
  - **[FLAG]** Exact first wave, later-wave frequency, traversal speed, on-screen duration.

### 3.5 Mushrooms

- **Created by:** pre-seeding each life/wave; **every centipede segment shot**; **flea trails**.
- **Steer the centipede:** solid obstacle → the centipede drops a row and reverses at one (as at a wall).
- **Destruction — 4 hits**, eroding visibly with each hit ("like the Space Invaders shields") [The Game Hoard; StrategyWiki]. Stages: full → chipped(3) → (2) → (1) → clear.
  - **[FLAG]** The exact sprite for each of the 4 damage stages.
- **Poison mushrooms:** turned by the scorpion; still a normal 4-hit obstacle, but trigger the straight-down dive.
- **Restoration:** on a lost life (and, per some sources, at wave end), damaged mushrooms are repaired and poison is cleared, with a small point bonus each (§5). Fully-cleared tiles stay cleared — the layout persists; it is **not** re-seeded.

---

## 4. Scoring

| Target | Points | Confidence |
|---|---|---|
| Centipede body segment | **10** | Wikipedia (consistent everywhere) |
| Centipede head | **100** | Wikipedia (consistent) |
| Mushroom destroyed (ordinary) | **1** | Wikipedia, 8 Bit Horse |
| Mushroom restored/regenerated, then shot | **5** each | Wikipedia, 8 Bit Horse |
| Spider (by proximity) | **300 / 600 / 900** | Wikipedia, StrategyWiki |
| Flea | **200** | Wikipedia — **[FLAG]** RGDZ says 100 |
| Scorpion | **1,000** | Wikipedia, RGDZ |
| Extra life | every **12,000** pts (DIP default) | see §5 |

- **[FLAG]** Spider tier distance thresholds unpublished — pin in MAME.
- **[FLAG]** Flea value contradictory (200 vs 100) — confirm in MAME.
- **[FLAG]** No separate per-wave clear bonus is documented — confirm there is none beyond the mushroom-restoration award.

---

## 5. Lives, bonus life, death/reset

- **Death on contact** with any hostile: centipede segment/head, spider, flea (scorpion normally kills only indirectly). Game over when lives are exhausted.
- **On a lost life:** all poison mushrooms revert to normal; all partially-damaged mushrooms are restored to full (each restored mushroom scores 5 if later shot); the field **layout persists** (only damaged/poison state is healed) [Wikipedia; 8 Bit Horse; PixelatedArcade].
- **Starting lives (DIP):** 2 / **3 (default)** / 4 / 5 [Fabozzi; arcade-museum].
- **Bonus life (DIP):** 10,000 / **12,000 (default)** / 15,000 / 20,000 [Fabozzi; arcade-museum]. **There is no "none" option on Centipede** (that exists on Millipede).
  - **[FLAG]** Confirm whether the bonus is one-time or recurs at each multiple of the threshold.
  - **[FLAG]** Confirm whether poison also clears at wave end (not only on death), the exact per-mushroom restore bonus, and any shooter reposition on death.

---

## 6. Wave progression & difficulty

- A wave is cleared by destroying every centipede segment; the next centipede enters from the top.
- **Per-wave differences (well-documented):** shorter main chain, **more independent single heads**, higher speed.
- **Speed** *[disasm]*: main centipede starts at **1 px/frame**; above **40,000 pts** the main centipede's initial speed rises to **2 px/frame**; independent heads always move at **2 px/frame**. **[FLAG]** confirm.
- **Sub-40K "two passes":** several sources say below 40,000 pts each wave is effectively cleared twice (a slow centipede then a fast one); this may just be the "1 px until 40K, then 2 px" speed rule described differently [arcade-history; StrategyWiki] **[FLAG]**.
- **"Centipede starts further down on later waves" — [FLAG / likely misconception]:** could not confirm; the centipede always enters at the top; later waves *feel* faster because the mushroom field is **denser**, not because the start row lowers.

---

## 7. Visuals, two-player, end behavior

- **Color cycling:** the palette advances per wave — a signature trait (the famous pastel palette). *[disasm]*: **14 per-wave color schemes**, wave 15 reuses wave-1 colors, then repeats; each wave recolors body/mushroom, legs/gun, and eyes/outline/text, and swaps two motion-object color slots. **[FLAG]** confirm whether the **background** color also advances per wave (Centipede colors come from writable color RAM at 0x1400 — there is *no* color PROM). 16 background colors are selectable in service mode.
- **Two-player:** 1 or 2 players, **alternating** (not simultaneous). **[FLAG]** confirm whether each player keeps an **independent persistent mushroom field + separate score** (Atari alternating coin-ops usually do; sources ambiguous for the 1981 board). High scores persist in the board's **EAROM**.
- **End behavior:** score stored to **999,999**, then **rolls over** [forum] **[FLAG]**. Community lore: difficulty ramps hard ~240,000; spider begins reaching row 12 ~860,000 (defeats the "blob" defense); a reported anomaly ~996,000 — all **[FLAG]** community-sourced. No documented kill screen **[FLAG — absence not positively documented]**.

---

## 8. Strategy (well-documented, informs test scenarios)

- **Tunnel:** leave a single vertical column clear so the chain descends straight down it; nearly every shot connects.
- **Blob:** cultivate a dense mushroom cluster low near the shooter as a defensive wall (stops working ~860K when the spider reaches row 12).
- **Farm the spider** point-blank for 900s; it also eats mushrooms.
- **Suppress the flea** by keeping enough low mushrooms.
- **Kill the scorpion fast** to limit poison in your tunnel.

---

## 9. Cabinet & history

- **Cabinets:** upright, cabaret (mini), cocktail. Vertical monitor. Same PCB for upright/cocktail; upright-vs-cocktail is selected by a **harness pin** (not a DIP), with a **software 180° flip** in cocktail between turns [arcade-museum forums] **[FLAG on exact pin]**.
- **DIP:** two 8-position switches — game options (language EN/DE/FR/ES, lives, bonus, difficulty easy/hard, credit minimum) and coinage (coin/credit, multipliers, bonus-coin adder) [Fabozzi; arcade-museum].
- **Release:** **August 1981** (arcade, N. America), Atari, Inc.
- **Designers:** **Ed Logg** (design) and **Dona Bailey** (~half the programming). Bailey joined Atari coin-op in 1980 as the only woman in the division, having learned 6502 assembly at GM; she chose the worm concept, created the spider, fought for the trackball, and pushed the pastel palette. **[FLAG]** The flat "first woman to design an arcade game" overstates the sources; prefer "one of the first women to program an arcade coin-op / the only woman in Atari coin-op at the time."
- **Reception:** a major hit, Atari's second best-selling coin-op; ~3rd-highest-grossing arcade game of 1982 (tied with Donkey Kong); notable for a large female player base (~half). Sequel: **Millipede (1982)**.

---

## 10. Master checklist — verify against MAME during grounding

1. First-wave centipede segment count (10 / 11 / 12) and per-wave decrement.
2. Bottom-zone reinforcement heads: continuous vs. timer, any cap; the 192→96-frame spawn model *[disasm]*.
3. The four mushroom damage sprites.
4. Spider proximity thresholds (300/600/900) and one-shot kill.
5. Flea arming threshold, two fall speeds, and **point value (200 vs 100)**.
6. Scorpion first wave (3?), frequency, traversal speed, on-screen duration.
7. Life-loss/wave-end mushroom restoration scope (health/poison only, never layout), the restore bonus, starting lives, extra-life interval (12,000?) and whether it recurs.
8. Speed rule (1→2 px/frame at 40K) and the sub-40K "two passes" mechanic.
9. Color cycle (14 schemes, wave-15 reset) and whether the background advances per wave.
10. Two-player: independent persistent field + separate score?
11. Score rollover at 999,999; difficulty thresholds (240K, 860K); the ~996K anomaly; absence of a kill screen.
12. Trackball feel: band bounds, one-dart-at-a-time refire.
