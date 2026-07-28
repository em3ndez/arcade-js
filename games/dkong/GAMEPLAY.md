# Donkey Kong (Nintendo, 1981) — How It's Played

> **What this document is.** A *day-zero, outside-in* description of how Donkey Kong
> is *played*, written from public sources only (Wikipedia, KLOV / Museum of the Game,
> StrategyWiki, the Super Mario Wiki, NinDB, GameFAQs, classic-gaming guides). This is
> the understanding a player or researcher can build **without ever opening the ROM** —
> the mental model you'd want on paper *before* touching any code or disassembly.
>
> **Backdated methodology note.** This reconstructs the "before we looked inside" view
> on purpose. Nothing here is derived from the binary, from MAME internals, or from any
> file elsewhere in this repo. Anything the public record disagrees on, or is unsure of,
> is flagged inline. No hardware or internals — only *how it plays*.

---

## 1. The game in one paragraph

Donkey Kong is a single-screen platform ("climbing") game released by Nintendo in 1981,
designed by Shigeru Miyamoto. You play a little carpenter — originally unnamed, credited
in-game as **Jumpman**, later renamed **Mario** — trying to rescue his girlfriend
**Pauline** (originally called simply "the Lady") from a giant ape, **Donkey Kong**, who
has carried her to the top of a construction site. You climb four different single-screen
stages, dodging or destroying everything Kong throws at you, and when you clear the fourth
you knock Kong down and win Pauline back — only for Kong to grab her again and start the
whole cycle over, faster and meaner. It is the debut of both Mario and Donkey Kong.

---

## 2. Story / framing

- **Jumpman / Mario** — the player character. A carpenter (later a plumber in lore). His
  whole toolkit is *run, climb, and jump*.
- **Pauline / "the Lady"** — the captive at the top of each stage. She calls for help
  ("HELP!") and drops personal items you can collect for points (see §6).
- **Donkey Kong** — the antagonistic ape at the top of the screen. In the arcade framing
  he is Jumpman's mistreated pet who has escaped and kidnapped Pauline. He actively hurls
  barrels, drops fireballs, and pounds his chest to change the stage around you.
- **The arc** — reach the top → rescue Pauline → Kong recaptures her and climbs higher →
  repeat. On the final board type you literally dismantle the structure under Kong so he
  falls. It is a rescue loop, not a story with an ending. *(Sources: Wikipedia; Super
  Mario Wiki; arcade-history / KLOV; StrategyWiki.)*

---

## 3. Controls

Simple, two-input scheme on the arcade cabinet:

- **Four-way joystick** — move Jumpman **left / right** along girders and platforms, and
  **up / down** to climb ladders.
- **One jump button** — a short hop. Used to clear barrels and other obstacles, to reach
  the hammer, and (on the rivet stage) to leap the gaps left by pulled rivets.

Notes a player learns fast:
- You **cannot jump while carrying the hammer**, and you cannot climb ladders while
  holding it either (see §5).
- Jumping *over* a hazard at the right moment both avoids it and scores points; mistiming
  a jump — or falling too far — kills you.

*(Sources: Wikipedia; arcade-history / KLOV; classicgaming.cc play guide.)*

---

## 4. The four screens (board types) and how you progress

One full "level" is four distinct single-screen stages, labelled by height. The
**canonical arcade order is 25 m → 50 m → 75 m → 100 m**, and this order is agreed by
Wikipedia, StrategyWiki, the Super Mario Wiki and GameFAQs.

> **Public-record disagreement (flagged).** Some casual play guides (e.g. classicgaming.cc)
> present the boards in a *different* order — putting the elevators before the pie factory.
> Treat those as errors or as descriptions of a home port. Famously, the **NES / Famicom
> port omits the 50 m conveyor/cement stage entirely** and has fewer boards, which is a
> common source of "how many levels are there?" confusion. The *arcade original* has all
> four board types described below.

### 4.1 — 25 m: Girders & Barrels (the "ramp" stage)
The iconic first screen. Jumpman starts at the bottom-left of a construction site made of
slanted (bent) girders joined by ladders. Donkey Kong stands at the upper-left with
Pauline above him and **rolls barrels** down the girders toward you; barrels tumble down
the slopes and sometimes roll down ladders ("wild"/"crazy" barrels).

