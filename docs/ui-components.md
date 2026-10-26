# UI component reference

Read this file **before every UI change**. Reuse the components and classes below, then update this file in the same change if their appearance or behavior changes. `src/style.css` is the implementation; later rules and media queries override earlier ones. Check the final computed style in the browser when a selector occurs more than once.

All dimensions below are CSS pixels with `box-sizing: border-box`. Widths are fluid unless a fixed size or maximum is listed. Heights are minimums when text must wrap. Do not force a long label into a fixed-height box. Reference updated October 25, 2026.

## Foundations

| Item | Specification |
| --- | --- |
| Body type | DM Sans, default 23px, weight 400 |
| Headings | Manrope, weight 750; h1 31px / 1.3, h2 and h3 23px / 1.4; page-title h1 28px |
| Main text | `#243d38` |
| Supporting text | `#697770`, line-height 1.6 |
| App surface / outside surface | `#fffefa` / `#e9eee9` |
| Default / Activity Log theme | `--section: #356c48`, `--section-soft: #e6f0e4`, `--section-border: #9fbaa2` |
| Mindfulness theme | `#225e8a`, `#e4eff8`, `#9dbbd3` |
| Values / scheduling theme | `#674a86`, `#f0eafa`, `#c9b9da` |
| Value icon tile | `#e7dcf1`, icon `#674a86` |
| Mood card | text `#805522`, surface `#faf3e7`, border `#e8d4ad` |
| Delete / error | `#a45246`; destructive account action surface `#f8eeea` |
| Keyboard focus | 3px `#c48428`, 4px offset; keep visible |
| Disabled controls | Opacity .4, default cursor; never rely on color alone for control state |
| Standard motion | Background/border/color/shadow 260ms ease; page entry 380ms ease-out, opacity 0→1 and translateY 7→0 |
| Reduced motion | Disable animations, transitions and smooth scroll under `prefers-reduced-motion: reduce` |

Use section variables for section controls. A scheduled activity keeps purple styling even inside the green Activity Log. An unscheduled current activity uses green life-area icons.

## Layout and navigation

| Component / selector | Size, spacing and behavior |
| --- | --- |
| `.app-shell` | Default max-width 440; min-height 100dvh; centered; surface `#fffefa` |
| Small `main` | Padding 24px 16px 130px; at ≤360px horizontal padding 12 |
| ≥768px shell / `main` | Shell max-width 760; main padding 36px 40px 135px |
| ≥1024px shell / `main` | Shell max-width 1050; columns 230px + remaining space; main padding 42px 38px 80px |
| ≥1440px shell / `main` | Shell max-width 1320; main padding 48px 56px 86px |
| `.page-topbar` | Settings control at top-right, min-height 44; title reserves 64px on right to prevent overlap |
| `.icon-button` | 44×44 circle, background `#f3f3ed`, color `#65746c` |
| Bottom `nav` | Fixed bottom, z-index 4, surface `#fffefaef`, 12px backdrop blur, 1px `#e6e9df` top border; respect safe-area inset |
| Mobile nav buttons | Min-height 62; icon 22×22, gap 3; text 16px, 15px at ≤360px; active section has a filled icon and transparent background |
| Tablet nav | Bottom placement through 1023px; max-width follows shell; normal labels 23px |
| Desktop nav | Sticky top 24; 230px column; padding 35px 12px; vertical gap 14; item min-height 66, padding 10px 12px, radius 12; active section uses soft background |
| Nav icons | Lucide icons with `flex-shrink: 0`; active icon fills current color, internal strokes use app surface. Use the same Brain icon for all Mindfulness entry points |
| `.back` | Inline arrow + label, 8px gap, min-height 44, transparent, 23px; linking screen bottom margin 22 |
| `.toast` | Desktop/tablet ≥768px bottom-right, right 24, max-width 400; mobile above bottom nav with spacing and safe-area inset. Never center it over primary content |

At ≥1440px the home dashboard has two columns, fractions .95 and 1.15 with a 34px gap. At smaller sizes it stacks. Do not apply fixed widths copied from a screenshot.

## Buttons, inputs and menus

