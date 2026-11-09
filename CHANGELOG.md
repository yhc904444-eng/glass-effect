# Changelog

## 1.2.0 — 2026-11-09

- Add automatic background detection and a smoky base for bright webpages.
- Add Auto, Clear, Balanced, and Reading modes with saved manual choices.
- Smooth tint changes, pause detection when hidden/minimized or in manual
  modes, and use a reading base when capture is unavailable.
- Preserve all existing appearance slider values during migration.
- Repair tint/body/composer/popup/floating-sidebar controls so their changes
  remain visible in automatic and manual reading modes.
- Keep the connected shell and independent floating composer geometry.
- Provide native sampler source, release checks, and native-window test media.


## 1.1.0 — 2026-11-05

- Join the title bar, navigation rail, docked sidebar, and workspace into one
  continuous glass shell with fine internal dividers.
- Paint the permanent panes with one shared background coat so their
  transparency stays synchronized.
- Remove the docked sidebar's clipped top-left and bottom-right gaps.
- Keep the composer floating with its existing shape and independent controls.
- Rename Workspace transparency to Body transparency. The separate sidebar
  control now explicitly applies to the floating, peeking sidebar.
- Preserve saved preference keys, English controls, and the independent
  Glass Effect installation and profile.

## 1.0.0 — 2026-10-31

Initial standalone Glass Effect release, based on the latest local
`settings-controls-glass-2` appearance revision.

- Reveal the live desktop through a native transparent window.
- Include an optional alpine lake scene and gently animated glass edges.
- Add independent workspace, sidebar, composer, and popup transparency.
- Expose edge blur, width, intensity, and animation-speed controls.
- Extend glass styling to native settings buttons, select shells, and inputs.
- Retain the interaction, incremental DOM update, asynchronous preference
  saving, and title-bar drag fixes from the latest local appearance.
- Provide English controls, documentation, and installer text.
- Use an independent Glass Effect installation, profile, and shortcuts.