- **Hazards:** rolling barrels, plus **fireballs**. An oil drum / oil can sits at the
  bottom-left. Certain **blue barrels** that reach the oil drum spawn a fireball, which
  then climbs the structure hunting Jumpman (fireballs can climb ladders).
- **Goal:** climb to the top and reach Pauline.
- **Tools:** two **hammers** are available (see §5).

### 4.2 — 50 m: Conveyors / "Pie Factory" / Cement
A five-storey structure of **conveyor belts**. Some belts carry **cement pans / tubs**
(often nicknamed "pies") that slide along and kill Jumpman on contact; the belts run in
set directions so timing your walk against/with the belt matters. **Fireballs** patrol,
typically along an upper layer, and some **ladders retract and extend** when Donkey Kong
pounds his chest, opening and closing your routes.

- **Hazards:** moving cement pans on the conveyors, fireballs, disappearing ladders.
- **Goal:** climb through the shifting layers to the top.
- This is the stage most often cut from home conversions.

### 4.3 — 75 m: Elevators & Springs
A stage of moving **elevator platforms** you ride up (and that also go down), plus
**springs** — bouncing coil hazards (sometimes called "jacks" or "spring-weights") that
bound across the top of the screen from where Donkey Kong stands and then drop straight
down between the platforms. Two flame/fireball enemies also roam.

- **Hazards:** the elevators themselves (ride the right one, avoid being carried off the
  bottom), bouncing springs, and flames.
- **Goal:** time the elevators and springs to reach Pauline at the top-right.

### 4.4 — 100 m: Rivets (the finale)
The structure supporting Donkey Kong is held together by **eight rivets**. Instead of
just climbing to a spot, you must **remove every rivet** by walking/running over each one
(they pop out as you pass). Flames roam the platforms; on this stage the flames are drawn
larger than the ordinary fireballs and are harder to jump.

- **Hazards:** flames (the larger "fire" variant), and the gaps left where rivets are
  pulled — you must jump those gaps.
- **Goal:** pull all eight rivets. When the last rivet is gone, the platforms give way,
  **Donkey Kong falls** (head-first, knocked out), Pauline is reunited with Jumpman — and
  then Kong revives and carries her off again to start the next, harder loop.

### 4.5 — The loop and rising difficulty
Clearing 100 m does **not** end the game. It loops back to 25 m as a new, higher level
with tougher parameters: Donkey Kong throws barrels **faster** and sometimes **diagonally**,
fireballs move quicker, and the starting bonus timer is set differently per level (see §6).
The game is designed to be played indefinitely until you run out of lives — except for a
famous hard stop:

- **The kill screen — level 22.** On the first board of level 22 (counted as the 130th
  board overall in some tallies), a bug leaves the bonus timer set far too low, so the
  timer runs out and kills Jumpman after only a few seconds no matter how well you play.
  This effectively caps the game and is legendary in the competitive high-score scene.
  *(The public explanation attributes it to an integer/overflow error in how the per-level
  starting bonus is computed — e.g. a value that wraps past 8 bits at level 22. Sources
  state the effect confidently; the exact arithmetic is a community reconstruction, so
  treat the specific formula as "widely reported" rather than certain.)*

*(Sources for §4: Wikipedia; Super Mario Wiki pages for the game, 25m/50m/75m/100m;
StrategyWiki; NinDB; GameFAQs; classicgaming.cc.)*

---

## 5. The hammer (power-up)

Two hammers appear across the barrel/pie/rivet stages (they show up on 25 m, 50 m and
100 m; there is no hammer to rely on the same way on 75 m). Grabbing one triggers an
automatic behaviour:

- Jumpman **swings the hammer up and down repeatedly**, on a timer, and **smashes anything
  he touches** — barrels, fireballs/flames, cement pans.
- While holding the hammer you **cannot jump, cannot climb ladders, and cannot drop it** —
  you're locked into swinging until it expires. So it's both a weapon and a liability: it
  clears your immediate path but strands you on the current level of girders and costs you
  time.

**Commonly documented strategy:** leave the *first* (lower) hammer alone except in an
emergency, and use the *second* (upper) hammer more freely on early levels when there's
plenty of bonus time. On 100 m, a known tactic is to pull the left-side rivets first
(snaking bottom-to-top) so that new flames spawning on the left get **cut off** by the
missing rivets, then grab the central hammer and smash flames while staying right of
centre. There is also a competitive **"no-hammer" category** — top scoreboard players
often avoid the hammer entirely because the time it wastes is worth more than the points
it smashes. *(Sources: Donkey Kong Wiki (Hammer); StrategyWiki; NinDB; Wikipedia — high
score competition.)*

