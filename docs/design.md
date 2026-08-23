# Nodi — Design

Mobile-first, iOS native feel. Every screen is a phone screen. Decisions default to Apple HIG
where unspecified. Inspiration: Stocks.app (information density), Apple TV (poster-led browsing),
SpendStack (detail hierarchy), Apple Wallet (colour discipline).

---

## 1. Typography

### The principle
Type communicates hierarchy before the user reads a word. A movie-tracking screen still carries
3-4 tiers of information: poster, title/rating, supporting metadata, and low-priority context.
The eye should land on the poster or title first, scan to the rating or watch state, and ignore
the rest unless it wants it. Size alone does not create hierarchy - size + weight + colour together
do. A 13px muted label reads as clearly tertiary as an 11px one, with better legibility.

### Scale

| Role | Size | Weight | Colour default | Use |
|------|------|--------|----------------|-----|
| `display` | 32px | 700 | text-primary | Page header titles ("Movies", "Stats"), top stat values |
| `title-1` | 22px | 700 | text-primary | Movie titles in detail, important stat numbers, section titles |
| `title-2` | 20px | 600 | text-primary | Card / section titles |
| `headline` | 17px | 600 | text-primary | Primary list item: movie title, search result title |
| `body` | 15px | 400 | text-primary | Overview text, ratings, standard labels |
| `subheadline` | 13px | 400 | text-2 | Supporting context: release date, genre, language, tag count |
| `footnote` | 11px | 400 | text-faint | Dense metadata in lists: year, sync state, secondary labels |

### Rules
- **Never use footnote for standalone text.** It only works when anchored next to headline or
  body text that provides contrast. A screen of footnote-sized text is unreadable.
- **Footnote is acceptable in dense list rows** (search results, cast rows, tag metadata) where the
  primary text is headline size and the metadata is genuinely tertiary.
- **Numbers that users act on** (rating, watched totals, runtime totals) are never below `body`
  (15px). Personal ratings are whole numbers in the UI, shown as user-owned state rather than as
  `x/10` copy.
- **tabnum** class on all statistics and runtime numbers - prevents layout shift as digits change.
- Line heights: display/title 1.1-1.2, everything else 1.4.

### What this looks like in a movie row
```text
Memories of Murder             <- headline (17px, semibold, text-primary)
2003 · Korean · Watched        <- footnote (11px, text-faint)
```

The contrast between these two is the hierarchy. The metadata does not need to be 13px - it needs
to be visually subordinate to the title, which it is at 11px given the 17px primary.

---

## 2. Colour

### Philosophy
One colour per semantic meaning. Never two shades of green meaning the same thing.
Raw hex values and rgba() never appear in component code - only tokens.

### Tokens (CSS variables - already in globals.css)

**Backgrounds**
```css
--bg-primary    Page background
--bg-secondary  Card / sheet surface
--bg-tertiary   Input background, inactive toggles
--bg-nav        Nav bar (with blur)
```

**Text**
```css
--text-primary  Primary content (100% opacity equivalent)
--text-2        Secondary content (~60% opacity)
--text-muted    Supporting (~40% opacity)
--text-faint    Metadata / disabled (~25% opacity)
```

**Structure**
```css
--border        Standard border
--border-faint  Subtle dividers
--divider       List row separators
```

### Action / state colours (Tailwind tokens - mapped in app/globals.css)

| Token | Value | Use |
|-------|-------|-----|
| `color.watched` | #34C759 | Watched state, positive stat accents |
| `color.watchlist` | #0A84FF | To Watch state, add-to-watchlist actions |
| `color.accent` | #FF9F0A | Interactive elements, CTAs, active pills |
| `color.warning` | #FFD60A | Sync warning / incomplete metadata / caution |
| `color.unsynced` | #FF453A | Sync errors, remove actions, destructive states |

**State colours** (for pills, chips, and stat highlights)
```text
state.watched   -> color.watched
state.watchlist -> color.watchlist
state.edit      -> color.accent
state.warning   -> color.warning
state.error     -> color.unsynced
```

### Rules
- Watched state: `color.watched`. To Watch state: `color.watchlist`. Never reuse the same colour.
- Interactive elements (buttons with actions, links): `color.accent` only. Not the state colours.
- **Active / selected state** (nav pills, filter chips, segmented controls): `bg-accent/10 text-accent`.
  Never use `bg-foreground text-background` for selected state — full inversion creates harsh contrast
  that masks icons and looks wrong in dark mode.
