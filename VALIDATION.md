# Validation — Glass Effect 1.2.0

Release checks run on Windows x64 on 2026-11-09.

## Current release source

- **14 Node.js tests** cover patch compatibility and rejection paths,
  preservation of unrelated archive entries, executable/archive integrity,
  native helper packaging, modeled reading contrast, smoothing, bright text,
  failure recovery, missing helpers, sampling pause/resume, preference
  migration, concurrent saves, cross-window updates, reloads, and subframe
  access boundaries. Settings tests use a synthetic temporary profile.
- **30 English component checks** cover four mode controls, keyboard selected
  state, visible fallback/dark-background status, scene selection, defaults,
  runtime errors, and 800/500/320-pixel layouts. Body transparency responds in
  all four modes. Fifteen tint/body/composer/popup/floating-sidebar cases each
  save and visibly change computed paint at three slider positions.
- The EXE and installer ZIP are built from an explicit allowlist. The native
  sampler is compiled from the included C# source. The test recorder, official
  application binaries, browser profiles, credentials, conversations, raw
  recordings, backups, and local QA logs are excluded.
- The compiled setup is checked in an isolated directory using an unmodified
  compatible official source, no shortcuts, no automatic launch, and no daily
  installation registration. Injected files, helper digest, profile routing,
  and embedded archive-header integrity are checked against release source.
  A synthetic profile is retained during isolated uninstall.

See [validation-1.2.0.json](docs/validation-1.2.0.json) for the machine-readable
release results and their scope.

## Native adaptive engine evidence

The included comparison image and approximately 40-second video are actual
captures of the local Chinese CodexGlass prototype with two separate native
windows and fictional webpage content. Nineteen native checks passed on
2026-11-08: white, clean dark, mixed, gray, scrolling, dark text-heavy pages,
fallback and recovery, mode switching, hide/resume, window movement, typing,
menu interaction, geometry, and isolation of the test profile. Display scaling
was 150%. Median sampling time was 27.67 ms, p95 35.59 ms, maximum 53.65 ms
in those scenarios; these are local measurements, not general guarantees.

The release carries that adaptive module and native sampler source with
English controls, the subsequent slider fix, and a narrow-layout border-box
correction. The video predates the slider fix. The current English release
has separate component/source/installer checks described above. The media
does not establish authenticated-account or all-page behavior.

## Scope and limitations

Only official Store package **26.1016.8622.0** / app **26.1016.62342**, Windows
11 22H2+ x64, is supported. Newer sources are rejected before customization.
The official installation is unchanged. The customized executable's embedded
archive integrity remains enabled; its original Authenticode signature is
invalid after customization. Normal launch does not open a debugging port.

Protected, unresponsive, or capture-incompatible windows can use the reading
fallback. Other scaling factors, every GPU, every plugin/settings route,
fresh-account authentication, and long-duration performance were not tested.
The contrast calculation uses sampled background statistics and modeled text;
it is not a guarantee for every rendered pixel or element.

## Reproduce

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\native\Build.ps1
node --test tests/*.test.cjs
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Build.ps1
```

Optional component QA requires an installed Playwright module and Chrome:

```powershell
$env:PLAYWRIGHT_MODULE = 'C:\path\to\node_modules\playwright'
node tests/appearance.cjs
```

Installation tests require a compatible original source, which is not
distributed. See the README for the isolated installation command.
`SHA256SUMS.txt` covers the downloadable installer, ZIP, comparison, video,
and validation JSON.