---

## 6. Scoring, the bonus timer, and prizes

**Starting resources:** you begin with **3 lives**, and earn a **bonus life at 7,000
points**. You lose a life if Jumpman touches Donkey Kong or any hazard, falls too far, or
lets the bonus timer hit zero. Game over when all lives are gone.

**Bonus timer.** Each stage starts a **bonus counter** (shown top-right) that steadily
counts *down*; whatever remains when you finish is added to your score, so speed pays.
Widely reported per-level starting values:

| Level | Starting bonus |
|-------|----------------|
| L-01  | 5,000 |
| L-02  | 6,000 |
| L-03  | 7,000 |
| L-04 … L-21 | 8,000 |

Letting the counter reach zero kills Jumpman — which is exactly the mechanism behind the
level-22 kill screen.

**Jumping obstacles (in one hop):**

| Action | Points |
|--------|--------|
| Jump over 1 barrel / fireball | 100 |
| Jump over 2 at once | 300 |
| Jump over 3 at once | 500 |

**Hammer smashes:**

| Smashed with hammer | Points |
|---------------------|--------|
| Barrel | 300 |
| Fireball / flame / cement pan (escalating) | 300, then 500, then 800 |

**Rivet stage (100 m) specials:** removing a rivet = **100** each; jumping right next to
Donkey Kong = **100**.

**Pauline's dropped items (the "prizes").** Pauline loses three personal belongings —
a **hat** (sunhat/cap), a **parasol** (umbrella), and a **purse/handbag/bag** — which
appear on the stages **other than 25 m** (i.e. on 50 m, 75 m, 100 m). Walk over one to
collect it for bonus points, scaling by level:

| Level | Points per item |
|-------|-----------------|
| 1 | 300 |
| 2 | 500 |
| 3 and beyond | 800 |

*(Sources for §6: Wikipedia; GameFAQs "Points" FAQ; Super Mario Wiki — Donkey Kong (game)
and "Pauline's lost items"; NinDB; classicgaming.cc. Point tables cross-check across
GameFAQs and the wikis; minor wording differences exist but the numbers agree.)*

---

## 7. Enemies & hazards — glossary

- **Barrels** — Kong's main weapon on 25 m; roll down girders and sometimes down ladders
  ("wild"/"crazy" barrels). Jump them or smash them.
- **Blue barrels** — a variant that, if it reaches the oil drum, releases a fireball.
- **Fireballs** — small sentient flames that emerge from the oil drum/oil can and chase
  Jumpman, **including up ladders**. Killable with the hammer.
- **Fires / flames (100 m)** — a larger fireball variant on the rivet stage; harder to
  jump over.
- **Cement pans / tubs ("pies")** — moving hazards riding the 50 m conveyor belts; lethal
  on contact.
- **Springs ("jacks" / spring-weights)** — bouncing coils on 75 m that bound across the top
  and drop down between platforms.
- **Donkey Kong himself** — touching him is fatal; he also actively reshapes stages
  (retracting ladders on 50 m by pounding his chest).

> **Naming note — "Foxy".** The task brief asked whether the springs are called "Foxy."
> Nothing in the public record names the 75 m springs "Foxy." What *does* exist is that the
> flame/fireball enemies are informally called **"firefoxes"** or **"foxfires"** in some
> write-ups (alongside the official "Fireball" / "Fire"). The most likely explanation is
> that "Foxy" is a garbled memory of the **firefox** flame nickname, not a spring name. The
> springs' documented names are "spring" and "jack." Flagged as a public-record ambiguity.

*(Sources for §7: Super Mario Wiki — Fireball (Donkey Kong), 25m/50m/75m/100m; Donkey Kong
Wiki (Fandom); StrategyWiki.)*

---

## 8. Notable publicly documented strategy / tips

- **Move right immediately on 25 m** to dodge Kong's very first barrel, then pick a ladder
  route up. *(classicgaming.cc)*
- **Bank bonus time, not hammer points.** On higher levels the bonus timer is worth more
  than hammer smashes; strong players skip the hammer to keep moving. The **"no-hammer
  challenge"** is a recognised competitive category. *(Wikipedia — high score competition;
  StrategyWiki.)*
