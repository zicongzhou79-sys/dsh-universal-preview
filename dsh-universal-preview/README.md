# @zhouchunxiao/dsh-universal-preview

Right-Sidebar preview renderers the shipped document preview does not provide:
video, audio, LaTeX sources, and JSON/YAML structure views. It registers nothing
that already exists and replaces no builtin renderer.

## Scope decisions

The shipped `@deepseek-ai/dsh-client-ui-sidebar-documentpreview` already renders
Markdown, code, plain text, PDF, HTML, images, Excel/CSV/TSV, and converts
DOC/DOCX/PPT/PPTX to PDF. Duplicating those would compete with builtin
renderers, so this bundle adds only:

| Suffix | Renderer id | Loading | Notes |
|---|---|---|---|
| `mp4` `m4v` `webm` `ogv` | `/video` | `bytes-complete` | Native `<video>` over a Blob URL. |
| `mp3` `wav` `flac` `m4a` `aac` `opus` `oga` `ogg` | `/audio` | `bytes-complete` | Native `<audio>` over a Blob URL. |
| `tex` `latex` `ltx` `sty` `cls` | `/latex` | `text-pages` | KaTeX inside a sandboxed iframe. |
| `json` | `/json` | `text-pages` | Collapsible tree plus located parse errors. |
| `yaml` `yml` | `/yaml` | `text-pages` | Same tree and error reporting for a YAML subset. |

All ids live under this package's name. Every registration uses the `extension`
band, so it wins for its own suffixes while builtin renderers keep theirs. The
plain-text and code previews stay available as alternatives in the renderer
dropdown, because no builtin id is claimed.

`.ogg` and `.oga` are claimed by the audio renderer: the builtin list marks
`ogg` as an unviewable binary container, so without this claim a plain Ogg file
would only show an unsupported empty state. `.ogv` stays in the video renderer.

## Host half

None. `index.js` only exports `apply()`. File reads come from the Host's existing
`remote.workspaceFiles`, and Office conversion from `officeToPdf`; another Host
service would duplicate them.

## JSON and YAML structure views

Both renderers offer a tree view and a raw-source view.

- JSON parsing uses `JSON.parse`; when it throws, a local syntax scan reports the
  first invalid character as a 1-based line and column. The scan exists because
  engines phrase and truncate their own messages differently, so their text alone
  is not a reliable location.
- YAML parsing covers block mappings, block sequences, flow collections
  (`[a, b]`, `{k: v}`), single- and double-quoted scalars, comments, `---`
  separators, block scalars (`|`, `>`, with `-`/`+` chomping), and
  numbers/booleans/nulls. Errors carry the offending line and column, and the body
  shows the surrounding lines with the failing one highlighted.
- Trees expand on demand, open the first two levels by default, and page in 200
  children at a time, so a large document does not render in one pass.

Known YAML limitations: anchors and aliases (`&a`, `*a`) are not resolved and stay
literal text, merge keys (`<<`) are not applied, multi-document files expose only
the first document, and tags (`!!str`) are not interpreted. Comments inside flow
collections are not stripped. Files that rely on those features are still readable
through the raw-source view.

## Offline behaviour

- Video and audio decoding depends on the browser's codec set. H.264 in MP4 and
  MP3/WAV are the safe common denominators; HLS/DASH playlists and DRM are out of
  scope.
- KaTeX loads from `cdn.jsdelivr.net` inside a `sandbox="allow-scripts"` iframe
  with `no-referrer`. Without network access the frame states that plainly. The
  frame cannot reach the application origin.
- The LaTeX preview renders the whole source as display math; multi-file
  documents, `\input`, `\usepackage` packages, and BibTeX are not resolved, and
  sources over 20 000 characters are truncated.

Nothing here writes to the workspace, the Session log, or a layout store.

## Tests

`client.js` keeps its parsers between `/* @structured-parse:begin */` and
`/* @structured-parse:end */`. Those markers let a plain Node script evaluate the
parsers without a browser; 13 assertions cover nested mappings, sequences of
mappings, flow collections, block scalars, quoting and comments, scalar
sequences, YAML error lines, JSON success, and four JSON error locations
(malformed value, trailing comma, unterminated string, trailing content).

## Verification status

Installed in the current profile and active for the suffixes above. Parsers pass
their Node tests. Rendered pixels were not verified: this Agent has no browser
control in this session.