- Sync warning and sync error must be visually distinct.
- Poster art already introduces enough colour noise; UI colours stay disciplined and semantic.

---

## 3. Spacing

### Scale
```text
4px   - tight internal gaps (icon-to-label, badge padding)
8px   - within a component (gap between lines in a row)
12px  - between related elements (gap between rows in a group)
16px  - section padding, standard card padding (px-4, py-4)
20px  - between components within a view
24px  - between major sections
32px  - between views / large structural breaks
```

### Rules
- **Horizontal page padding is always 16px (px-4).** No px-3 or px-5 in main content.
  Exception: modals/sheets use px-5 (20px) for the slightly more focused feel.
- **Card internal padding is always 16px (p-4).**
- **List rows use py-3 (12px) vertical padding** - gives 44px minimum tap target when combined
  with headline text.
- Section divider labels (e.g. "Recently Watched", "Languages", "Cast") get `px-4 py-2` - they
  are structural, not content.

### Page and section spacing contract

The shell owns horizontal page padding. `app/(shell)/layout.tsx` constrains shell content to
`max-w-md` and applies `px-4`, so first-level page content should not add extra horizontal padding.
Page routes should normally start with `PageHeader` from `components/ui/section.tsx` and then use
`space-y-4` or `space-y-6` on the main flow depending on density:

- `space-y-4` for dense poster-first pages where the grid begins immediately after the header.
- `space-y-6` for settings, search, and form-heavy pages where sections need more breathing room.
- Stats may use divider-led sections instead of a single main `space-y-*` stack because the chart
  blocks are intentionally separated by full-width divider lines.

`PageHeader` is the standard large-title row:

- title is display size (`32px`, `700`, `leading-[1.1]`)
- subtitle is subheadline (`13px`, text-2, `leading-[1.4]`)
- trailing page controls sit in the header action slot, not in the shell
- optional leading navigation, such as `BackButton`, sits above the title row with an 8px gap

`Section` owns only vertical rhythm (`space-y-2`). It does not add horizontal padding because the
shell already provides it. `SectionHeader` is the reusable section label primitive; use it instead
of repeating uppercase 11px label classes in page code.

Horizontal content may intentionally bleed only when it needs native swipe behaviour at the page
edge, such as cast carousels or sheet chip rows. Use:

- `SectionScrollBleed` for page content, which applies `-mx-4 overflow-x-auto px-4`
- `SheetScrollBleed` for bottom-sheet content, which applies `-mx-5 overflow-x-auto px-5`

Do not hand-code those bleed class strings at call sites. The negative margin cancels the owning
container padding while the matching inner padding keeps the first and last items aligned to the
normal content edge.

Because each bleed element's border-box is intentionally 32px wider than its container, the protected
shell wrapper (`app/(shell)/layout.tsx`) carries `overflow-x-clip`. This is load-bearing: it clips any
sub-pixel bleed leak so the page never gains a horizontal scrollbar. Use `overflow-x: clip` — not
`overflow-x: hidden` — here. `hidden` paired with a visible vertical axis computes the vertical axis to
`auto`, turning the wrapper into a scroll container and breaking the fixed bottom nav (this was the
regression behind the recurring "adding a tag introduces side-scrolling" bug). `clip` clips without
creating a scroll container, so the nav stays fixed and bleed rows keep their own internal scrolling.
Do not remove `overflow-x-clip` from the shell wrapper.

---

## 4. Shape

### Border radius
| Token | Size | Use |
|-------|------|-----|
| `rounded-full` | pill | Badges, nav pills, filter chips |
| `rounded-lg` | 8px | Small chips, tags, inline pills |
| `rounded-xl` | 12px | Buttons, inputs, toggles |
| `rounded-2xl` | 16px | Cards, poster cards, collapsed rows |
| `rounded-3xl` | 24px | Bottom sheets (top corners only) |

### Rules
- All cards: `rounded-2xl`
- All buttons: `rounded-xl`
- All inputs: `rounded-xl`
- Bottom sheets: `rounded-t-3xl`
- Never mix radii within the same component

---

## 5. Tap Targets

HIG minimum is 44x44pt. Every interactive element must meet this.

### How to achieve it without visual bloat
A button that looks small can still have a 44px tap target:
```tsx
// The text is small but the surrounding div catches taps
<div className="flex items-center justify-center" style={{ minHeight: 44, minWidth: 44 }}>
  <span className="text-subheadline">Edit</span>
</div>
```

