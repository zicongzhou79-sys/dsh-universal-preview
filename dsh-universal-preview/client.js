window.__ModuleLoader__.load({
  id: '@local/dsh-universal-preview',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /** Copy owned by this package; the host locale service binds these dictionaries. */
    const NS = 'universalPreview';
    const zh = {
      title: '视频',
      latexTitle: 'LaTeX',
      videoPreview: '视频预览：{name}',
      loading: '正在加载…',
      unsupportedVideo: '视频预览需要完整文件内容',
      videoFailed: '无法播放此视频，或当前环境不支持该编码格式',
      latexPreview: 'LaTeX 预览：{name}',
      latexEmpty: '这个 LaTeX 文件为空',
      mathPreview: '公式预览：{name}',
      mathInvalid: '未找到可渲染的数学内容'
    };
    const en = {
      title: 'Video',
      latexTitle: 'LaTeX',
      videoPreview: 'Video preview: {name}',
      loading: 'Loading…',
      unsupportedVideo: 'Video preview requires the complete file contents.',
      videoFailed: 'This video cannot play here, or its codec is unsupported in this environment.',
      latexPreview: 'LaTeX preview: {name}',
      latexEmpty: 'This LaTeX file is empty.',
      mathPreview: 'Formula preview: {name}',
      mathInvalid: 'No renderable math content was found.'
    };

    /** Container suffixes and media types claimed by the video renderer. */
    const VIDEO_MEDIA_TYPES = {
      mp4: 'video/mp4',
      m4v: 'video/mp4',
      webm: 'video/webm',
      ogv: 'video/ogg'
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
     * sandboxed iframe, so nothing joins the application origin and no bundler is
     * needed; an offline frame shows an explicit message instead of failing silently.
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
     * Keep the first non-empty line when it is a math delimiter, so a `.tex` file
     * that contains a single formula still renders, and cap the payload size.
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

    function VideoBody(props) {
      const { content, resourceAddress, t } = props;
      const name = fileNameOf(resourceAddress);
      const data = content && content.kind === 'bytes' ? content.data : undefined;
      const mediaType = VIDEO_MEDIA_TYPES[suffixOf(resourceAddress)] || 'video/mp4';
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

      if (data === undefined) return h(StatusLine, { t, message: 'unsupportedVideo' });
      if (failed) return h(StatusLine, { t, message: 'videoFailed' });
      if (source === undefined) {
        return h('div', { className: 'universalPreview-status', role: 'status' }, t('loading'));
      }
      return h('div', { className: 'universalPreview-video' },
        h('video', {
          key: source,
          className: 'universalPreview-video-el',
          src: source,
          controls: true,
          preload: 'metadata',
          playsInline: true,
          'aria-label': t('videoPreview', { name }),
          onError: () => setFailed(true)
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

    const VIDEO_ID = '@local/dsh-universal-preview/video';
    const LATEX_ID = '@local/dsh-universal-preview/latex';

    const CSS = '.universalPreview-status{box-sizing:border-box;width:100%;min-height:160px;display:flex;align-items:center;justify-content:center;padding:16px;text-align:center;color:var(--dsw-alias-label-secondary);font-family:var(--dsw-font,sans-serif);font-size:13px;line-height:1.5;white-space:normal}.universalPreview-video{box-sizing:border-box;width:100%;height:100%;min-height:160px;display:flex;align-items:center;justify-content:center;padding:12px}.universalPreview-video-el{max-width:100%;max-height:100%;width:auto;height:auto;outline:none;border-radius:var(--dsw-radius-md,8px);background:#000}.universalPreview-latex{box-sizing:border-box;width:100%;height:100%;min-height:160px;padding:12px}.universalPreview-latex-frame{width:100%;height:100%;border:0;background:transparent;border-radius:var(--dsw-radius-md,8px)}';

    return {
      inject: ['slots', 'locale', 'documentPreviews'],
      apply(ctx) {
        const t = ctx.locale.bind(NS);
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'universal-preview: dictionaries');
        ctx.effect(() => {
          if (typeof document === 'undefined') return undefined;
          const existing = document.querySelector('style[data-plugin-css="universal-preview"]');
          if (existing !== null) return undefined;
          const tag = document.createElement('style');
          tag.dataset.plugin = '@local/dsh-universal-preview';
          tag.dataset.pluginCss = 'universal-preview';
          tag.textContent = CSS;
          document.head.appendChild(tag);
          return () => { tag.remove(); };
        }, 'universal-preview: styles');

        ctx.effect(() => ctx.documentPreviews.register({
          id: VIDEO_ID,
          extensions: Object.keys(VIDEO_MEDIA_TYPES),
          binaryExtensions: Object.keys(VIDEO_MEDIA_TYPES),
          priority: 'extension',
          title: () => t('title'),
          loading: 'bytes-complete',
          wrap: false
        }), 'universal-preview: video metadata');

        ctx.effect(() => ctx.documentPreviews.register({
          id: LATEX_ID,
          extensions: LATEX_EXTENSIONS,
          priority: 'extension',
          title: () => t('latexTitle'),
          loading: 'text-pages',
          wrap: true
        }), 'universal-preview: latex metadata');

        ctx.effect(() => ctx.slots.inject('sidebar.right.tab.document', () => ctx.slots.register({
          name: 'sidebar.right.tab.document',
          key: VIDEO_ID,
          locale: NS
        }, VideoBody)), 'universal-preview: video body');

        ctx.effect(() => ctx.slots.inject('sidebar.right.tab.document', () => ctx.slots.register({
          name: 'sidebar.right.tab.document',
          key: LATEX_ID,
          locale: NS
        }, LatexBody)), 'universal-preview: latex body');
      }
    };
  }
});