- **Reach the upper hammer** on 25 m by jumping from the left ramp or standing at a platform
  edge and jumping straight up. *(StrategyWiki / forums.)*
- **75 m springs:** stand above the right elevator, wait for a spring to bounce past
  overhead, then dash for the ladder the instant it clears. *(StrategyWiki.)*
- **100 m rivets:** pull the left-side rivets first, bottom-to-top, to fence off newly
  spawning flames on the left; then work the right side and use the central hammer
  sparingly. *(StrategyWiki / retro guides.)*
- **Score chasing:** big scores come from stacking multi-obstacle jumps (300/500 for two/
  three at once), collecting all three of Pauline's items every stage, and finishing with a
  high remaining bonus. The community goal of a "million points" is built on exactly these.
  *(GameFAQs; itstillworks guide.)*

---

## 9. Open questions / things the public record is unsure about

1. **Board order in secondary guides.** Canonical arcade order is 25→50→75→100, but casual
   guides sometimes reorder them or describe port-specific layouts (NES drops 50 m). Trust
   the primary references (Wikipedia / StrategyWiki / Super Mario Wiki / GameFAQs).
2. **Exact kill-screen arithmetic.** The *existence* of the level-22 kill screen is certain
   and well-attested; the precise overflow formula for the starting bonus is a community
   reconstruction and is reported with slightly different phrasings.
3. **"Foxy" enemy name.** Not found in public sources for the springs; most likely a
   conflation with the "firefox/foxfire" flame nicknames (see §7).
4. **Item placement.** Sources agree the hat/parasol/purse appear on the non-25 m stages
   and give the 300/500/800 scaling, but exact per-stage spawn positions aren't consistently
   documented outside of play experience.
5. **Precise per-level difficulty parameters** (exact barrel speeds, spawn rates, diagonal-
   throw thresholds) are described qualitatively ("faster, sometimes diagonal") in public
   sources rather than as hard numbers — those would only be pinned down inside-out.

---

## Sources

Public, outside-in sources used for this document (all consulted July 2026):

- **Wikipedia — Donkey Kong (1981 video game):** https://en.wikipedia.org/wiki/Donkey_Kong_(1981_video_game)
- **Super Mario Wiki — Donkey Kong (game):** https://www.mariowiki.com/Donkey_Kong_(game)
- **Super Mario Wiki — Pauline's lost items:** https://www.mariowiki.com/Pauline%27s_lost_items
- **Super Mario Wiki — 50m:** https://www.mariowiki.com/50m
- **Super Mario Wiki — Fireball (Donkey Kong):** https://www.mariowiki.com/Fireball_(Donkey_Kong)
- **StrategyWiki — Donkey Kong / Walkthrough:** https://strategywiki.org/wiki/Donkey_Kong/Walkthrough
- **StrategyWiki — Donkey Kong / Gameplay:** https://strategywiki.org/wiki/Donkey_Kong/Gameplay
- **NinDB — Donkey Kong (Arcade) Guide:** https://nindb.net/guides/old/donkey-kong/index.html
- **GameFAQs — Donkey Kong (Arcade) "Points" FAQ:** https://gamefaqs.gamespot.com/arcade/584001-donkey-kong/faqs/74551/points
- **arcade-history.com — Donkey Kong (1981):** https://www.arcade-history.com/?n=donkey-kong&page=detail&id=666
- **Museum of the Game / KLOV — Donkey Kong:** https://www.arcade-museum.com/Videogame/donkey-kong
- **Donkey Kong Wiki (Fandom) — game / Hammer / 25m / 100m:** https://donkeykong.fandom.com/wiki/Donkey_Kong_(game)
- **classicgaming.cc — Donkey Kong play guide:** https://classicgaming.cc/classics/donkey-kong/play-guide
- **Wikipedia — Donkey Kong high score competition:** https://en.wikipedia.org/wiki/Donkey_Kong_high_score_competition

*(A few of these — arcade-history.com, arcade-museum.com, StrategyWiki, GameFAQs — blocked
direct automated fetching during research; their content was captured via search-result
excerpts and cross-checked against the sources that did load, chiefly Wikipedia, the Super
Mario Wiki, NinDB and classicgaming.cc.)*