### Minimum sizes by element type
- Button (primary): 50px height, full-width or min 120px wide
- Button (secondary/ghost): 44px height
- List row: 48px height minimum
- Bottom nav pill: 44px height minimum
- Sort/filter toolbar pill: 44px height minimum
- Icon button: 44x44px touch area (icon itself can be 24px)
- Filter chip: 36px height acceptable (small, but chips are supplementary UI)
- Poster card: whole card is tappable

---

## 6. Component Contracts

Recurring patterns that must be consistent across the app.

### NavigationShell

The shell layout is a thin wrapper: bottom nav + page padding only. It carries no app title,
no persistent header, and no global controls.

Rules:
- Each page owns its own full-width large-title header row (`display` size, font-bold, left-aligned).
- The shell never renders an app name or subtitle above the page's own title.
- Per-page controls (settings, filters, sort) live in the page's header row, not in the shell.
- Detail pages that sit inside the shell must provide an explicit back button — a `ChevronLeft`
  icon + "Back" label at `body` size, coloured `text-accent`, with a 44px touch target.

### BottomPillNav

```text
[RetroTvIcon  Library] [Bookmark  Wishlist] [BarChart2  Stats]   (+)   <- expanded: 3-tab pill + separate Add FAB
      [Library]              [Wishlist]         [Stats]          +    <- collapsed: icon-only pill + FAB tucked in
```

The nav is two elements, not one: a 3-tab pill (Library / Wishlist / Stats) and a separate circular
"Add" button next to it. The Add button is not a 4th pill item — it routes to `/search` (the TMDB
search-and-ingest flow for adding a new movie or show), so its icon is `Plus`, not `Search`, and it
uses `bg-accent text-black` like other primary CTAs rather than the pill's `bg-accent/10 text-accent`
tab treatment.

Icon assignments (lucide-react unless noted):
- Library → `RetroTvIcon` (custom, `components/icons/retro-tv.tsx`)
- Wishlist → `Bookmark`
- Stats → `BarChart2`
- Add (separate FAB, routes to `/search`) → `Plus`

Active state (pill tabs only): `bg-accent/10 text-accent` on the individual pill. Icon and label
share the same `text-accent` colour — no separate fill behind the icon. Never invert the whole pill.
The Add FAB has no distinct "active" treatment on `/search` — it is an action button, not a
destination indicator.

Keep the floating pill treatment as an intentional branded navigation pattern rather than replacing
it with a conventional full-width tab bar.

**Scroll collapse.** Past ~20px of scroll (listened on `window`, since the shell has no dedicated
scroll container), the pill and the Add FAB both collapse:
- Every pill tab (including the active one) drops its label and shrinks to icon-only; inactive tabs
  shrink to zero width and are hidden. The pill itself shrinks from a full-width `flex-1` bar to an
  intrinsic width that hugs its now-smaller content.
- The Add FAB shrinks slightly and the gap between it and the pill tightens, so the two read as one
  compact dock rather than a full-width bar with dead space.
- The first tap on any nav element while collapsed only re-expands the nav (the tap is intercepted
  in the capture phase and never reaches the underlying `Link`); a second tap navigates normally.
  This guards against fat-thumbing navigation — especially the Add action — while scrolling.
- Scrolling back near the top re-expands the nav automatically.

### PosterCard
```text
[2:3 poster]

Grid: responsive based on device width
Radius: rounded-2xl
Caption: none in watched-grid default
```

Rules:
- Movies and To Watch use the same poster grid system.
- Planned Library and Wishlist views use the same poster grid system for movies and shows.
- In `Movies`, the default watched view shows **posters only** for maximum scan density.
- Grid column count should adapt to available width rather than being hard-coded to 3.
- Target the current iPhone 16 / iPhone 17 class first, then let the layout scale down cleanly.
- Rating should appear in detail or alternate list contexts, not in the watched poster grid.
- Poster placeholders should preserve aspect ratio to avoid layout shift.

### Library Type Filter
```text
[All] [Movies] [Shows]
```

Use for:
- Library
- Wishlist
- Stats

Rules:
- Default selection is `All`.
- Use segmented control styling when the filter is central to the page; use compact filter-bar
  styling when combined with tag/year/rating filters.
- The type filter should propagate through stats drill-down links into Library.
- Do not create separate movie and show apps or separate nav structures.

