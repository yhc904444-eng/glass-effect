# Validation — Glass Effect 1.1.0

Checked on Windows x64 on 2026-11-05.

## Release checks

- All **8 Node.js patch tests** passed, covering supported-source detection,
  rejection of unsupported or ambiguous integration points, preservation of
  unrelated archive entries, assets, executable/archive integrity, preference
  migration, malformed archives, and English renderer compilation.
- The compiled **Glass-Effect-1.1.0-Setup.exe** installed in an isolated
  workspace directory from a retained official source with a valid OpenAI
  executable signature and the supported original archive SHA256. The test
  created no shortcuts, launched no app automatically, and registered no
  uninstaller for the daily installation.
- Injected customization files and the alpine asset matched the release
  source byte for byte. The executable's embedded archive-header SHA256 matched
  the installed archive. Archive-integrity verification remained enabled.
- Installation metadata and `owl-app.ini` selected the independent
  **GlassEffect** profile. The daily CodexGlass installation was kept intact.
- The isolated connected-workspace component preview checked zero gaps between
  permanent panes, square inner sidebar corners, a floating composer, and no
  extra pane backgrounds at body transparency values of **15%, 65%, and 95%**.
  A 960-pixel viewport and multiline text input also passed.
- The English appearance component page checked preference saving, restore
  defaults, scene switching, and a 720-pixel viewport without browser errors.
- Public preview images use fictional content and the included alpine scene.
  The workspace image is a component preview, not an authenticated session.
- The installer ZIP was checked against its explicit file list. Official
  application binaries, browser profiles, conversations, credentials, local
  QA fixtures, and runtime logs are excluded from source and downloads.

## Scope and limitations

This release carries the connected layout from the installed local
`connected-workspace-2` revision into Glass Effect's independent English
project. Permanent panes share the body transparency value; the floating
sidebar, composer, and popups keep their own saved values.

These checks do not establish fresh-account authentication, every settings
route or plugin, long-duration performance, every GPU/Windows combination,
or desktop pixel refraction. No frame-rate or latency claim is made.
The additional edge-lens experiment was cancelled and is not in this release.

Only official Store package **26.1016.8622.0** / application **26.1016.62342**
is supported. Newer builds are not claimed as compatible. Unsupported sources
fail the installer check before customization; the official app is unchanged.

## Reproduce

```powershell
node --test tests/patch.test.cjs
node --check scripts/patch.cjs
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Build.ps1
```

Installation tests require an unmodified compatible official executable
and archive. They are not distributed. See the README's isolated installation
command. `SHA256SUMS.txt` covers the downloadable EXE, ZIP, and validation JSON.