| Component / selector | Size / radius / colors / spacing |
| --- | --- |
| `.primary` | Full width, min-height 60, padding 13px 16px, radius 12, gap 10, text 23px/650; section color background, white text; hover brightness .93 |
| `.secondary` | Same dimensions; soft section background, section text; default top margin 20 |
| `.block-arrow` | 46×54, radius 10, 1px `#cbd8c8`, surface `#f2f4ec`; centered icon, no shrinking |
| `.speech-field` | Flex row, width 100%, gap 8, margin-bottom 16; input shrinks into available width, microphone remains fixed |
| `.microphone` | Width 48, min-height 54, radius 12, 2px section-border; surface `#eef4ed`, text `#356c48`; listening background/border `#a45246`, white icon |
| `.item-actions-trigger` | 44×44, padding 8, radius 11, 1px `#b9c8bb`, surface `#f1f5ee`, icon `#53665a` at 22×22 |
| `.item-actions-panel` | Right-aligned 8px below trigger, flips above near viewport bottom; gap 8, padding 10, radius 16, 1px `#d3ddd0`, app surface, z-index 12; must fit viewport |
| Menu actions | Min-height 48, padding 10px 14px, radius 10, text 18px/650; delete `#a45246`, edit `#596b63`, white text/icons |
| `.wizard-next` | Min-height 60, padding 14px 18px, pill radius 32, gap 10, 20px/700; section background, white text |
| `.wizard-back` | Arrow + Back, gap 8, padding 12px 0, transparent, 21px section text |
| `.wizard-footer` | Auto top margin, padding-top 32; actions gap 14, progress 40px below actions |
| `.wizard-progress` | Centered, gap 10; bars 28×8, radius 8, `#dce4d7`; active bar 44px wide and section color |

Activity wizards use only bottom Back/Next/Save actions and bottom progress indicators. Do not restore the redundant top Home/Back links or top previous/next toggle. Mood and enjoyment require a rating; importance may be skipped and remembered ratings suppress that step for 14 days.

## Activity choices, values and life areas

| Component / selector | Size / radius / colors / spacing |
| --- | --- |
| `.entry-row` | Full width flex row, radius 14, white background, text left; strong label 23px / 1.4 |
| `.value-navigation-row` | Shared by life-area cards and Choose from this week / Schedule an activity. Min-height 88, padding 17px 14px, gap 14, 1px purple section border; label flexes, arrow anchored at right |
| `.value-heart` in navigation row | 52×52, radius 13, background `#e7dcf1`, 30×30 purple icon; fixed size, no shrink |
| Navigation chevron | 24×24; 14px right padding plus border; never adjacent to the end of a short label |
| `.value-list` | Grid, gap 18, margin 24px 0; life-area cards use 2 columns at ≥768px; accordion list remains 1 column |
| `.value-link-options` | Single-column grid, 20px gap, top margin 28; identical card construction for both actions |
| `.value-week-activities` | Top margin 28; reuse WeekPicker, bounded to the current Monday–Sunday week; initial day is today |
| `.value-day-heading` | Top margin 24; full weekday + month + day; only selected day's activities appear below |
| `.week-activity-list` | Grid gap 16, margin 20px 0 26px; no nested scrolling. Deduplicate names within the selected day, order by time, exclude automatic sleep/wake markers |
| `.value-accordion` | 1px section border, radius 20, app surface; header keeps same radius, no duplicate border |
| Mobile accordion header | Main icon 38×38 with 25px icon; 20px label, 17px at ≤360px; controls remain fixed 44/40px columns |
| Accordion body | Animate grid rows 0fr→1fr over 360ms; opacity 280ms; collapsed body must be inert and hidden from accessibility tree |
| `.value-activity-grid` | 2 equal columns, gap 12, padding 18px 14px, top border 1px `#e4daee` |
| `.value-activity-card` | Min-height 142, padding 12, radius 14, 1px `#d6c6e3`, background `#f7f3fa`; icon and menu on top, label below; gap 12px 6px; label 18px/650 |
| Value activity art | 34×34, radius 8, 1px purple border, padding 3, background `#eee5f4`, inner art 26×26; upright |
| Desktop value activity ≥1024px | Compact horizontal row, min-height 100, padding 16, gap 14; art 48×48 / inner 38×38; label 20px; 44px menu at far right |
| `.value-add-activity` | Solid 1px `#c9b9da`, radius 14, min-height 100, padding 16, gap 12, background `#f5eff9`, purple text, 32×32 plus; left aligned |
| `.schedule-value-grid` | 2 columns, gap 16, margin 20px 0; cards min-height 100, padding 16, gap 14. At ≤600px card contents stack and padding is 12 |
| `.add-schedule-value` | Plus and text centered together horizontally and vertically on all viewports, soft purple background |
| `.activity-options` | 2 columns, gap 12; gap 18 at ≥768px, 3 columns at ≥1440px |
| `.activity-choice` | Min-height 76, padding 16px 12px, radius 12, 2px border; 23px text; values variant background `#f6f2f9`, purple border |
| Mobile activity choice | Vertical icon then label, gap 10, padding 14px 10px, 19px text; trailing plus top-right |
| `.area-icon` in activity choices | 48px square, radius 12, theme soft background and theme icon color |

