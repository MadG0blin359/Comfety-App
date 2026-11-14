---
name: Obsidian Clarity Accessible Mobile
colors:
  surface: '#0f131c'
  surface-dim: '#0f131c'
  surface-bright: '#353943'
  surface-container-lowest: '#0a0e17'
  surface-container-low: '#181b25'
  surface-container: '#1c1f29'
  surface-container-high: '#262a34'
  surface-container-highest: '#31353f'
  on-surface: '#dfe2ef'
  on-surface-variant: '#bdc8d1'
  inverse-surface: '#dfe2ef'
  inverse-on-surface: '#2c303a'
  outline: '#87929a'
  outline-variant: '#3e484f'
  surface-tint: '#7bd0ff'
  primary: '#8ed5ff'
  on-primary: '#00354a'
  primary-container: '#38bdf8'
  on-primary-container: '#004965'
  inverse-primary: '#00668a'
  secondary: '#45dfa4'
  on-secondary: '#003825'
  secondary-container: '#00bd85'
  on-secondary-container: '#00452e'
  tertiary: '#c5cce6'
  on-tertiary: '#283044'
  tertiary-container: '#a9b1ca'
  on-tertiary-container: '#3c4459'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#c4e7ff'
  primary-fixed-dim: '#7bd0ff'
  on-primary-fixed: '#001e2c'
  on-primary-fixed-variant: '#004c69'
  secondary-fixed: '#68fcbf'
  secondary-fixed-dim: '#45dfa4'
  on-secondary-fixed: '#002114'
  on-secondary-fixed-variant: '#005137'
  tertiary-fixed: '#dae2fc'
  tertiary-fixed-dim: '#bec6e0'
  on-tertiary-fixed: '#131b2e'
  on-tertiary-fixed-variant: '#3f465b'
  background: '#0f131c'
  on-background: '#dfe2ef'
  surface-variant: '#31353f'
  surface-interactive: '#1E293B'
  text-primary: '#F8FAFC'
  text-secondary: '#CBD5E1'
  border-subtle: '#334155'
  warning-hazard: '#F59E0B'
  danger-hazard: '#EF4444'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 19px
    fontWeight: '600'
    lineHeight: 26px
  body-transcript:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: 0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 17px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  label-lg:
    fontFamily: Inter
    fontSize: 17px
    fontWeight: '700'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.04em
  caption-status:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.06em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.25rem
  space-xl: 1.75rem
---

## Brand & Style

This design system delivers an ultra-legible, ergonomic, dark-mode-native mobile interface designed for accessible assistive navigation, ambient awareness, and effortless touch interaction. Grounded in functional tactile modernism with high-contrast accessibility principles, the visual language avoids decorative noise in favor of radical clarity, instant spatial legibility, and oversized physical targets.

The aesthetic fuses deep oceanic dark backgrounds with vibrant luminous accents to preserve dark-adapted vision while ensuring WCAG AAA legibility. Layouts prioritize focus with a maximum of three core focal zones per viewport, instilling immediate trust, composure, and speed under real-world, high-motion, or low-light conditions.

## Colors

The palette is anchored on high luminance contrast against an ultra-deep canvas to minimize visual fatigue and maximize readability:

- **Primary Accent (`#38BDF8`)**: Sky Blue delivers crisp focal emphasis for primary actions, current focal states, and navigational targets.
- **Secondary Accent (`#34D399`)**: Emerald Green indicates operational safety, active listening states, and resolved confirmations.
- **Tertiary Surface (`#131B2E`)**: Slate Navy defines structured card layers lifted from the canvas.
- **Neutral Canvas (`#090D16`)**: Deep Obsidian forms an abyss-level backdrop that eliminates glare and extends battery life on OLED displays.
- **Semantic Signals**: Amber (`#F59E0B`) alerts users to potential hazards and cautionary context; Crimson (`#EF4444`) commands attention for immediate obstacles and destructive events.
- **Structural Contrast**: Crisp 1.5px borders (`#334155`) preserve shape definition without relying purely on drop shadows.

## Typography

The type system is calibrated for assistive legibility, prioritizing oversized body and transcript weights so information can be parsed at a glance or from an arm's length away.