### MovieDetailHero
```text
[edge-to-edge backdrop banner]
    [poster overlaps lower edge] [title / metadata / state / rating / tags]
```

Rules:
- Movie detail uses `backdrop_path` as an edge-to-edge cinematic banner that bleeds through the
  shell padding, matching the actor detail banner treatment.
- The poster remains the vertical identity anchor and overlaps the lower banner edge; do not replace
  it with backdrop-only title art.
- Back, settings, title, metadata, watched/watchlist state, rating, and tag summary all remain in
  the hero area. Primary actions stay immediately below the hero, followed by watch history, plot,
  cast, tags, and details.
- If a movie has no backdrop, render a quiet `bg-surface-muted` fallback with the standard film icon
  and keep the same poster/title layout so the page does not jump between states.

### ShowEpisodeList
```text
←  Daredevil: Born Again                         Show

Watched · 9/18 episodes
Action · Crime · English
[heart rating] [TMDB rating · votes] [tags...]

Season 1                                      9/9
Heaven's Half Hour
S01E01 · 48m
5 Mar 2025                                  [✓]
```

Rules:
- The show episode list is a dense list, closer to a watch-history checklist than a marketing
  detail page.
- The `Show` button opens the show overview/detail screen.
- Season headers are structural and may stick below the top bar.
- Row tap opens episode detail.
- The trailing check target toggles that episode's watched state without navigating.
- Show-level personal rating uses the same heart treatment as movie detail. Do not label it "Mine"
  when the heart treatment already implies personal rating.
- TMDB show rating and vote count appear on the show screen, matching movie detail's source-labeled
  rating pattern.
- Tags are shown and edited at the show level, not episode level.
- Avoid helper copy that explains obvious behavior such as skipped episodes or manual completion.
  The user is assumed to understand their tracking choices.

### ShowDetail
```text
[edge-to-edge backdrop banner]
    [poster overlaps lower edge] [title / metadata / watched state / rating / tags]

[primary show-state action] [Episodes]

Plot
Cast
Tags
Details
```

Rules:
- Show detail follows MovieDetailHero as closely as possible: backdrop banner, overlapping poster,
  title metadata, watched/wishlist state, heart personal rating, TMDB rating/vote count, and visible
  show tags in the hero area.
- Primary actions sit immediately below the hero.
- The `Episodes` action opens the dense season/episode list.
- Plot, cast, tags, and details follow the same section order and density as movie detail where the
  data exists.
- Details should include first aired, studio, network, seasons, episodes, language, and TMDB rating
  when available.
- Show detail owns show-level controls: tags, personal rating, wishlist/watching/watched state, and
  manual completion.

### EpisodeDetail
```text
←                                               Show

[episode poster]
Daredevil: Born Again
Heaven's Half Hour
S01E01

[Mark unwatched] [Add watch date]

Plot
...

Details
Airdate       5 Mar 2025
Studio        Marvel Television
Duration      48m
Rating        ♥ 8.5
TMDB          7.7 · 4.2k votes

Show tags
Marvel · With friends · Crime
```

Rules:
- Episode detail is not a stats page.
- Show poster/episode still should be visually present.
- Show tags and show ratings may be displayed, but editing them routes to show-level controls.
- Do not add episode-level tags or episode-level personal ratings unless product direction changes.
- Keep copy direct; no instructional notes about where data lives.

### TagFilterRow
```text
[All] [Thriller] [Korean] [Rewatch] [...]

Height: 36-40px
Scroll: horizontal when needed
```

Active chip: `bg-accent/15 font-semibold text-accent` (consistent with active state rule in §2).
Inactive chip: `border border-border bg-surface text-text-2`.

Use for:
- browsing watched movies by tag
- browsing watched movies by language when filter mode is active

### MovieLibraryToolbar
```text
[type icon  All  chevron] [filter icon  Filter  dot  chevron] [sort icon  Sort  chevron] [x] [select icon]

Pill height: 44px
Pill radius: rounded-full
Pill padding: px-3.5
Icon size: 14px inside pills
Reset filter button: 44x44px icon button
```

Active toolbar pill: `border-accent/40 font-semibold text-accent`.
Inactive toolbar pill: `border-border text-text-2`.

Rules:
- Type, Filter, and Sort controls use lucide icons plus text labels; do not use standalone text-only
  pills here.
