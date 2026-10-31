# Validation — Glass Effect 1.0.0

Checked on Windows x64 on 2026-10-31.

## Release checks

- All **8 Node.js tests** passed: supported source detection; rejection of
  unsupported archives and ambiguous integration points; transparent-window
  integration checks; preservation of unrelated archive entries; asset
  inclusion; executable/archive integrity; preference migration; malformed
  archive rejection; and English renderer compilation.
- The compiled **Glass-Effect-1.0.0-Setup.exe** installed successfully in an
  isolated workspace directory from a retained official source whose original
  executable has a valid OpenAI signature and whose archive matches the
  supported SHA256. The test used no shortcuts, no automatic launch, and no
  uninstall registration.
- All injected source files and the alpine asset matched the release source
  byte for byte. The executable's embedded archive-header SHA256 matched the
  installed archive. Archive-integrity verification remained enabled.
- Installation metadata and `owl-app.ini` selected the independent
  **GlassEffect** profile. No earlier project's installation was changed.
- Isolated uninstall removed the test application directory and retained
  a synthetic appearance profile.
- The component regression page used native settings CSS and control
  structures to check **14 controls**, hover, keyboard focus, typing,
  popup positioning, option selection, dynamically loaded rows, glass
  off/on, and a narrow viewport. All passed.
- A separate English appearance page passed independent control saving,
  restore-defaults, scene switching, and a 720-pixel viewport check, without
  browser errors. The README preview comes from that isolated page.
- The installer ZIP was inspected against its explicit file list. Official
  binaries, browser profiles, credentials, conversations, local QA fixtures,
  and runtime logs are excluded from the published source and packages.

## Scope and limitations

The native transparency, title-bar interaction, text-input, and window
lifecycle fixes originate from the latest local appearance revision.
Earlier local native-window checks inform this release, but their results
are not presented as a new end-to-end run of this standalone installer.

The new release checks cover installer construction, archive integrity,
configuration isolation, and browser component behavior. They do not verify
a fresh-account authentication session, every settings route or plugin,
long-duration performance, all GPU/Windows combinations, or desktop pixel
refraction. No frame-rate or latency claim is made.

Only Store package **26.1016.8622.0** / application **26.1016.62342** is
supported. The newer official package **26.1027.3384.0** was inspected and
is not supported by this patcher. Unsupported versions fail the installer
compatibility check; the official installation is not modified.

## Reproduce source tests

```powershell
node --test tests/patch.test.cjs
node --check scripts/patch.cjs
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Build.ps1
```

Installation tests require an unmodified compatible official executable
and archive. They are not distributed with this project. Use the isolated
installation command in the README.
