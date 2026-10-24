# @local/dsh-universal-preview

Right-Sidebar preview renderers that the shipped document preview does not provide:
video files and LaTeX sources. It registers nothing that already exists and
replaces no builtin renderer.

## Scope decisions

The shipped `@deepseek-ai/dsh-client-ui-sidebar-documentpreview` already renders
Markdown, code, plain text, PDF, HTML, images, Excel/CSV/TSV, and converts
DOC/DOCX/PPT/PPTX to PDF. Duplicating those would compete with builtin
renderers, so this bundle adds only:

| Suffix | Renderer id | Loading | Notes |
|---|---|---|---|
| `.mp4`, `.m4v`, `.webm`, `.ogv` | `@local/dsh-universal-preview/video` | `bytes-complete` | Native `<video>` over a Blob URL. |
| `.tex`, `.latex`, `.ltx`, `.sty`, `.cls` | `@local/dsh-universal-preview/latex` | `text-pages` | KaTeX inside a sandboxed iframe. |

Both are registered at the `extension` band, so they win over the plain-text
fallback for their own suffixes while every builtin renderer keeps its own
extensions. The builtin plain-text and code previews stay available as
alternatives in the renderer dropdown, because this plugin never claims a
builtin id.

## Host half

None. `index.js` only exports `apply()`. The Host already provides file reads
through `remote.workspaceFiles`, and Office conversion through
`officeToPdf`; adding another Host service would duplicate them.

## Client half

`client.js` is a plain `window.__ModuleLoader__.load` module, the format the
Harness page expects for a `dsh.client` package. It injects `slots`, `locale`,
and `documentPreviews`, registers two dictionaries, two registrations, and two
keyed bodies in `sidebar.right.tab.document`.

## Offline behaviour and limitations

- Video decoding depends on the browser codec set; H.264 in MP4 is the safe
  common denominator. HLS/DASH playlists are out of scope, and DRM would need a
  license server.
- KaTeX loads from `cdn.jsdelivr.net` inside a `sandbox="allow-scripts"` iframe
  with `no-referrer`. Without network access the frame shows an explicit notice
  instead of failing silently. The frame cannot reach the application origin.
- The LaTeX preview renders the whole source as display math; multi-file
  documents, `\input`, `\usepackage` packages, and BibTeX are not resolved.
- Sources longer than 20 000 characters are truncated for the formula preview.
- Nothing is written to the workspace, the Session log, or a layout store.

## Verification status

Installed in the current profile; the two bodies appear as live occupants of
`sidebar.right.tab.document` beside the eight builtin ones. Rendered pixels were
not verified because this Agent has no browser control in this session.

## Repository and packaging

Source: <https://github.com/zicongzhou79-sys/dsh-universal-preview>

Build the distributable tarball and install it locally:

```bash
npm pack                                            # -> local-dsh-universal-preview-0.1.0.tgz
npm install ./local-dsh-universal-preview-0.1.0.tgz # install from the tarball
```

The `files` field in `package.json` keeps the tarball minimal: `index.js`,
`client.js`, `cordis.patch.yml`, `locale/*.json`, `icon.svg`, plus the always
included `README.md` and `package.json`. The built `.tgz` is committed beside
the sources as a release artifact, so every tag ships with a ready-to-install
package.

Publishing to the public npm registry would additionally require renaming the
`@local` scope to an owned one (e.g. `@zhouchunxiao/...`) and setting
`"private": false`; this repository currently distributes the package as a
tarball and through the DSH bundle patch mechanism only.