- Select uses a plain 44x44 icon button so it does not compete visually with the filter controls.
- Toolbar pills stay unfilled so the row stays quiet when several controls are visible together.
- The reset filter affordance is a separate 44x44 icon button, not a narrow text glyph.
- Active filters may show a small accent dot inside the Filter pill; the tap target still comes from the pill.

### ListRow
```text
[Poster/Icon zone 40-56px] [Content flex-1]     [Trailing]
                            headline (title)     body/headline (value or state)
                            footnote (metadata)  subheadline (secondary value)

Height: min 48px (py-3)
Padding: px-4
Divider: border-b using --divider
```

Use for:
- search results
- tag lists
- cast rows
- stat breakdown rows

Search results specifically: title (headline) + one footnote metadata line only. No overview
snippet — plot belongs on the detail page, not in search. Consistent row height is more important
than extra context.

### CastMemberCard

Use `CastMemberCard` from `components/media/cast-member-card.tsx` for cast carousels in both movie
and show detail. Renders a circular avatar (with Film icon fallback), a name line, and an optional
character line. Wraps in a `<Link>` to the person page when `personHref` is provided; otherwise
renders a non-linked `<article>`.

```text
[headshot] [headshot] [headshot] [headshot]
[name]
[character]
```

Rules:
- Use circular portraits (`rounded-full`, `aspect-square`).
- Horizontal swipe via `SectionScrollBleed` is the default pattern.
- Name is `text-[12px] font-semibold`; character is `text-[11px] text-text-muted`.
- The caller builds the person link URL (including any query params for context); the component
  receives a `personHref` string.
- This should feel visual, not tabular.

### DetailHeroSection

Use `DetailHeroSection` from `components/media/detail-hero-section.tsx` for the full-width backdrop
banner at the top of movie and show detail pages.

Rules:
- Accepts `backdropPath?: string | null`. Renders the full-width TMDB backdrop image or a
  `bg-surface-muted` fallback with a Film icon.
- Applies the `movie-detail-hero-scrim` and `movie-detail-title-vignette` overlays.
- Renders the `BackButton` and `SettingsSheet` nav row with safe-area inset.
- Callers should not re-implement the backdrop, overlays, or nav row inline.

### MediaInfoPanel

Use `MediaInfoPanel` from `components/media/media-info-panel.tsx` for the poster + title + meta +
status + rating + tags panel shared across movie and show detail.

Rules:
- Accepts flat camelCase props. Movie detail passes `statusOverride` (e.g. `watchedSummary`).
  Show detail passes `ratingPicker` and `tagEditor`.
- Exports `TmdbRatingBadge` and `PersonalRating` for use in detail screens; import from this
  module, not from individual detail views.
- `ShowInfoPanel` is a re-export alias of `MediaInfoPanel` for backward compatibility.

### MetricCard (a number with a label)
```text
[display or title-1 number, tabnum]
[subheadline label, text-muted, mt-1]

Alignment: context-dependent (center in summary strips, left in detail cards)
```

Use for:
- total movies watched
- total hours/minutes watched
- top-level stat callouts

### SectionDivider
```text
[subheadline text, text-faint]
Padding: px-4 py-2
Background: none (sits on page bg)
```

### Card
```text
Background: --bg-secondary
Radius: rounded-2xl
Padding: p-4
Border: 1px --border (optional, use for interactive/elevated cards)
```

### DetailRow (label left, value right - used in Movie Detail and similar drill-down screens)
```text
[body label, text-2]          [headline value, text-primary, tabnum]
Height: min 44px (py-2.5)
Padding: px-4
Divider: border-b --divider between rows within a group
Group header: footnote uppercase, text-faint, px-4 py-2 (SectionDivider)
Background: none (rows sit on page bg; groups separated by a sep line)
```

Rules for DetailRow:
- Label is always body (15px), colour text-2. Never bold.
- Value is always headline (17px), colour text-primary, tabnum. Semibold.
- Colour exceptions: watched values -> text-watched, watchlist values -> text-watchlist,
  warning -> text-warning, error -> text-unsynced. The label colour never changes.
- Stack variant (two values right-aligned): primary value headline, secondary value
  footnote text-muted below it.
- Groups are separated by a full-width sep line (--divider), not by background colour.
- Group header (SectionDivider) labels the group above its first row.

Use `DetailRow`, `DetailBlock`, and `DetailTextList` from `components/ui/detail.tsx` instead of
repeating row, stacked-field, or flat divided-text styles in detail screens.