Selecting a library activity populates the text field and keeps a visible selected card. The larger library stays searchable. Logging separates recent choices from the rest; only scheduling offers personalized suggestions. Empty days show a clear message and a Schedule an activity action while keeping the day filter available.

## Calendar, current activities and ratings

| Component / selector | Specification |
| --- | --- |
| `.week-heading` | Flex, centered month label, 8px gap, 20px bottom margin; label 25px, 23px at ≤360px |
| `.week-selector` | 7 equal columns, 3px gaps, 32px bottom margin; each day min-height 86, padding 10px 0, radius 8, 1px `#cbd8c8`, text 23px / 1.25 |
| Selected day | Section-colored fill, white text, 2px section-color shadow; `aria-pressed=true` |
| `.typed-time` ≥768px | Hour, minute, AM/PM in that order, columns 1fr 1fr 1.5fr, gap 16; controls min-height 64; input text 27px |
| `.time-heading` | Time and microphone in same row, 16px gap; time 32px; margin-bottom 28 |
| Mobile time wheels | 3 columns, 8px gap, radius 16, 2px `#b69ccb`, surface `#eee7f5`; wheel height 240, option height 48, 25px text, selected weight 800 |
| `.moment-section` | Radius 19, 1px section border; mobile padding 12; separates current-time header from activities |
| Home current activity | Min-height 88, padding 18px 16px, 14px gap; mobile padding 12 horizontally, 10px gap, name 20px / 1.35 |
| Timeline | Scrollable full day, max-height min(640px,68dvh); desktop min(760px,78dvh); margin 24px 0 32px, padding 8px 5px |
| `.timeline-hour` | Min-height 140; padding 16px 10px, gap 18; occupied hour uses section-soft surface |
| `.timeline-entry` | 1px section border, radius 10, app surface; mobile padding 14px 12px, gap 12 |
| Timeline name/time on mobile | Name on first line(s), time beneath with 6px gap; time 16px / 1.5. At ≤360px controls wrap beneath content |
| Logged activity icon | Tile 44×44, radius 10, 1px section border, padding 4; inner art 34×34; upright |
| Scheduled activity | Surface `#f4eef9`, border `#b69ccb`; purple `#674a86` icons and soft purple tiles; retain completion controls without status sentences |
| `.rating-slider` | Margin 32px 0; slider target height 52; ticks 0–10 at 23px; track 6px, radius 9, `#8faa8a` |
| Slider thumb | WebKit 38×38 circle, 4px app-surface border and 2px section-color shadow; Firefox inner 32×32 plus border |
| `.slider-adjust` | Minus / score / plus row; score 30px / 650; margin 18px 0 30px |
| `.rating-expression` | 140×140 with contain fit; endpoint examples 52×52; no stretching or rotation |
| Importance art | `public/ratings/importance.png`, original 1448×1086 sheet. `RatingPicture` crops each 0–10 cell with an SVG viewBox and clip path, excluding printed numbers and neighboring cells. Preserve supplied art and progression |
| Mood / enjoyment art | Mood uses individual `public/ratings/mood/0.png` through `10.png`; enjoyment uses its own existing sheet crops. Do not substitute importance images for other rating kinds |

