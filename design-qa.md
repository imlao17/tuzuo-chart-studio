# Design QA

## Evidence

- Source: `CleanShot 2026-07-26 at 22.06.12@2x.png`
- Implementation: `design-qa/template-gallery-pass2.png`
- Combined comparison: `design-qa/comparison-pass2.png`
- Viewport comparison: 1560 x 742 px
- State: template gallery open, grouped column selected
- Density: 9 desktop columns, 126 px cards, 8 px gaps

## Visual Review

- The white surface, thin gray borders, compact title strip, dense chart grid, and label placement match the Flourish reference.
- All thumbnails are real ECharts previews rather than placeholders.
- The implementation intentionally stops at the requested 20 common charts, leaving white space below the third row.
- Search, current selection, and Chinese labels are intentional product additions.
- Visual Verdict improved from 72 to 93 after tightening the header, grid, card height, and spacing.

## Interaction Review

- Editing a table value from 128 to 256, returning to Preview, and reading the updated value in the rendered SVG passed.
- Transparent and solid backgrounds both rendered.
- Custom top margin rendered without blanking the chart.
- Population pyramid and streamgraph templates rendered as non-empty SVG charts.
- No new console errors or ECharts warnings appeared after the final reload and interaction pass.
- Production build, lint, and three automated tests passed.

## Settings Panel V3

- Official references: Flourish editor overview and official documentation for colors, labels, axes, legends, and chart settings.
- Before state: `design-qa/editor-v2-normalized.png`
- Implementation: `design-qa/settings-panel-v3.jpg`
- Combined comparison: `design-qa/settings-comparison-v3.png`
- Comparison viewport: 1126 x 969 px
- Visual Verdict: 94

### Visual Review

- The global toolbar is fixed at the top with the workspace beginning exactly 58 px below it.
- The template control is now a compact 44 px selector rather than a large card.
- The right panel follows Flourish's searchable accordion pattern with dense controls and thin separators.
- Palette editing uses real color inputs, exact hex values, ordering controls, saved schemes, and series overrides.
- The main chart remains the dominant workspace despite the expanded configuration surface.

### Interaction Review

- A custom color was applied to the live SVG and persisted as a named palette after reload.
- Settings search isolated the Number formatting section and restored all groups when cleared.
- Y-axis title, maximum value, and dotted grid styling appeared in the rendered SVG.
- PNG preparation produced a native `blob:` file link; 2x and 4x generated distinct files and filenames.
- The PNG link passed direct media download validation in the in-app browser.
- Lint, production build, and all three automated tests passed.

Final result: passed
