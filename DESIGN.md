---
name: PrecioAR
description: Live hardware price comparison across six Argentine stores, answered as a fluo price card.
colors:
  fluo: "#ff3d8b"
  fluo-deep: "#e0206f"
  lime: "#c8f031"
  ink: "#16171a"
  ink-2: "#50535b"
  ink-3: "#6f727a"
  paper: "#eef0ea"
  sheet: "#ffffff"
  rule: "#d6d9d0"
  rule-strong: "#b9bdb2"
  alert: "#c4211f"
  store-mercadolibre: "#FFE600"
  store-compragamer: "#FF6A00"
  store-fullh4rd: "#E10600"
  store-venex: "#0057B8"
  store-mexx: "#00A3E0"
  store-gezatek: "#8B5CF6"
typography:
  display:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(3.75rem, 13vw, 6rem)"
    fontWeight: 900
    lineHeight: 0.9
    letterSpacing: "-0.01em"
    fontFeature: "tnum, lnum"
    fontVariation: "'wdth' 62"
  display-hero:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(3.25rem, 9vw, 6rem)"
    fontWeight: 900
    lineHeight: 0.97
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 62"
  display-section:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(2.75rem, 7vw, 4.5rem)"
    fontWeight: 900
    lineHeight: 0.95
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 62"
  price:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.01em"
    fontFeature: "tnum, lnum"
    fontVariation: "'wdth' 62"
  headline:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.333
    letterSpacing: "-0.025em"
    fontVariation: "'wdth' 100"
  title:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.25
    fontVariation: "'wdth' 100"
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.375
    fontVariation: "'wdth' 100"
  lead:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.625
    fontVariation: "'wdth' 100"
  label:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.43
    fontVariation: "'wdth' 100"
  micro:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
    fontFeature: "tnum"
    fontVariation: "'wdth' 100"
rounded:
  xs: "2px"
  sm: "3px"
  md: "4px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
components:
  cartel:
    backgroundColor: "{colors.fluo}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "32px"
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    padding: "12px 20px"
  button-secondary:
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
  button-secondary-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
  button-on-ink:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
  search-field:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "10px 10px"
  search-submit:
    backgroundColor: "{colors.fluo}"
    textColor: "{colors.ink}"
    padding: "0 16px"
  chip-suggestion:
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: "6px 12px"
  chip-suggestion-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.fluo}"
  store-toggle-on:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  store-toggle-off:
    textColor: "{colors.ink-3}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  segmented-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.xs}"
    padding: "6px 12px"
  panel:
    backgroundColor: "{colors.sheet}"
    rounded: "{rounded.md}"
    padding: "14px 20px"
  tag-winner:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xs}"
    padding: "2px 6px"
  store-dot:
    rounded: "{rounded.full}"
    size: "10px"
  top-bar:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    padding: "12px 24px"
  step-current:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    padding: "10px 12px 12px"
  scene-well:
    backgroundColor: "{colors.sheet}"
    rounded: "{rounded.md}"
  total-bar:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    padding: "12px 16px"
---

# Design System: PrecioAR

## Overview

**Creative North Star: "The Fluo Price Card"**

The system is the Argentine shop-window price card (cartel flúo) laid on a cool sheet of card stock. One hot pink card carries the answer: a monumental, narrow, black price in Archivo at 62% width and weight 900. When a cheaper store answers, a marker stroke strikes the old price and the new one is written in left to right. Everything around the card is quiet ink on paper: hairline rules, flat white sheets, tabular numbers, small round store dots.

The world extends to a PC builder (`/armar`) without changing its materials: the total of the build is the same pink cartel, corrected live with the same marker strike, and the parts being assembled sit in 3D as a real machine (steel, tempered glass, circuit boards, fans in physically based materials) with the cartel world drawn on top as its annotation layer: the part currently being chosen outlined in pink, missing parts as dashed ink ghosts, an ink marker box and an ink price tooltip on hover. Around the card live a few physical cartel objects: a strip of paper tape holding it to the wall, a price tag hanging from a thread, the marker that crosses the example while it strikes.

Density is that of a working comparison tool, not a landing page. The verdict is loud and singular; the evidence (per-store minimums, the price strip, the result list) is calm, ruled, and scannable. Color is spent on meaning, never on decoration: pink is the card, lime is "cheapest", the store colors are identity dots, red is failure.

