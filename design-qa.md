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

Final result: passed