## Mindfulness and settings

| Component / selector | Specification |
| --- | --- |
| Home action card | Radius 16, 1px section border, min-height 182; icon tile 52×52 / radius 13; title 23px; soft section background |
| Visualization grid | 2 columns, gap 14; cards min-height 166, padding 17, radius 18, 2px blue section border, background `#f5f9fc` |
| Visualization icon / scene | Icon 54×54; scene width 100%, min-height 220; radius 14, `#e2eef8`, blue icon |
| Visualization guide | Gap 20, top margin 24; text 24px / 1.5, audio fills available width |
| Breathing setup illustration | Width min(100%,300px), max-height 300; contain fit; max-height 220 at ≤360px |
| Breathing durations | 3 equal columns, gap 10; min-height 82, radius 14, padding 8px 3px, 2px blue section border; number 29px, unit 18px |
| Custom breathing input | Top margin 30, padding-top 26, 1px section-border divider; duration in minutes; typed input and microphone, 12px gap |
| Stretching video | Preserve 16:9 aspect ratio, full width, no fixed short height; source `48jIXvwXmeQ` |
| `.settings-page` | Grid gap 20, max-width 1100; 2 columns at ≥1024px; open sections span both columns; mobile gap 16 |
| `.settings-card` | Padding 24, radius 18, 1px `#dce4d9`, app surface; mobile padding 20px 18px |
| Settings heading | 14px icon/text gap; icon tile 44×44, radius 12, inner icon 24×24; heading 24px / 1.35, mobile 22px |
| Settings controls / text | Body and labels 20px / 1.5; buttons min-height 52, text 20px; action row gap 12, wraps |
| Reports / saved data details | Native details/summary, summary min-height 48; content padding-top 24; chevron turns 90deg; keyboard focus visible |
| Settings switch | Track 48×28, radius 20, padding 3; thumb 22×22 circle; active moves 20px; switch target min-height 48 |
| Face consent | Checkbox 28×28, 12px gap; setup actions min-height 48; camera max-height 380, width 100%, contain fit, radius 16, mirrored preview |
| Face unavailable state | Keep card visible with explanation and Retry. Do not hide it, expose server secrets, bypass consent, or open camera before setup consent |

## Account screens

| Component / selector | Specification |
| --- | --- |
| Account shell | Max-width 520, margin 28px auto, radius 24, 1px `#d9e3d8`; desktop min-height calc(100dvh - 56px) |
| Account page | Padding 32px 36px; mobile ≤767px fills viewport, no outer border/radius, padding 28px 24px with safe-area bottom |
| Brand / heading | Brand 24px / 800, icon 38×38 / radius 12; heading 34px; supporting text 20px / 1.5 |
| Account input | Min-height 60, padding 14px 18px, radius 18, 1px `#c9d9c8`, surface `#f2f6ee`, text 23px; labels 22px / 600 |
| Account microphone | Min-height 60, radius 16; field bottom margin 30 |
| Account footer | Flex with wrapping, 12px horizontal and 18px vertical gap; top padding 72, mobile 60 |
| Account submit | Min-height 60, padding 14px 20px, radius 32, 21px / 700, green background / white text, 24px arrow; hover `#28583a` |
| Account switch | Transparent, green text 21px / 650, padding 12px 0 |

## Before finishing a UI change

- Read this reference and the affected component's final CSS rules before editing.
- Reuse a shared component/class instead of creating a nearly identical version. Keep navigation icon size fixed and arrow/menu placement consistent.
- Test the actual flow with synthetic data at 390px mobile, 768px tablet and a desktop width; also check 320px for overflow and long labels.
- Check empty, selected, disabled, expanded and keyboard-focus states relevant to the change. Keep touch controls usable and respect reduced motion.
- Update this document with changed sizes, colors, radii and responsive exceptions. Do not silently rewrite unrelated components to make the table uniform.