The world is light-only (`color-scheme: light`) and rejects dark neon "gamer" surfaces, glow, and grids of equal product cards.

**Key Characteristics:**
- One rotated fluo pink card per screen, lifted off the paper by the system's only shadow.
- Two widths of one family: condensed black for prices, normal width for everything else.
- Hairline-ruled lists and flat white sheets instead of cards and shadows.
- Lime marks the winner; store colors appear only as round dots.
- Motion is handwriting and paper: strike-through and write-in, the card slapped onto the wall, parts sliding into the case, all on the ease-out-expo curve.
- 3D is a hybrid: realistic materials inside the case, the cartel's pink and ink drawn on top as outlines, ghosts, and a price tooltip.

## Colors

Cool card stock and ink with two fluorescent signal colors, each bound to one meaning.

### Primary
- **Cartel Pink** (fluo): the price card's paper. Fills the verdict card, the build total card on `/armar`, the blank home search card, the logo tile, the top-bar "Comparar" submit, the 3px search focus ring, text selection, and, in the 3D scene, the outline of the one part currently being chosen (solid, or dashed while that part is still missing). Pink never colors a 3D material.
- **Deep Cartel Pink** (fluo-deep): the text caret across the app.

### Secondary
- **Winner Lime** (lime): the "cheapest" mark only. The 3px ring around the winning point on the price strip, the "Más barato" tag in result rows and on the cheapest compatible offer in a builder step, the cheapest complete one-store total, and the savings notes (under the per-store table; "te sobran" when a budget build comes in under budget).

### Tertiary
- **Store identity colors** (store-mercadolibre, store-compragamer, store-fullh4rd, store-venex, store-mexx, store-gezatek): a brand commitment from PRODUCT.md, fixed in `src/lib/stores/meta.ts`. Rendered only as round dots next to store names and as offer points on the price strip.

### Neutral
- **Ink** (ink): primary text, the top bar, primary buttons, active segmented options, the current builder step, the chosen offer's "Elegida" button, the compatibility line (ink text with a check), the mobile total bar, 3D hover outlines, missing-part ghosts and the 3D tooltip, the marker stroke, and the strong rule under the results header.
- **Graphite** (ink-2): secondary text, meta lines, price differences, the hero lead.
- **Pencil** (ink-3): tertiary text, column labels, placeholders, disabled and "waiting" states. Small text in Pencil belongs on Sheet; on Paper it is legible only at large sizes.
- **Card Stock** (paper): the page ground.
- **Sheet** (sheet): white surfaces that hold data: the per-store panel, store toggles, the search field, image wells, row hover.
- **Hairline** (rule): 1px dividers between rows and panel sections, the price-strip axis, skeletons.
- **Pencil Line** (rule-strong): borders of interactive controls (toggles, segmented groups), the scrollbar thumb.
- **Alert Red** (alert): failure only. Store failures, "Sin stock", incompatible offers and compatibility errors (with the triangle alert icon); incompatible offer rows also drop to 60% opacity.

### Named Rules
**The Cartel Rule.** Pink is the card's material. It appears on the cartel (verdict or build total), on the blank card that asks for the query, on the controls that produce a cartel (logo, top-bar search submit, search focus ring), on text selection, and on the outline of the one 3D part being chosen. Never a section background, never a text color, never on a list row, never a status. A search that does not produce a cartel (a builder step) submits in ink.

**The Lime Means Cheapest Rule.** Lime marks the lowest price or the money saved, and nothing else. "Compatible" is not lime: it is ink text with a check.

**The Neutral Stores Rule.** Store colors never fill a surface, tint text, or color a border. Every store gets the same 10px dot (with a 1px ink/15 ring so yellow survives on white), so no store is favored beyond its price.

## Typography

**Display Font:** Archivo variable at `wdth 62`, weight 900 (with system-ui, sans-serif)
**Body Font:** Archivo variable at `wdth 100` (with system-ui, sans-serif)

**Character:** One family, two widths. The narrow black cut is the hand-lettered price card; the normal width is a plain, sturdy UI voice. Loaded through `next/font` with the `wdth` axis.

