window.__ModuleLoader__.load({
  id: '@zhouchunxiao/dsh-universal-preview',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /** This package's identity; renderer ids and the style tag derive from it. */
    const PACKAGE_ID = '@zhouchunxiao/dsh-universal-preview';
    /** Copy owned by this package; the host locale service binds these dictionaries. */
    const NS = 'universalPreview';
    const zh = {
      title: '视频',
      latexTitle: 'LaTeX',
      audioTitle: '音频',
      jsonTitle: 'JSON',
      yamlTitle: 'YAML',
      videoPreview: '视频预览：{name}',
      audioPreview: '音频预览：{name}',
      loading: '正在加载…',
      unsupportedVideo: '视频预览需要完整文件内容',
      unsupportedAudio: '音频预览需要完整文件内容',
      videoFailed: '无法播放此视频，或当前环境不支持该编码格式',
      audioFailed: '无法播放此音频，或当前环境不支持该编码格式',
      latexPreview: 'LaTeX 预览：{name}',
      latexEmpty: '这个 LaTeX 文件为空',
      treeView: '结构',
      rawView: '原文',
      parsedOk: '{kind} 解析成功',
      parseError: '{kind} 解析失败',
      parseErrorAt: '第 {line} 行，第 {column} 列',
      emptyDocument: '文件为空',
      rootName: '根节点',
      arrayItems: '数组 · {count} 项',
      objectKeys: '对象 · {count} 个键',
      moreItems: '再显示 {count} 项'
    };
    const en = {
      title: 'Video',
      latexTitle: 'LaTeX',
      audioTitle: 'Audio',
      jsonTitle: 'JSON',
      yamlTitle: 'YAML',
      videoPreview: 'Video preview: {name}',
      audioPreview: 'Audio preview: {name}',
      loading: 'Loading…',
      unsupportedVideo: 'Video preview requires the complete file contents.',
      unsupportedAudio: 'Audio preview requires the complete file contents.',
      videoFailed: 'This video cannot play here, or its codec is unsupported in this environment.',
      audioFailed: 'This audio cannot play here, or its codec is unsupported in this environment.',
      latexPreview: 'LaTeX preview: {name}',
      latexEmpty: 'This LaTeX file is empty.',
      treeView: 'Structure',
      rawView: 'Source',
      parsedOk: '{kind} parsed successfully',
      parseError: '{kind} could not be parsed',
      parseErrorAt: 'Line {line}, column {column}',
      emptyDocument: 'This file is empty.',
      rootName: 'root',
      arrayItems: 'array · {count} items',
      objectKeys: 'object · {count} keys',
      moreItems: 'Show {count} more'
    };

    /** Container suffixes and media types claimed by the video renderer. */
    const VIDEO_MEDIA_TYPES = {
      mp4: 'video/mp4',
      m4v: 'video/mp4',
      webm: 'video/webm',
      ogv: 'video/ogg'
    };
    /** Audio suffixes. `.ogg`/`.oga` are audio here so a plain Ogg file plays instead of failing. */
    const AUDIO_MEDIA_TYPES = {
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      flac: 'audio/flac',
      m4a: 'audio/mp4',
      aac: 'audio/aac',
      opus: 'audio/ogg',
      oga: 'audio/ogg',
      ogg: 'audio/ogg'
    };
    /** Plain-text LaTeX suffixes. They keep the builtin plain-text and code alternatives. */
    const LATEX_EXTENSIONS = ['tex', 'latex', 'ltx', 'sty', 'cls'];

    function fileNameOf(address) {
      const text = String(address ?? '').replace(/[?#].*$/u, '').replaceAll('\\', '/');
      return text.slice(text.lastIndexOf('/') + 1);
    }

    function suffixOf(address) {
      const name = fileNameOf(address).toLowerCase();
      const dot = name.lastIndexOf('.');
      return dot === -1 ? '' : name.slice(dot + 1);
    }
    /* @structured-parse:begin */
    /**
     * A parse failure that carries the source location a person can act on.
     * @param message - what went wrong.
     * @param line - 1-based source line, when known.
     * @param column - 1-based source column, when known.
     * @returns the error to throw.
     */
    function locatedError(message, line, column) {
      const error = new Error(message);
      error.line = line;
      error.column = column;
      return error;
    }

    /**
     * Convert a character offset to a 1-based line and column.
     * @param text - the whole source.
     * @param offset - character offset from the start.
     * @returns the line and column.
     */
    function positionOf(text, offset) {
      let line = 1;
      let column = 1;
      const limit = Math.max(0, Math.min(offset, text.length));
      for (let index = 0; index < limit; index += 1) {
        if (text[index] === '\n') {
          line += 1;
          column = 1;
        } else {
          column += 1;
        }
      }
      return { line, column };
    }

    /**
     * Decode a double-quoted YAML scalar.
     * @param text - the scalar including both quotes.
     * @returns the decoded text.
     */
    function unquoteDouble(text) {
      const body = text.slice(1, -1);
      return body.replace(/\\(u[0-9a-fA-F]{4}|.)/gu, (whole, sequence) => {
        if (sequence[0] === 'u') return String.fromCharCode(parseInt(sequence.slice(1), 16));
        switch (sequence) {
          case 'n': return '\n';
          case 't': return '\t';
          case 'r': return '\r';
          case '0': return '\0';
          case 'b': return '\b';
          case 'f': return '\f';
          default: return sequence;
        }
      });
    }

    /**
     * Resolve one YAML scalar token.
     * @param raw - the scalar text as written.
     * @returns the typed value.
     */
    function yamlScalar(raw) {
      const text = raw.trim();
      if (text === '' || text === '~') return null;
      const lowered = text.toLowerCase();
      if (lowered === 'null') return null;
      if (lowered === 'true') return true;
      if (lowered === 'false') return false;
      if (/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/u.test(text)) return Number(text);
      if (/^0x[0-9a-fA-F]+$/u.test(text)) return parseInt(text.slice(2), 16);
      if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) return unquoteDouble(text);
      if (text.length >= 2 && text.startsWith("'") && text.endsWith("'")) return text.slice(1, -1).replace(/''/gu, "'");
      return text;
    }

    /**
     * Remove a trailing comment that is not inside a quoted scalar.
     * @param text - one line without its indentation.
     * @returns the line without its comment.
     */
    function stripYamlComment(text) {
      let quote;
      for (let index = 0; index < text.length; index += 1) {
        const char = text[index];
        if (quote !== undefined) {
          if (quote === '"' && char === '\\') {
            index += 1;
            continue;
          }
          if (char === quote) quote = undefined;
          continue;
        }
        if (char === '"' || char === "'") {
          quote = char;
          continue;
        }
        if (char === '#' && (index === 0 || /\s/u.test(text[index - 1]))) return text.slice(0, index);
      }
      return text;
    }

    /**
     * Split YAML source into significant lines with their indentation.
     * @param source - the whole document.
     * @returns tokens with indent, trimmed content, and source coordinates.
     */
    function tokenizeYaml(source) {
      const rows = source.split(/\r\n|\r|\n/u);
      const tokens = [];
      for (let index = 0; index < rows.length; index += 1) {
        const raw = rows[index];
        if (/^[ \t]*$/u.test(raw)) continue;
        const lead = /^[ \t]*/u.exec(raw)[0];
        const rest = raw.slice(lead.length);
        if (rest.startsWith('#')) continue;
        if (/^---[ \t]*$/u.test(rest) || /^\.\.\.[ \t]*$/u.test(rest)) continue;
        let indent = 0;
        for (const char of lead) indent += char === '\t' ? 2 : 1;
        tokens.push({
          indent,
          content: stripYamlComment(rest).replace(/[ \t]+$/u, ''),
          line: index + 1,
          column: lead.length + 1,
          row: index
        });
      }
      return tokens;
    }
    /**
     * Find the `:` that separates a mapping key from its value.
     * @param text - one line without indentation.
     * @returns its index, or -1 when the line is not a mapping entry.
     */
    function findKeySeparator(text) {
      let quote;
      let depth = 0;
      for (let index = 0; index < text.length; index += 1) {
        const char = text[index];
        if (quote !== undefined) {
          if (quote === '"' && char === '\\') {
            index += 1;
            continue;
          }
          if (char === quote) quote = undefined;
          continue;
        }
        if (char === '"' || char === "'") {
          quote = char;
          continue;
        }
        if (char === '[' || char === '{') depth += 1;
        else if (char === ']' || char === '}') depth = Math.max(0, depth - 1);
        else if (char === ':' && depth === 0 && (index === text.length - 1 || /\s/u.test(text[index + 1]))) return index;
      }
      return -1;
    }

    /**
     * Parse a YAML flow collection such as `[a, b]` or `{k: v}`.
     * @param text - text starting at the opening bracket.
     * @param start - index of the opening bracket.
     * @param line - source line of that index.
     * @param column - source column of that index.
     * @returns the parsed value.
     */
    function parseYamlFlow(text, start, line, column) {
      let index = start;
      const current = () => text[index];
      const skipSpaces = () => {
        while (index < text.length && /[ \t\r\n]/u.test(text[index])) index += 1;
      };
      const fail = (message) => {
        throw locatedError(message, line, column + (index - start));
      };
      function parseQuoted() {
        const quote = current();
        let out = '';
        index += 1;
        while (index < text.length) {
          const char = text[index];
          if (quote === '"' && char === '\\') {
            const next = text[index + 1];
            if (next === 'u') {
              out += String.fromCharCode(parseInt(text.slice(index + 2, index + 6), 16));
              index += 6;
              continue;
            }
            out += next === 'n' ? '\n' : next === 't' ? '\t' : next === 'r' ? '\r' : next;
            index += 2;
            continue;
          }
          if (char === quote) {
            if (quote === "'" && text[index + 1] === "'") {
              out += "'";
              index += 2;
              continue;
            }
            index += 1;
            return out;
          }
          out += char;
          index += 1;
        }
        fail('Unterminated quoted scalar');
      }
      function parsePlain() {
        const from = index;
        while (index < text.length && !',]}'.includes(text[index])) index += 1;
        return yamlScalar(text.slice(from, index));
      }
      function parseValue() {
        skipSpaces();
        const char = current();
        if (char === '[') return parseSequence();
        if (char === '{') return parseMapping();
        if (char === '"' || char === "'") return parseQuoted();
        return parsePlain();
      }
      function parseSequence() {
        index += 1;
        const out = [];
        skipSpaces();
        if (current() === ']') {
          index += 1;
          return out;
        }
        while (index < text.length) {
          out.push(parseValue());
          skipSpaces();
          const char = current();
          if (char === ',') {
            index += 1;
            continue;
          }
          if (char === ']') {
            index += 1;
            return out;
          }
          fail('Expected "," or "]" in a flow sequence');
        }
        fail('Unterminated flow sequence');
      }
      function parseMapping() {
        index += 1;
        const out = {};
        skipSpaces();
        if (current() === '}') {
          index += 1;
          return out;
        }
        while (index < text.length) {
          skipSpaces();
          let key;
          if (current() === '"' || current() === "'") {
            key = String(parseQuoted());
          } else {
            const from = index;
            while (index < text.length && !':}'.includes(text[index])) index += 1;
            key = text.slice(from, index).trim();
          }
          skipSpaces();
          if (current() !== ':') fail('Expected ":" in a flow mapping');
          index += 1;
          out[key] = parseValue();
          skipSpaces();
          const char = current();
          if (char === ',') {
            index += 1;
            continue;
          }
          if (char === '}') {
            index += 1;
            return out;
          }
          fail('Expected "," or "}" in a flow mapping');
        }
        fail('Unterminated flow mapping');
      }
      return parseValue();
    }
    /**
     * Parse a YAML document: block mappings, block sequences, flow collections,
     * quoted and plain scalars, comments, and block scalars. A failure reports the
     * line and column a person should look at.
     * @param text - the document.
     * @returns `{ ok: true, value }` or `{ ok: false, message, line, column }`.
     */
    function parseYamlDocument(text) {
      const source = String(text ?? '');
      try {
        const rows = source.split(/\r\n|\r|\n/u);
        const tokens = tokenizeYaml(source);
        let cursor = 0;
        const failAt = (token, message) => locatedError(
          message,
          token === undefined ? 1 : token.line,
          token === undefined ? 1 : token.column
        );
        const isSequenceToken = (token) => token.content === '-' || token.content.startsWith('- ');

        function consumeBlockScalar(token, style) {
          let endRow = token.row;
          let probe = token.row + 1;
          while (probe < rows.length) {
            const rowText = rows[probe];
            if (/^[ \t]*$/u.test(rowText)) {
              probe += 1;
              continue;
            }
            const lead = /^[ \t]*/u.exec(rowText)[0];
            let indent = 0;
            for (const char of lead) indent += char === '\t' ? 2 : 1;
            if (indent <= token.indent) break;
            endRow = probe;
            probe += 1;
          }
          const blockRows = rows.slice(token.row + 1, endRow + 1);
          const widths = blockRows
            .filter((rowText) => !/^[ \t]*$/u.test(rowText))
            .map((rowText) => /^[ \t]*/u.exec(rowText)[0].length);
          const width = widths.length === 0 ? 0 : Math.min.apply(null, widths);
          const stripped = blockRows.map((rowText) => (/^[ \t]*$/u.test(rowText) ? '' : rowText.slice(width)));
          while (cursor < tokens.length && tokens[cursor].row <= endRow) cursor += 1;
          if (style === '>') return stripped.join(' ').replace(/[ \t]+/gu, ' ').trim();
          return stripped.join('\n').replace(/\n+$/u, '');
        }

        function parseScalarLine(content, token, offset) {
          const trimmed = content.trim();
          if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
            return parseYamlFlow(trimmed, 0, token.line, token.column + offset);
          }
          return yamlScalar(trimmed);
        }

        function parseMapping(indent) {
          const out = {};
          while (cursor < tokens.length) {
            const token = tokens[cursor];
            if (token.indent !== indent || isSequenceToken(token)) break;
            const separator = findKeySeparator(token.content);
            if (separator === -1) throw failAt(token, 'Expected "key: value" in a mapping');
            const rawKey = token.content.slice(0, separator).trim();
            if (rawKey === '') throw failAt(token, 'Empty mapping key');
            const key = rawKey.startsWith('"') || rawKey.startsWith("'") ? String(yamlScalar(rawKey)) : rawKey;
            const after = token.content.slice(separator + 1).trim();
            cursor += 1;
            if (after === '') {
              const next = tokens[cursor];
              out[key] = next !== undefined && next.indent > indent ? parseBlock(next.indent) : null;
              continue;
            }
            if (after === '|' || after === '|-' || after === '|+' || after === '>' || after === '>-' || after === '>+') {
              out[key] = consumeBlockScalar(token, after[0]);
              continue;
            }
            out[key] = parseScalarLine(after, token, separator + 1);
          }
          return out;
        }

        function parseSequence(indent) {
          const out = [];
          while (cursor < tokens.length) {
            const token = tokens[cursor];
            if (token.indent !== indent || !isSequenceToken(token)) break;
            const rest = token.content.slice(1).trim();
            if (rest === '') {
              cursor += 1;
              const next = tokens[cursor];
              out.push(next !== undefined && next.indent > indent ? parseBlock(next.indent) : null);
              continue;
            }
            if (rest === '-' || rest.startsWith('- ')) {
              tokens[cursor] = { indent: indent + 2, content: rest, line: token.line, column: token.column + 2, row: token.row };
              out.push(parseSequence(indent + 2));
              continue;
            }
            if (findKeySeparator(rest) !== -1) {
              tokens[cursor] = { indent: indent + 2, content: rest, line: token.line, column: token.column + 2, row: token.row };
              out.push(parseMapping(indent + 2));
              continue;
            }
            out.push(parseScalarLine(rest, token, 1));
            cursor += 1;
          }
          return out;
        }

        function parseBlock(indent) {
          const token = tokens[cursor];
          if (token === undefined) return null;
          return isSequenceToken(token) ? parseSequence(indent) : parseMapping(indent);
        }

        if (tokens.length === 0) return { ok: true, value: null };
        const value = parseBlock(tokens[0].indent);
        if (cursor < tokens.length) throw failAt(tokens[cursor], 'Unexpected indentation');
        return { ok: true, value };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          ok: false,
          message,
          line: error !== null && typeof error === 'object' && typeof error.line === 'number' ? error.line : undefined,
          column: error !== null && typeof error === 'object' && typeof error.column === 'number' ? error.column : undefined
        };
      }
    }

    /**
     * Walk JSON syntax and report the first offset that cannot be valid.
     * Engines phrase and truncate their own messages differently, so the location
     * a person needs comes from this scan rather than from the thrown error.
     * @param text - the document.
     * @returns the offset, or undefined when the text scans as valid JSON.
     */
    function findJsonErrorOffset(text) {
      let index = 0;
      let failure;
      const failAt = (offset, message) => {
        throw locatedError(message, positionOf(text, offset).line, positionOf(text, offset).column);
      };
      const skipWhitespace = () => {
        while (index < text.length && ' \t\r\n'.includes(text[index])) index += 1;
      };
      function scanString() {
        const opening = index;
        index += 1;
        while (index < text.length) {
          const char = text[index];
          if (char === '"') {
            index += 1;
            return;
          }
          if (char === '\\') {
            const next = text[index + 1];
            if (next === undefined) failAt(opening, 'Unterminated string');
            if (next === 'u') {
              if (!/^[0-9a-fA-F]{4}$/u.test(text.slice(index + 2, index + 6))) failAt(index, 'Invalid \\u escape');
              index += 6;
              continue;
            }
            if (!'"\\/bfnrt'.includes(next)) failAt(index, 'Invalid escape sequence');
            index += 2;
            continue;
          }
          if (char === '\n') failAt(opening, 'Unterminated string');
          index += 1;
        }
        failAt(opening, 'Unterminated string');
      }
      function scanNumber() {
        const rest = text.slice(index);
        const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u.exec(rest);
        if (match === null || match[0] === '') failAt(index, 'Invalid number');
        index += match[0].length;
      }
      function scanValue() {
        skipWhitespace();
        const char = text[index];
        if (char === undefined) failAt(index, 'Unexpected end of input');
        if (char === '{') return scanObject();
        if (char === '[') return scanArray();
        if (char === '"') return scanString();
        if (char === '-' || (char >= '0' && char <= '9')) return scanNumber();
        if (text.startsWith('true', index)) {
          index += 4;
          return;
        }
        if (text.startsWith('false', index)) {
          index += 5;
          return;
        }
        if (text.startsWith('null', index)) {
          index += 4;
          return;
        }
        return failAt(index, 'Unexpected token ' + JSON.stringify(char));
      }
      function scanObject() {
        index += 1;
        skipWhitespace();
        if (text[index] === '}') {
          index += 1;
          return;
        }
        while (index < text.length) {
          skipWhitespace();
          if (text[index] !== '"') failAt(index, 'Expected a property name in double quotes');
          scanString();
          skipWhitespace();
          if (text[index] !== ':') failAt(index, 'Expected ":" after a property name');
          index += 1;
          scanValue();
          skipWhitespace();
          const char = text[index];
          if (char === ',') {
            index += 1;
            skipWhitespace();
            if (text[index] === '}') failAt(index, 'Trailing comma before "}"');
            continue;
          }
          if (char === '}') {
            index += 1;
            return;
          }
          failAt(index, 'Expected "," or "}"');
        }
        failAt(index, 'Unterminated object');
      }
      function scanArray() {
        index += 1;
        skipWhitespace();
        if (text[index] === ']') {
          index += 1;
          return;
        }
        while (index < text.length) {
          scanValue();
          skipWhitespace();
          const char = text[index];
          if (char === ',') {
            index += 1;
            skipWhitespace();
            if (text[index] === ']') failAt(index, 'Trailing comma before "]"');
            continue;
          }
          if (char === ']') {
            index += 1;
            return;
          }
          failAt(index, 'Expected "," or "]"');
        }
        failAt(index, 'Unterminated array');
      }
      try {
        scanValue();
        skipWhitespace();
        if (index < text.length) failAt(index, 'Unexpected content after the top-level value');
        return undefined;
      } catch (error) {
        if (error !== null && typeof error === 'object' && typeof error.line === 'number') {
          failure = error;
          return error;
        }
        throw error;
      }
    }

    /**
     * Parse JSON and report the line and column of the first invalid character.
     * @param text - the document.
     * @returns `{ ok: true, value }` or `{ ok: false, message, line, column }`.
     */
    function parseJsonDocument(text) {
      const source = String(text ?? '');
      try {
        return { ok: true, value: JSON.parse(source) };
      } catch (engineError) {
        const engineMessage = engineError instanceof Error ? engineError.message : String(engineError);
        let scanned;
        try {
          scanned = findJsonErrorOffset(source);
        } catch {
          scanned = undefined;
        }
        if (scanned !== undefined && typeof scanned.line === 'number') {
          return { ok: false, message: scanned.message, line: scanned.line, column: scanned.column };
        }
        const match = /position\s+(\d+)/iu.exec(engineMessage);
        if (match === null) return { ok: false, message: engineMessage };
        const located = positionOf(source, Number(match[1]));
        return { ok: false, message: engineMessage, line: located.line, column: located.column };
      }
    }
    /* @structured-parse:end */
    /**
     * Escape source text before placing it in an inline script as JSON.
     * @param value - already truncated LaTeX source.
     * @returns a script-safe JSON literal.
     */
    function jsonForScript(value) {
      return JSON.stringify(value)
        .replace(/</gu, '\\u003c')
        .replace(/>/gu, '\\u003e')
        .replace(/\u2028/gu, '\\u2028')
        .replace(/\u2029/gu, '\\u2029');
    }

    /**
     * Build a self-contained KaTeX frame. KaTeX arrives from a pinned CDN inside a
     * sandboxed iframe, so nothing joins the application origin; the frame renders
     * after its own load event, and an offline frame states the reason instead of
     * failing silently.
     * @param source - LaTeX source, already size-capped.
     * @returns the data URL of the preview document.
     */
    function katexFrameUrl(source) {
      const payload = jsonForScript(source);
      const html = '<!doctype html><html><head><meta charset="utf-8">' +
        '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">' +
        '<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"><\/script>' +
        '<style>html,body{margin:0;height:100%;box-sizing:border-box;padding:16px;' +
        'background:transparent;color:inherit;font-family:system-ui,sans-serif}' +
        '.doc{white-space:pre-wrap;word-break:break-word;line-height:1.6;font-size:14px}' +
        '.display{overflow-x:auto;overflow-y:hidden;padding:8px 0}' +
        '.note{color:#b26a00;font-size:12px;white-space:pre-wrap}' +
        '.err{color:#c62828;font-size:13px;white-space:pre-wrap}</style></head><body>' +
        '<div class="doc" id="out"></div>' +
        '<script id="payload" type="application/json">' + payload + '<\/script>' +
        '<script>(function(){var done=false;' +
        'function note(text){var out=document.getElementById("out");if(!out)return;out.textContent="";' +
        'var n=document.createElement("div");n.className="note";n.textContent=text;out.appendChild(n)}' +
        'function render(){if(done)return;done=true;var out=document.getElementById("out");' +
        'if(!window.katex){note("KaTeX unavailable: the preview needs network access to cdn.jsdelivr.net.");return}' +
        'var src;try{src=JSON.parse(document.getElementById("payload").textContent)}catch(e){note("Invalid payload.");return}' +
        'try{var rendered=window.katex.renderToString(src,{displayMode:true,throwOnError:false,strict:false,trust:false,output:"html"});' +
        'out.textContent="";var wrap=document.createElement("div");wrap.className="display";wrap.innerHTML=rendered;out.appendChild(wrap)}' +
        'catch(e){out.textContent="";var d=document.createElement("div");d.className="err";' +
        'd.textContent=String(e&&e.message||e);out.appendChild(d)}}' +
        'if(document.readyState==="complete")render();' +
        'else window.addEventListener("load",render,{once:true});' +
        'setTimeout(function(){if(!done)render()},5000)})();<\/script>' +
        '</body></html>';
      return 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
    }

    /**
     * Cap LaTeX source so one huge file cannot stall the frame.
     * @param text - accumulated plain text.
     * @returns capped LaTeX source.
     */
    function mathSourceOf(text) {
      const trimmed = String(text ?? '').trim();
      if (trimmed === '') return '';
      return trimmed.slice(0, 20000);
    }

    function StatusLine({ t, message }) {
      return h('div', { className: 'universalPreview-status', role: 'alert' }, t(message));
    }

    /**
     * Create a Blob URL for media bytes and revoke it on change or unmount.
     * @param data - complete file bytes, or undefined while loading.
     * @param mediaType - the container's media type.
     * @returns the object URL and whether creation failed.
     */
    function useMediaUrl(data, mediaType) {
      const [source, setSource] = React.useState(undefined);
      const [failed, setFailed] = React.useState(false);
      React.useEffect(() => {
        if (data === undefined) return undefined;
        let objectUrl;
        try {
          objectUrl = URL.createObjectURL(new Blob([data], { type: mediaType }));
        } catch {
          setFailed(true);
          return undefined;
        }
        setSource(objectUrl);
        setFailed(false);
        return () => { URL.revokeObjectURL(objectUrl); };
      }, [data, mediaType]);
      return { source, failed };
    }

    function VideoBody(props) {
      const { content, resourceAddress, t } = props;
      const name = fileNameOf(resourceAddress);
      const data = content && content.kind === 'bytes' ? content.data : undefined;
      const mediaType = VIDEO_MEDIA_TYPES[suffixOf(resourceAddress)] || 'video/mp4';
      const { source, failed } = useMediaUrl(data, mediaType);

      if (data === undefined) return h(StatusLine, { t, message: 'unsupportedVideo' });
      if (failed) return h(StatusLine, { t, message: 'videoFailed' });
      if (source === undefined) {
        return h('div', { className: 'universalPreview-status', role: 'status' }, t('loading'));
      }
      return h('div', { className: 'universalPreview-video' },
        h('video', {
          key: source,
          className: 'universalPreview-media-el',
          src: source,
          controls: true,
          preload: 'metadata',
          playsInline: true,
          'aria-label': t('videoPreview', { name })
        })
      );
    }

    function AudioBody(props) {
      const { content, resourceAddress, t } = props;
      const name = fileNameOf(resourceAddress);
      const data = content && content.kind === 'bytes' ? content.data : undefined;
      const mediaType = AUDIO_MEDIA_TYPES[suffixOf(resourceAddress)] || 'audio/mpeg';
      const { source, failed } = useMediaUrl(data, mediaType);

      if (data === undefined) return h(StatusLine, { t, message: 'unsupportedAudio' });
      if (failed) return h(StatusLine, { t, message: 'audioFailed' });
      if (source === undefined) {
        return h('div', { className: 'universalPreview-status', role: 'status' }, t('loading'));
      }
      return h('div', { className: 'universalPreview-audio' },
        h('div', { className: 'universalPreview-audio-name', title: name }, name),
        h('audio', {
          key: source,
          className: 'universalPreview-media-el universalPreview-audio-el',
          src: source,
          controls: true,
          preload: 'metadata',
          'aria-label': t('audioPreview', { name })
        })
      );
    }

    function LatexBody(props) {
      const { content, resourceAddress, t } = props;
      const name = fileNameOf(resourceAddress);
      const text = content && content.kind === 'text' ? content.text : undefined;
      const source = React.useMemo(() => (text === undefined ? undefined : mathSourceOf(text)), [text]);
      const url = React.useMemo(() => (source ? katexFrameUrl(source) : undefined), [source]);

      if (text === undefined) {
        return h('div', { className: 'universalPreview-status', role: 'status' }, t('loading'));
      }
      if (!source) return h(StatusLine, { t, message: 'latexEmpty' });
      return h('div', { className: 'universalPreview-latex' },
        h('iframe', {
          className: 'universalPreview-latex-frame',
          src: url,
          sandbox: 'allow-scripts',
          title: t('latexPreview', { name }),
          referrerPolicy: 'no-referrer'
        })
      );
    }
    /** Whether a parsed value renders as a branch with children. */
    function isBranch(value) {
      return value !== null && typeof value === 'object';
    }

    /** The short type name shown beside a value. */
    function kindOf(value) {
      if (value === null) return 'null';
      if (Array.isArray(value)) return 'array';
      return typeof value;
    }

    /** One line of text for a leaf value. */
    function scalarText(value) {
      if (typeof value === 'string') {
        return value.length > 160 ? JSON.stringify(value.slice(0, 160)) + '\u2026' : JSON.stringify(value);
      }
      return String(value);
    }

    function TreeChildren({ value, t, depth }) {
      const entries = React.useMemo(() => (Array.isArray(value)
        ? value.map((item, index) => [String(index), item])
        : Object.entries(value)), [value]);
      const [limit, setLimit] = React.useState(200);
      const visible = entries.slice(0, limit);
      const remaining = entries.length - visible.length;
      return h('div', { className: 'upv-tree-children' },
        visible.map(([key, child]) => h(TreeNode, { key, name: key, value: child, t, depth: depth + 1 })),
        remaining > 0
          ? h('button', {
            type: 'button',
            className: 'upv-tree-more',
            onClick: () => setLimit((current) => current + 200)
          }, t('moreItems', { count: Math.min(200, remaining) }))
          : null
      );
    }

    function TreeNode({ name, value, t, depth }) {
      const branch = isBranch(value);
      const [open, setOpen] = React.useState(depth < 2);
      const summary = branch
        ? (Array.isArray(value) ? t('arrayItems', { count: value.length }) : t('objectKeys', { count: Object.keys(value).length }))
        : scalarText(value);
      return h('div', { className: 'upv-tree-node' },
        h('div', { className: branch ? 'upv-tree-row' : 'upv-tree-row upv-tree-row-leaf' },
          branch
            ? h('button', {
              type: 'button',
              className: 'upv-tree-toggle',
              'aria-expanded': open,
              'aria-label': name,
              onClick: () => setOpen(!open)
            }, open ? '\u25be' : '\u25b8')
            : h('span', { className: 'upv-tree-toggle upv-tree-toggle-empty', 'aria-hidden': true }, '\u00b7'),
          h('span', { className: 'upv-tree-key' }, name),
          h('span', { className: 'upv-tree-value' },
            branch ? summary : h('span', { className: 'upv-type-' + kindOf(value) }, summary))
        ),
        branch && open ? h(TreeChildren, { value, t, depth }) : null
      );
    }

    function ParseExcerpt({ text, line }) {
      if (line === undefined) return null;
      const rows = String(text).split(/\r\n|\r|\n/u);
      const from = Math.max(1, line - 3);
      const to = Math.min(rows.length, line + 3);
      const lines = [];
      for (let number = from; number <= to; number += 1) {
        lines.push(h('div', {
          key: String(number),
          className: number === line ? 'upv-excerpt-row upv-excerpt-row-error' : 'upv-excerpt-row'
        },
        h('span', { className: 'upv-excerpt-number' }, String(number)),
        h('span', { className: 'upv-excerpt-text' }, rows[number - 1] ?? '')
        ));
      }
      return h('div', { className: 'upv-excerpt' }, lines);
    }

    /**
     * Build the structured body for one document syntax.
     * @param kind - `json` or `yaml`; selects the parser and the labels.
     * @returns the document body component.
     */
    function makeStructuredBody(kind) {
      return function StructuredBody(props) {
        const { content, t } = props;
        const text = content && content.kind === 'text' ? content.text : undefined;
        const [mode, setMode] = React.useState('tree');
        const parsed = React.useMemo(() => {
          if (text === undefined) return undefined;
          return kind === 'json' ? parseJsonDocument(text) : parseYamlDocument(text);
        }, [text]);

        if (text === undefined) {
          return h('div', { className: 'universalPreview-status', role: 'status' }, t('loading'));
        }
        const label = kind.toUpperCase();
        const toolbar = h('div', { className: 'upv-toolbar' },
          h('button', {
            type: 'button',
            className: mode === 'tree' ? 'upv-chip upv-chip-active' : 'upv-chip',
            onClick: () => setMode('tree'),
            'aria-pressed': mode === 'tree'
          }, t('treeView')),
          h('button', {
            type: 'button',
            className: mode === 'raw' ? 'upv-chip upv-chip-active' : 'upv-chip',
            onClick: () => setMode('raw'),
            'aria-pressed': mode === 'raw'
          }, t('rawView')),
          parsed !== undefined && parsed.ok ? h('span', { className: 'upv-hint' }, t('parsedOk', { kind: label })) : null
        );

        if (text.trim() === '') {
          return h('div', { className: 'upv-structured' }, toolbar,
            h('div', { className: 'universalPreview-status' }, t('emptyDocument')));
        }
        if (mode === 'raw' || parsed === undefined) {
          return h('div', { className: 'upv-structured' }, toolbar,
            h('pre', { className: 'upv-raw' }, text));
        }
        if (!parsed.ok) {
          return h('div', { className: 'upv-structured' }, toolbar,
            h('div', { className: 'upv-error', role: 'alert' },
              h('div', { className: 'upv-error-title' }, t('parseError', { kind: label })),
              h('div', { className: 'upv-error-message' }, parsed.message),
              parsed.line === undefined
                ? null
                : h('div', { className: 'upv-error-position' }, t('parseErrorAt', { line: parsed.line, column: parsed.column ?? 1 }))
            ),
            h(ParseExcerpt, { text, line: parsed.line }));
        }
        return h('div', { className: 'upv-structured' }, toolbar,
          h('div', { className: 'upv-tree' }, h(TreeNode, { name: t('rootName'), value: parsed.value, t, depth: 0 })));
      };
    }

    const VIDEO_ID = PACKAGE_ID + '/video';
    const AUDIO_ID = PACKAGE_ID + '/audio';
    const LATEX_ID = PACKAGE_ID + '/latex';
    const JSON_ID = PACKAGE_ID + '/json';
    const YAML_ID = PACKAGE_ID + '/yaml';
    const CSS = '.universalPreview-status{box-sizing:border-box;width:100%;min-height:160px;display:flex;align-items:center;justify-content:center;padding:16px;text-align:center;color:var(--dsw-alias-label-secondary);font-family:var(--dsw-font,sans-serif);font-size:13px;line-height:1.5;white-space:normal}.universalPreview-video{box-sizing:border-box;width:100%;height:100%;min-height:160px;display:flex;align-items:center;justify-content:center;padding:12px}.universalPreview-media-el{max-width:100%;max-height:100%;width:auto;height:auto;outline:none;border-radius:var(--dsw-radius-md,8px);background:#000}.universalPreview-audio{box-sizing:border-box;width:100%;min-height:160px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:24px 16px}.universalPreview-audio-name{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary);font-family:var(--dsw-font,sans-serif);font-size:13px}.universalPreview-audio-el{width:100%;max-width:520px;background:transparent}.universalPreview-latex{box-sizing:border-box;width:100%;height:100%;min-height:160px;padding:12px}.universalPreview-latex-frame{width:100%;height:100%;border:0;background:transparent;border-radius:var(--dsw-radius-md,8px)}.upv-structured{box-sizing:border-box;display:flex;flex-direction:column;height:100%;min-height:100%;font-family:var(--dsw-font-mono,ui-monospace,monospace);font-size:var(--dsh-content-font-size-secondary,13px);color:var(--dsw-alias-label-primary)}.upv-toolbar{flex:none;display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:.5px solid var(--dsw-alias-border-l3);font-family:var(--dsw-font,sans-serif)}.upv-chip{appearance:none;border:.5px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);border-radius:999px;padding:2px 10px;font-size:12px;line-height:18px;cursor:pointer}.upv-chip:hover{background:var(--dsw-alias-interactive-bg-hover)}.upv-chip-active{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2)}.upv-hint{color:var(--dsw-alias-label-tertiary);font-size:12px}.upv-raw{margin:0;padding:12px;white-space:pre;overflow:auto;flex:auto;line-height:1.6}.upv-tree{flex:auto;overflow:auto;padding:8px 12px 16px;line-height:1.7}.upv-tree-children{border-left:.5px solid var(--dsw-alias-border-l3);margin-left:6px;padding-left:10px}.upv-tree-row{display:flex;align-items:baseline;gap:6px;white-space:pre-wrap;word-break:break-word}.upv-tree-toggle{appearance:none;border:0;background:transparent;color:var(--dsw-alias-label-secondary);width:16px;flex:none;cursor:pointer;padding:0;font-size:11px;line-height:1.4}.upv-tree-toggle-empty{cursor:default;text-align:center}.upv-tree-key{color:var(--dsw-alias-label-secondary);flex:none}.upv-tree-value{min-width:0;word-break:break-word}.upv-type-string{color:var(--dsw-alias-state-success-label,#2e7d32)}.upv-type-number{color:var(--dsw-alias-state-info-label,#1565c0)}.upv-type-boolean{color:var(--dsw-alias-state-warn-label,#b26a00)}.upv-type-null{color:var(--dsw-alias-label-tertiary);font-style:italic}.upv-tree-more{appearance:none;border:0;background:transparent;color:var(--dsw-alias-label-secondary);padding:2px 0;font-size:12px;cursor:pointer;text-decoration:underline}.upv-error{flex:none;margin:12px;padding:10px 12px;border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-state-error-tertiary,rgba(198,40,40,.1));color:var(--dsw-alias-label-primary);font-family:var(--dsw-font,sans-serif)}.upv-error-title{font-weight:600;margin-bottom:4px}.upv-error-message{word-break:break-word}.upv-error-position{color:var(--dsw-alias-label-secondary);font-size:12px;margin-top:4px}.upv-excerpt{flex:auto;overflow:auto;padding:0 0 16px;font-size:12px}.upv-excerpt-row{display:flex;gap:12px;padding:0 12px;white-space:pre;line-height:1.7}.upv-excerpt-row-error{background:var(--dsw-alias-state-error-tertiary,rgba(198,40,40,.14))}.upv-excerpt-number{flex:none;width:44px;text-align:right;color:var(--dsw-alias-label-tertiary);user-select:none}.upv-excerpt-text{white-space:pre}';

    /** Register a binary renderer and its keyed body with the document preview. */
    function registerBinary(ctx, t, id, types, titleKey, Body, label) {
      ctx.effect(() => ctx.documentPreviews.register({
        id,
        extensions: Object.keys(types),
        binaryExtensions: Object.keys(types),
        priority: 'extension',
        title: () => t(titleKey),
        loading: 'bytes-complete',
        wrap: false
      }), label + ': metadata');
      ctx.effect(() => ctx.slots.inject('sidebar.right.tab.document', () => ctx.slots.register({
        name: 'sidebar.right.tab.document',
        key: id,
        locale: NS
      }, Body)), label + ': body');
    }

    /** Register a paged-text renderer and its keyed body with the document preview. */
    function registerText(ctx, t, id, extensions, titleKey, Body, label) {
      ctx.effect(() => ctx.documentPreviews.register({
        id,
        extensions,
        priority: 'extension',
        title: () => t(titleKey),
        loading: 'text-pages',
        wrap: true
      }), label + ': metadata');
      ctx.effect(() => ctx.slots.inject('sidebar.right.tab.document', () => ctx.slots.register({
        name: 'sidebar.right.tab.document',
        key: id,
        locale: NS
      }, Body)), label + ': body');
    }

    return {
      inject: ['slots', 'locale', 'documentPreviews'],
      apply(ctx) {
        const t = ctx.locale.bind(NS);
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'universal-preview: dictionaries');
        ctx.effect(() => {
          if (typeof document === 'undefined') return undefined;
          if (document.querySelector('style[data-plugin-css="universal-preview"]') !== null) return undefined;
          const tag = document.createElement('style');
          tag.dataset.plugin = PACKAGE_ID;
          tag.dataset.pluginCss = 'universal-preview';
          tag.textContent = CSS;
          document.head.appendChild(tag);
          return () => { tag.remove(); };
        }, 'universal-preview: styles');

        registerBinary(ctx, t, VIDEO_ID, VIDEO_MEDIA_TYPES, 'title', VideoBody, 'universal-preview: video');
        registerBinary(ctx, t, AUDIO_ID, AUDIO_MEDIA_TYPES, 'audioTitle', AudioBody, 'universal-preview: audio');
        registerText(ctx, t, LATEX_ID, LATEX_EXTENSIONS, 'latexTitle', LatexBody, 'universal-preview: latex');
        registerText(ctx, t, JSON_ID, ['json'], 'jsonTitle', makeStructuredBody('json'), 'universal-preview: json');
        registerText(ctx, t, YAML_ID, ['yaml', 'yml'], 'yamlTitle', makeStructuredBody('yaml'), 'universal-preview: yaml');
      }
    };
  }
});