### CreditPosterCard
```text
[2:3 poster]
[headline-ish title, 12px semibold]
[footnote metadata]
```

Use `CreditPosterCard` from `components/media/credit-poster-card.tsx` for Known For-style
horizontal credit rails. Movie credits can link to TMDB movie detail routes; TV credits may render
as non-linked cards until TV detail routes exist.

### ValueLabel (inline pair - e.g. chart legends, rating helper labels)
```text
[subheadline value, colour-coded]
[footnote label, text-faint]
Alignment: context-dependent
```

### BottomSheet
```text
Background: --bg-secondary
Radius: rounded-t-3xl
Padding: px-5 pt-5 pb-[safe-bottom + 24px]
Handle: 4x36px rounded-full --bg-tertiary, centered, mt-2 mb-4
```

Use for:
- sort options
- filter options
- add/edit tags
- change watch status

### Settings primitives

Settings screens use `SettingsPanel`, `SettingsLinkRow`, `SettingsTextInput`,
`SettingsActionButton`, `SettingsFieldLabel`, and `SettingsStatusBadge` from
`components/ui/settings.tsx`. These primitives encode the shared settings card, form input, button,
label, and connection-state badge styles. Provider settings pages should use those helpers rather
than duplicating input/button class strings.

---

## 7. Motion

- Sheet slide-up: 320ms, `cubic-bezier(0.32, 0.72, 0, 1)` - already in globals.css
- Tap feedback: `--tap-active` background on active - already in globals.css
- Poster fade-in: 180ms opacity transition
- No other decorative animation. Browsing and stats should feel stable, not theatrical.

---

## 8. What This Guide Does Not Cover

- **Icons**: Use SF Symbols naming conventions mentally; implement with SVG or lucide-react.
  Size: 20px in list rows, 20-22px in bottom navigation, 28px in empty states.
  Nav icon assignments are specified in §6 BottomPillNav.
- **Charts/visualisations**: Bar and line charts follow colour tokens but sizing is contextual.
  Time-axis labels must be human-readable (e.g. `-5w … Now`), not ordinal positions.
- **Loading states**: Skeleton screens preferred over spinners for content areas.

---

## 9. IA -> Visual Mapping

This section connects product IA to the style decisions above.
The IA defines *what* appears and in *what priority*. This section defines *how*
that priority is expressed visually.

### The core rule
**Priority in IA maps directly to size and colour in the style guide.**
If the IA says something is primary, it gets headline or larger + text-primary.
If it's secondary, it gets body + text-2. If it's metadata, it gets footnote + text-faint.
Never let visual weight conflict with IA priority - a footnote-sized element
should never be more important than a headline-sized one on the same screen.

### Screen-type -> component mapping

| Screen type | Primary info pattern | Secondary info pattern | Layout component |
|-------------|---------------------|------------------------|-----------------|
| Overview grid (Movies, To Watch) | poster image | metadata via sheets and tag/language filters | PosterCard |
| Detail drill-down (Movie Detail) | poster + compact metadata cluster | plot + cast carousel + label:value groups | DetailRow |
| Profile drill-down (Person Detail) | backdrop + circular portrait + name | biography + credit carousel | DetailBlock / CreditPosterCard |
| Summary strip (Stats totals) | display/title-1 number | subheadline label below | MetricCard |
| Edit/input (tag/status sheet) | body labels + headline inputs | footnote hints | BottomSheet |
| Search results | headline title + poster | footnote metadata + status pill | ListRow |

### How IA priority maps to type roles

| IA priority | Type role | Colour |
|-------------|-----------|--------|
| Hero / most important number | `display` or `title-1` | text-primary or semantic |
| Primary field in a detail group | `headline` | text-primary (or watched/watchlist state) |
| Label for a primary field | `body` | text-2 |
| Supporting context | `subheadline` | text-2 or text-muted |
| Metadata (year, language, sync info) | `footnote` | text-faint |
| Group header | `footnote` uppercase | text-faint |

### The two layout patterns and when to use them

**PosterCard** - use for Movies and To Watch where the user is scanning a library visually.
The poster is the primary identifier. In the watched grid, do not place ratings beneath posters.

**DetailRow** - use for all detail screens with 4+ fields. Every field gets
the same visual weight; hierarchy comes only from grouping (section headers)
and colour (watched/watchlist/sync values). This is the pattern for Movie Detail.

**CastCarousel** - use in Movie Detail to make the page feel more visual and less like a settings
screen. Cast should not be reduced to plain text rows when images are available.