### Hierarchy
- **Display** (900, wdth 62, clamp(3.75rem, 13vw, 6rem), 0.9): the verdict price on the cartel, with the `$` set at 0.42em and the `.-` card suffix.
- **Display Hero** (900, wdth 62, clamp(3.25rem, 9vw, 6rem), 0.97, uppercase, balanced): the home question only.
- **Display Section** (900, wdth 62, clamp(2.75rem, 7vw, 4.5rem), 0.95, uppercase): the opening heading of a secondary page or band ("Armá tu PC"; the home "¿Armando una PC?" band runs it a step smaller, clamp(2.5rem, 6vw, 4.25rem)). The build total price uses Display at clamp(3.25rem, 10vw, 5rem) to fit the narrower column.
- **Price** (900, wdth 62, 1.65rem on mobile to 1.875rem, 1): prices in result rows; also struck prices at 1.25rem and the home query input at clamp(2rem, 6vw, 3.25rem), uppercase.
- **Headline** (700, 1.5rem, -0.025em): the results count heading and the empty-result line; builder step headings ("Elegí un procesador", "Tu armado") run it at 1.875rem.
- **Title** (700, 1.125rem): cartel lead-in, store group headings, panel heading (at 1rem).
- **Body** (500, 1rem, 1.375): product titles, two-line clamp.
- **Lead** (400, 1.125rem, 1.625, max 32rem): the single explanatory paragraph on home.
- **Label** (500 to 600, 0.875rem): toggles, segmented options, chips, footer, status lines.
- **Micro** (500, 0.75rem, tabular): axis ends, column heads, price differences, tags.

### Named Rules
**The Two Widths Rule.** Every price, the hero, page and band display headings, step numbers, and the budget input run in the narrow black cut with tabular lining numerals; nothing else does. Body and UI stay at normal width. No second family.

**The Tabular Rule.** Any number that is compared (prices, counts, response times, differences) is tabular.

## Layout

A single centered column with a 1280px max width for results (1152px on home), gutters of 16px on mobile and 24px from 640px. Spacing follows a 4px base; the common steps are 8, 16, 24, 32, and 48px.

The results page stacks: top bar, store rail, then a two-column verdict band (5fr cartel and arrivals, 7fr per-store panel) from 1024px, single column below. A 48px gap and a full-ink rule separate the verdict band from the results list. The list is a ruled table of rows: a 56px image well (72px from 640px), the title and meta, and a right-aligned price column.

Home is a two-column grid from 1024px: the hero question and store list on the left, the rotated blank card on the right spanning both rows. Below 1024px it stacks question, card, store list.

`/armar` stacks the display heading with the mode switch, an optional budget form on Sheet, the step rail, then a 7fr / 5fr grid from 1024px: the current step (search, offers, prev/next) on the left, and a sticky aside on the right (top 96px) holding the 3D well with the total cartel tucked over its lower edge (-48px top margin, 24px inset). Below 1024px the aside follows the step, and an ink total bar fixed to the bottom carries the total while the cartel is off screen; it slides away whenever the cartel is visible.

The step rail is a single row of content-sized steps over a 3px Hairline track whose ink fill grows with the parts chosen; on narrow screens it scrolls horizontally edge to edge.

Home closes with a full-width Sheet band (hairline on top) pairing the "¿Armando una PC?" pitch with a self-assembling 3D showcase, two columns from 1024px.

On mobile, the store rail scrolls horizontally edge to edge instead of wrapping, and the price-strip track drops to its own line under each store name.

## Elevation & Depth

Flat by default. Depth comes from tone (white Sheet on Card Stock), 1px hairlines, and a sticky ink top bar. The only lift in the system sits under the rotated pink card, reading as a physical card resting on the paper. It is soft, never a glow and never a hard offset. The paper tape on the card carries a 1px contact shadow so it reads as stuck on; that is part of the card, not a second elevation. In the 3D scene the rendered PC casts its own soft shadow onto the paper (an invisible shadow catcher at 12% opacity); that is light in the scene, not elevation on the interface.

### Shadow Vocabulary
- **Card Lift** (`box-shadow: 0 24px 40px -24px rgba(22,23,26,0.6), 0 2px 4px rgba(22,23,26,0.08)`): the cartel (verdict and build total) and the blank home card only.
- **Tape Contact** (`box-shadow: 0 1px 2px rgba(22,23,26,0.12)`): the paper tape strip on a cartel only.

### Named Rules
**The Only Lifted Thing Rule.** If it is not the pink card (or the tape holding it), it is flat. Panels, rows, toggles, buttons, the 3D well, and the mobile total bar carry no shadow.