- **Transcript Text (`body-transcript`)**: Tuned to 22px Semi-Bold with a generous 32px line height to allow smooth speech-to-text reading.
- **Labels & Interactive Affordances**: Rendered at 17px Bold (`label-lg`) to ensure touch actions are unambiguous.
- **Status & Badges (`caption-status`)**: Medium-to-bold with slightly expanded letter tracking (0.06em) and uppercase rendering for instantaneous categorization.
- **Multilingual Support**: When rendering Urdu transcripts or prompts, substitute standard fallback with `Noto Nastaliq Urdu`, adjusting line-height multipliers by an additional 1.35x to prevent diacritic clipping.

## Layout & Spacing

The layout is built for single-hand mobile ergonomics within a strictly bounded safe-area container:

- **Grid Model**: A flexible 4-column mobile grid using 16px (`1rem`) outer margins and 16px (`1rem`) gutters between vertical stacks and dual-column controls.
- **Touch Target Enclosure**: A minimum interactive envelope of 48x48dp is strictly enforced for every tappable element, regardless of its visual icon or text dimensions.
- **Vertical Rhythm**: Related elements cluster with `space-sm` (8px) and `space-md` (16px). Distinct cognitive zones and card sections separate via `space-lg` (20px) to `space-xl` (28px).
- **Reflow & Hand Anchoring**: Key trigger buttons and actionable status bars anchor to the bottom 40% of the screen within the thumb zone, reserving top zones exclusively for ambient readouts.

## Elevation & Depth

This system avoids heavy drop shadows, which scatter poorly on pure black OLED backgrounds. Instead, depth is conveyed through **structured luminance stepping** and **crisp tectonic outlines**:

1. **Level 0 (Canvas Base)**: Deep Obsidian (`#090D16`), flat and non-reactive.
2. **Level 1 (Card & Content Container)**: Slate Navy (`#131B2E`) with a uniform 1.5px stroke of `#334155` to define boundaries crisply against dark backgrounds.
3. **Level 2 (Interactive Floating Controls & Chips)**: Surface Interactive (`#1E293B`) bordered by `#334155` or accented rings (`#38BDF8`).
4. **State Highlights**: Activated items do not rely on elevation height; they express focus through a luminous 2px solid halo (`#38BDF8` or `#34D399`) with a subtle 6px ambient glow (e.g., `rgba(56, 189, 248, 0.25)`).

## Shapes

The interface balances organic softness with tactical precision:

- **Cards & Primary Containers**: Fixed at `20px` corner radii, generating a friendly, non-punishing container structure that comfortably nests dense data.
- **Interactive Controls & Buttons**: Set to `14px` border radii to distinguish discrete operational controls from whole-card surfaces.
- **Status Indicators & Micro Chips**: Fully rounded pill shapes (`9999px`) to immediately communicate telemetry, operational badges, and status tags.

## Components

### Buttons & Interactive Triggers
- **Primary Action**: Solid `#38BDF8` background with `#090D16` bold text, minimum 52px height for high-accuracy tapping, 14px radius, no border.
- **Secondary Action**: Background `#1E293B`, 1.5px `#334155` border, `#F8FAFC` text, 52px height.
- **Active State / Listening**: Solid `#34D399` fill with deep obsidian text or a pulsed 3px `#34D399` outer ring during microphone activation.

### Cards & Telemetry Displays
- Base background `#131B2E`, 20px radius, 1.5px `#334155` stroke.
- Inner padding fixed at 20px (`space-lg`).
- Internal content divided cleanly by semantic spacing without dividing rule lines.

### Chips & Controls
- Height fixed at 44px (with 48px hit slop). Radius 14px.
- Unselected: `#1E293B` background, `#CBD5E1` text, 1.5px `#334155` border.
- Selected: `#38BDF8` 1.5px border with 15% `#38BDF8` tint fill and `#F8FAFC` text.

### Inputs & Transcript Fields
- Background `#090D16` recessed inside a `#131B2E` container.
- 1.5px border defaulting to `#334155`, expanding to 2px `#38BDF8` on focus.
- 22px type size for real-time speech transcription input.

### Checkboxes & Radios
- Oversized 26x26px bounding box inside a 48x48px hit target.
- Radio radius 50%; Checkbox radius 6px.
- Unchecked: 2px `#334155` border. Checked: `#38BDF8` solid fill with `#090D16` glyph.

### Hazard & Obstacle Alerts
- High-visibility banner containers with 2px solid `#EF4444` borders and a 12% `#EF4444` background tint for rapid visual and sensory warnings.