SpendStack uses DetailRow exclusively in its detail views and reserves MetricCard
for its dashboard summary only. This is why it feels clear and easy
to read despite showing a lot of information: there is no visual competition
between a big card and surrounding rows - everything is at the same structural
weight, and the eye scans top to bottom.

### State and colour as a second hierarchy axis

Beyond size, colour communicates priority in a second dimension:
- A `watched` coloured value in a DetailRow draws the eye even though it is
  the same size as other values. Use this intentionally - only for values the
  user needs to act on (watch status, sync status, rating emphasis in stats).
- `text-muted` or `text-faint` values recede. Use for reference numbers the
  user doesn't act on directly (tag count, year, release language, sync timestamp).

### What validates DetailRow for Nodi

Movie detail screens should use:
- all-caps small section headers above groups of rows
- poster with a **compressed hero block** alongside it
- metadata should not appear as a long vertical chip list
- use this order in the hero:
  - **poster grid row**: poster left; right column shows — meta line (`year · language · genre`), watch status, rating row (user rating + TMDB rating inline as `· ★ 7.5`), up to 3 tag chips
  - **full-width title below the poster grid** — title gets the full page width so long titles never compress the right column
  - this keeps metadata scannable when the poster is the visual anchor, and titles readable at any length
- user rating should be visually personal, e.g. heart icon + value
- third-party ratings such as TMDB or IMDb should appear as secondary reference metadata below the
  personal-state row if available
- chips in the hero are for user-state emphasis only, not for every metadata value
- avoid isolated floating pills on the right side of the poster
- plot below the hero block, clamped first and expandable when long
- cast shown as an image carousel
- label left (body weight, secondary colour) + value right (semibold, primary colour)
- watched/watchlist/sync values colour-coded semantically
- no oversized metric cards inside detail views - cards only on the overview/stats surface

The result: a screen with 8-10 fields reads clearly because the structure is
uniform and hierarchy comes from grouping + colour, not from competing visual
sizes.

---

## 10. Token Reference

Raw values for all design tokens. Already defined in `app/globals.css` - this section is a quick
lookup, not the source of truth.

### Font stack

```css
font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
```

System font - SF Pro on iOS/macOS, Segoe UI on Windows, Roboto on Android. No web font loaded.

### CSS variables

```css
:root {
  --bg-primary:   #FFFFFF;
  --bg-secondary: #F2F2F7;
  --bg-tertiary:  #E5E5EA;
  --bg-nav:       rgba(255,255,255,0.90);
  --text-primary: #000000;
  --text-2:       rgba(0,0,0,0.60);
  --text-muted:   rgba(0,0,0,0.40);
  --text-faint:   rgba(0,0,0,0.25);
  --border:       rgba(0,0,0,0.10);
  --border-faint: rgba(0,0,0,0.06);
  --tap-active:   rgba(0,0,0,0.04);
  --divider:      rgba(0,0,0,0.08);
  --chart-blue:   #0A84FF;
  --chart-green:  #34C759;
  --chart-orange: #FF9F0A;
  --chart-pink:   #FF375F;
  --chart-purple: #BF5AF2;
  --chart-cyan:   #64D2FF;
  --chart-label-primary:   rgba(255,255,255,0.88);
  --chart-label-secondary: rgba(255,255,255,0.60);
  --nav-h:        72px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary:   #000000;
    --bg-secondary: #1C1C1E;
    --bg-tertiary:  #2C2C2E;
    --bg-nav:       rgba(0,0,0,0.90);
    --text-primary: #FFFFFF;
    --text-2:       rgba(255,255,255,0.60);
    --text-muted:   rgba(255,255,255,0.40);
    --text-faint:   rgba(255,255,255,0.25);
    --border:       rgba(255,255,255,0.10);
    --border-faint: rgba(255,255,255,0.05);
    --tap-active:   rgba(255,255,255,0.06);
    --divider:      rgba(255,255,255,0.08);
  }
}
```

### Accent fills (tinted backgrounds)

```css
rgba(52,  199,  89, 0.12)  /* watched / green */
rgba(10,  132, 255, 0.15)  /* watchlist / blue */
rgba(255, 159,  10, 0.15)  /* accent / orange */
rgba(255, 214,  10, 0.15)  /* warning / yellow */
rgba(255,  69,  58, 0.10)  /* unsynced / red */
```