**The Hybrid Build Rule.** Inside the case the PC is rendered; on top of it, the cartel annotates. Parts use physically based materials at real scale (1 unit = 10 cm): near-black case steel, darker and lighter steel, brushed aluminum, dark and deep-green circuit boards, matte black and grey plastics, gold contacts, a perforated mesh front, printed labels, and a tempered-glass side (clear, 7% opacity, full clearcoat). Light is a studio: ACES filmic tone mapping at exposure 1.2, a neutral room environment at 0.95, a white key light with soft shadows, a cool rim from behind, and a hemisphere fill grounded in Hairline. The cartel layer is flat lines over the render: the active part's box in solid fluo pink (dashed pink while it is missing), missing parts as dashed ink ghosts at 32%, an ink box on hover (never for the case), and an ink "Name · $price" tooltip. Light inside the machine is white only and appears only when all seven parts are in. No pink, lime, or store colors on materials, no colored RGB lighting, no bloom, no dark stage; the canvas stays transparent over Sheet (the well, or the home band).

## Shapes

Tight, printed corners: 2px for tags, inner segmented options, and toggle checkboxes; 3px for buttons, inputs, toggles, image wells, and the savings note; 4px for the cartel and the per-store panel. Full rounding is reserved for store dots, offer points, suggestion chips, and the store pill inside the cartel.

The pink card is set slightly askew (-1.2deg on results and the build total, -1.5deg on home); the logo tile sits at -6deg. The only other things that tilt are the cartel's own physical objects: the tape strip (2 to 4deg either way), the hanging price tag (swinging -5 to 6deg), and the marker (-14deg). Panels, rows, and controls never rotate.

The current builder step is a 3px-topped ink tab (top corners only) sitting on the progress track.

Borders are 1px hairlines for structure, 1.5px ink for chips, checkboxes, secondary buttons and the builder search field, 3px ink for the home query and budget underlines. Dashed borders mean "absent": disabled store toggles, the optional-GPU note, and the 3D ghosts. Disabled store toggles switch to a dashed border.

## Components

### Buttons
Solid, compact, ink on pink or paper.
- **Shape:** printed corners (3px).
- **Primary:** Ink fill, Card Stock text, bold, 12px 20px (14px 24px on the home card), trailing 16px arrow.
- **Hover / Focus:** lifts 1px over 200ms on ease-out-expo; global focus is a 2px ink outline at 2px offset (paper outline on the ink top bar).
- **Search submit:** pink fill, ink bold label, flush inside the top-bar search field; disabled falls to Hairline fill with Pencil text. In a builder step the submit is ink with Card Stock text.
- **Secondary:** 1.5px ink outline, ink bold label, 3px corners; hover fills ink. "Elegir" on an offer, "Siguiente" before a part is chosen, "No necesito placa".
- **Selected:** the secondary button filled ink with a leading check ("Elegida", "Sin placa de video"). Only one per step.
- **On ink:** Card Stock fill with ink label, used only on the mobile total bar.
- **Text action:** semibold 14px underlined ink ("Empezar de nuevo", "Cambiar", "Ver las N ofertas").

### Chips
- **Suggestion chip:** fully round, 1.5px ink border, transparent on the pink card, semibold 14px. Hover inverts to ink fill with pink text.
- **Winner tag:** Lime fill, ink bold 12px, 2px corners, "Más barato".
- **Store badge:** Card Stock fill, Graphite 12px, 2px corners.
- **Use chip (budget form):** the suggestion chip on Sheet; the checked radio fills ink with Card Stock text.
- **Compatibility line:** not a chip. Ink semibold 12px with an 11px check ("Compatible" or the reason); incompatible is alert bold 12px with the triangle icon; neutral reasons in Graphite.

### Cards / Containers
- **Cartel:** see Signature Component.
- **Per-store panel:** Sheet background, 1px Hairline border, 4px corners, header row 14px 20px with a hairline under it, no shadow.
- **Image well:** square, Sheet, 1px Hairline, 3px corners, 6px padding, image contained (store photos are often on white).
- **3D well:** Sheet, 1px Hairline, 4px corners, transparent canvas. A 12px Graphite hint on a Sheet chip at 90% with 2px corners sits bottom-left (top-left from 1024px): "Arrastrá para girar · clic en una pieza para elegirla" on fine pointers, "Tocá una pieza para elegirla" on touch. On home the showcase has no well: the canvas sits straight on the Sheet band.
- **Budget form:** Sheet panel (4px, 1px Hairline, 20 to 24px padding) with a narrow black `$` input on a 3px ink underline, use chips, and the ink "Armame la PC" button.

