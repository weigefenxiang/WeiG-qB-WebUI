# WeiG qB WebUI Design System

WeiG qB WebUI uses one responsive interface system for desktop and mobile. This document defines stable visual and interaction rules; feature-specific implementation details belong in the owning module.

## 1. Principles

- Clear hierarchy over decorative density.
- Shared primitives over feature-local controls.
- One application state across desktop and mobile.
- Light, dark and reduced-motion behavior are first-class.
- Source capability determines whether a qB control exists.
- Critical interactions are validated by real user actions and final visible state.

## 2. Shared Primitives

### Select

`W.Components.selectControl()` owns Select behavior and presentation. Feature modules provide values, labels and business mapping; they do not create an independent Select lifecycle or skin.

Floating Select menus stay within the appropriate modal/top-layer context and remain reachable inside the viewport. Internal option scrolling owns its own scroll position.

### Dialog

`W.DialogRuntime` owns modal construction/adoption, open/close, focus return, Escape handling, backdrop policy, desktop drag and viewport clamping.

Feature modules own dialog content and semantic actions, not modal lifecycle.

### Tables

Shared DataGrid presentation owns column configuration, header gestures, resizing and common narrow-column behavior. Source-derived column identity and feature data remain with the semantic surface.

### Feedback

`W.Feedback` owns transient toasts and status feedback. Feature modules do not introduce parallel notification systems.

## 3. Bootstrap Transport

### PRIVATE-BOOTSTRAP — ordered initial asset transport is one owner

`webui/private/index.html` owns the initial private-shell asset transport plan. Styles may use bounded concurrency, while dependency-bearing scripts load in one explicit order with bounded retry.

A permanently failed prerequisite stops later script execution and renders a deterministic bootstrap transport error instead of allowing a partially initialized application or black screen.

Bootstrap transport does not own authentication, qB API semantics or feature state; those responsibilities remain with their canonical runtime owners.

## 4. State and Presentation

DOM state is presentation output. Application truth belongs to explicit owners.

Presentation code must not infer qB state by reading text labels, rendered counters or CSS classes from another feature.

Responsive code may move or resize a control, but it must not create a second filter state, Settings draft, qB client, selection store or polling owner.

## 5. Layout

Desktop layouts may use multi-column grouping where source structure and available width permit it. Long labels, structured editors, notes, text areas and semantically grouped controls remain readable rather than being forced into a fixed grid.

Mobile uses the same semantic controls and state with adaptive placement. Controls stack when required for readability and touch reachability.

Each scrollable surface has one scroll owner. Dialog shells stay bounded; actual overflowing content regions scroll. Virtualized lists preserve active horizontal/vertical user interaction and apply deferred snapshots only after interaction settles.

## 6. Settings Presentation

Settings are rendered from source-derived structure. The renderer may adapt layout but must preserve source order, semantic grouping, option identity, writeability gates, helper/copy relationships and source-derived compound control semantics.

Compound families such as time ranges are represented as semantic families, not preference-key-specific layout patches.

Displaying a value is not sufficient evidence that it is editable. Editable controls must flow through the canonical draft, write-safety gate, qB write and verified reread.

## 7. Capability Presentation

If an exact upstream surface does not expose an authoritative capability, the normal control is omitted rather than shown as a misleading disabled control.

Version badges are diagnostics, not a substitute for source-derived capability evidence.

## 8. Motion

Motion is subtle and semantic. Active transfer/checking states may use restrained animation; completed, paused, queued, stalled and error states remain visually stable.

Reduced-motion preferences remove nonessential animation without removing state information.

## 9. Theme Contracts

### THEME-OWNER

`W.Theme` is the single theme preference/resolution owner. Feature modules consume resolved theme state and tokens.

### THEME-MODE

The supported modes are `system`, `time`, `light` and `dark`.

### THEME-RESOLUTION

Theme resolution is centralized. Feature modules do not implement independent light/dark resolution.

### THEME-SYSTEM

System mode follows `prefers-color-scheme` through the canonical owner.

### THEME-TIME

Time mode uses the canonical day/night schedule and boundary timer; it does not poll continuously.

### THEME-SURFACE

Shared surfaces use semantic theme tokens rather than feature-local light/dark overrides.

### THEME-DARK-STABILITY

Introducing or changing Light-theme tokens must not silently change the accepted Dark-theme baseline unless that Dark change is intentional and validated.

### THEME-MOTION

Theme and motion behavior respect reduced-motion preferences.

### THEME-RETIRE

Retired theme buttons, duplicate resolvers, patch files and parallel preference owners must not return.

## 10. Interaction Acceptance

Critical controls are tested by performing the actual user action and asserting the semantic transition plus final visible/computed state.

Examples include Select choice, Settings save/reread, Dialog keyboard/pointer lifecycle, table column interaction and responsive navigation.

Element existence alone is not acceptance.

## 11. Naming

### SEMANTIC-NAMING

Current identifiers describe stable responsibility, not implementation chronology. Avoid numeric revision suffixes or release-numbered component names. Git history owns revisions.

First-party filenames should describe responsibility, for example `dialog-runtime.js`, `settings-schema.js` or `torrent-semantics.js`.