### Inputs / Fields
- **Top-bar search:** Sheet field inside the ink bar, 3px corners, leading 16px search icon in Pencil, focus shows a 3px pink ring around the whole field.
- **Home query:** borderless on the pink card, narrow black uppercase type, 3px ink underline that thickens by a 4px ink rule on focus; caret is ink.

### Navigation
- **Top bar:** sticky, Ink background, Card Stock text, 12px vertical padding. Logo (pink -6deg tile with a narrow `$`) and wordmark left, search center on results, the Sync Solutions credit right at 70% paper, full on hover with underline. The credit is a brand commitment.
- **Store rail:** a row of toggle buttons, each Sheet with a Pencil Line border (ink on hover), an ink checkbox square, the store dot, the name, and a live status (spinner, tabular count, or red "error"). Off state is dashed and Pencil.
- **Segmented control:** Sheet group with Pencil Line border and 2px inner padding; active option is Ink with Card Stock text. Also the builder mode switch ("Lo armo yo" / "Por presupuesto").
- **Section nav (top bar):** "Comparar precios" / "Armar PC" as semibold 14px links at 65% paper; the current section is full paper with a 3px paper underline bar.
- **Step rail:** content-sized steps, each a narrow black step number, bold name, and a 12px tabular sub-line (price or "Sin elegir"). The current step is an ink tab with Card Stock text; done steps carry a 16px round ink badge with a paper check (inverted to paper with ink check on the current step); a step with a compatibility error shows the alert icon instead. Hover fills Sheet.
- **Mobile total bar:** fixed to the bottom below 1024px, ink with a 15% paper top hairline, the parts count in 12px semibold, the total in narrow black 1.875rem with `.-`, and an on-ink "Ver resumen" button. Slides in and out over 300ms.
- **Footer:** a hairline on top, Graphite 14px, the Sync Solutions credit in semibold underlined ink.

### Result Row
A ruled list item that is entirely a link: image well, two-line title (underlines on hover), meta line with store dot and name, badge, discount, stock. The right column stacks the struck list price, the narrow black price, and either the lime winner tag or `+$` difference. Row hover fills with Sheet.

### Offer Row (builder step)
A ruled row on Card Stock, compatible offers first: 56px image well, two-line title link, a meta line with store dot and name, the compatibility line, and the lime "Más barato" tag on the first compatible offer only; then the narrow black price (1.5rem) and the secondary "Elegir" / selected "Elegida" button. Incompatible rows stay visible at 60% with the alert reason.

### Signature Component: The Cartel
The fluo pink card, 4px corners, 24px padding (32px from 640px), rotated -1.2deg, with Card Lift and a strip of paper tape across its top edge. It enters with `slap` and morphs between routes as one object (shared view-transition name `cartel`). Contents in order: "Más barato en" with the winning store in a white pill, the struck history of beaten prices (marker stroke over each), the Display price written in with `write-in` (520ms), the product title link, and the ink "Ver en {tienda}" button with the "Respondieron N de 6" status. While waiting it shows a pulsing `$ ———.-` at ink/30.

**Build total variant (`/armar`):** same card, 24 to 28px padding, tucked over the bottom of the 3D well on desktop. "Total del armado", the previous total struck above, the new total written in, the parts count, a "Todo en {tienda}: $X (+$diff)" line when one store carries the whole build, warnings in a Sheet box (alert for errors, Graphite for notices), then the ink "Copiar link" button and the "Empezar de nuevo" text action.

### Signature Component: The Paper Tape
A 96 by 28px strip of translucent white (58%) with a hand-torn polygon clip and Tape Contact, centered or offset across the cartel's top edge and tilted a few degrees. It exists only on a cartel.

### Signature Component: The 3D Build
A mid-tower built procedurally at real scale (see The Hybrid Build Rule): tempered-glass side, mesh front with three intake fans and a rear exhaust; an ATX board with finned VRM heatsinks, I/O cover, DIMM slots, armored PCIe, M.2, chipset and capacitors; the CPU's heat spreader on its socket; two RAM sticks with heatspreaders and light bars; a vertically mounted GPU with an angular three-fan shroud, fin stack, backplate and light bar; an M.2 SSD with its printed label; a modular PSU with its fan grille. Fans have curved blades, heatsinks are instanced fin stacks.

A 30deg camera looks in through the glass. Orbit is damped, with no zoom (the wheel keeps scrolling the page) and no pan, held to the glass side; on touch, rotation is off so the finger scrolls and a tap picks a part. Each chosen part enters from its real direction over 0.75s and seats with a slight overshoot, staggered 0.18s when several land at once; the case scales in from 97% on quartic ease-out. The camera dollies to the current step's part over 0.9s (quartic ease-out) and pulls back to the overview for the case, the summary, and home. Hover draws the ink box and tooltip; a click (not a drag) on a part opens its step. With all seven parts in, the PC powers on: fans spin up, light strips and an interior light come up together. On home the build assembles itself in sequence when it enters the viewport and sways on the glass side; in the builder the sway is barely perceptible. It renders only while on screen. Without WebGL the well stays empty and the step rail carries the state.

### Signature Component: The Marker Strike
An SVG path (`M2 7 C 25 3, 55 8, 98 3`) in ink, 2.5px round-capped, overflowing the price by 6% on each side at 52% height, drawn in over 360ms. It is the system's only way to cancel a price.

### Signature Component: The Price Strip
One row per store, sorted by its minimum: name with dot, a hairline axis with every offer plotted as a store-colored point (14px for that store's minimum, 8px at 60% for the rest, each ringed in white), and a right-aligned minimum with its difference to the winner. The winner's point is circled by a 22px lime ring outlined in ink.

### Home Objects
- **Hanging price tag:** a Sheet tag with ink 2px stroke, a Card Stock eyelet, and a narrow black `$`, hung on an ink thread over the home question; swings gently from its top. Hidden below 640px.
- **The marker:** an ink marker crossing the "Así se corrige el cartel" example left to right while the two old prices strike in sequence (350ms, 850ms delays).

### Motion
Motion is ease-out-expo (`cubic-bezier(0.16, 1, 0.3, 1)`) unless it is a pendulum: write-in 520ms (left-to-right clip reveal), strike 360ms (with optional delay for sequences), rise 420ms (6px up and fade) for arriving rows, slap 560ms (the cartel lands from 14px above at 107% and settles), marker-pass 1500ms after 250ms, the `cartel` view-transition morph 460ms, the step progress fill 700ms, the mobile total bar 300ms. The hanging tag swings on ease-in-out over 4.5s, forever. Under reduced motion every animation is removed: strikes render fully drawn, the marker is hidden, view transitions are instant, and the 3D scene places parts instantly, keeps fans still, drops the sway, and cuts the camera instead of dollying; it moves only on drag.

## Do's and Don'ts

### Do:
- **Do** keep exactly one pink card per screen, rotated a degree or so, with Card Lift and tape.
- **Do** render 3D parts in real materials with the cartel layer on top: the active part outlined in pink, missing ones as dashed ink ghosts, hover in ink.
- **Do** mark compatibility in ink with a check, incompatibility in alert red with the triangle.
- **Do** set every price in Archivo `wdth 62` weight 900 with tabular lining numerals.
- **Do** cancel a beaten price with the marker strike and write the new one in, never by swapping text silently.
- **Do** put data on Sheet panels and ruled lists with 1px Hairline dividers.
- **Do** show every store with the same 10px dot and its `meta.ts` color.
- **Do** keep Pencil small text on Sheet; on Card Stock use Graphite.
- **Do** honor `prefers-reduced-motion` for every animation.

### Don't:
- **Don't** use pink for backgrounds, text, statuses, or list rows outside the cartel, its search controls, and the active 3D part.
- **Don't** use lime for anything that is not the cheapest price or the savings, including "compatible", "chosen", or "done".
- **Don't** fill surfaces, tint text, or color borders with store colors.
- **Don't** add shadows or glows to panels, rows, buttons, or the 3D well.
- **Don't** put pink, lime, or store colors on 3D materials, or add colored RGB lighting, bloom, or a dark stage behind the canvas.
- **Don't** introduce a dark theme, neon glow, or a grid of equal product cards.
- **Don't** add a second typeface or use the narrow cut for running text.
