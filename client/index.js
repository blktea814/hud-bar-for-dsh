/**
 * hud-floating-bar — Client half (browser bundle)
 *
 * Registered through the official client module channel
 * (window.__ModuleLoader__.load). Talks to the Host half over same-origin
 * JSON endpoints (/hud-api/*) instead of the dynamic-plugin host.call bridge.
 */
window.__ModuleLoader__.load({
  id: 'hud-floating-bar',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    var React = require('react')

    // ---------- 样式 ----------
    var HUD_CSS = [
      '.hudflt-bar{position:fixed;z-index:2147483000;display:flex;flex-direction:column;border-radius:14px;background:rgba(15,17,26,0.92);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(148,163,184,0.18);box-shadow:0 12px 40px rgba(0,0,0,0.45);color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,Microsoft YaHei,sans-serif;font-size:13px;overflow:hidden;pointer-events:auto;animation:hudflt-in 0.18s ease-out}',
      '@keyframes hudflt-in{from{opacity:0;transform:translateY(-6px) scale(0.98)}to{opacity:1;transform:none}}',
      '.hudflt-header{display:flex;align-items:center;gap:6px;padding:8px 10px;background:rgba(255,255,255,0.05);border-bottom:1px solid rgba(255,255,255,0.08);cursor:grab;user-select:none}.hudflt-header:active{cursor:grabbing}',
      '.hudflt-controls{display:flex;gap:6px;padding:6px 10px;border-bottom:1px solid rgba(255,255,255,0.08);flex-wrap:wrap}',
      '.hudflt-dot{width:8px;height:8px;border-radius:50%;background:#22c55e;flex:none}.hudflt-dot.hudflt-running{background:#f59e0b;animation:hudflt-pulse 1.2s ease-in-out infinite}',
      '@keyframes hudflt-pulse{0%,100%{opacity:1}50%{opacity:0.35}}',
      '.hudflt-title{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600}',
      '.hudflt-session-picker{max-width:110px;background:rgba(255,255,255,0.08);color:#e2e8f0;border:1px solid rgba(255,255,255,0.14);border-radius:6px;font-size:12px;padding:2px 4px;outline:none;cursor:pointer}.hudflt-control{flex:1;min-width:0;max-width:none}.hudflt-control-wide{flex:1.6}',
      '.hudflt-btn{background:transparent;color:#94a3b8;border:1px solid transparent;border-radius:6px;padding:2px 7px;font-size:13px;line-height:1.4;cursor:pointer}.hudflt-btn:hover{background:rgba(255,255,255,0.1);color:#e2e8f0}.hudflt-btn-on{color:#818cf8}.hudflt-btn-close:hover{background:rgba(239,68,68,0.25);color:#fca5a5}',
      '.hudflt-body{flex:1;display:flex;flex-direction:column;min-height:0}',
      '.hudflt-scroll{flex:1;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:8px;scrollbar-width:thin}',
      '.hudflt-empty{color:#64748b;text-align:center;padding:24px 8px;font-size:12px}',
      '.hudflt-bubble{max-width:92%;padding:8px 10px;border-radius:10px;white-space:normal;word-break:break-word;line-height:1.55}',
      '.hudflt-user{align-self:flex-end;background:rgba(99,102,241,0.28);border:1px solid rgba(129,140,248,0.4)}',
      '.hudflt-assistant,.hudflt-stream{align-self:flex-start;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.09)}',
      '.hudflt-stream::after{content:\'\u258d\';color:#818cf8;animation:hudflt-blink 0.9s steps(2) infinite;margin-left:1px}',
      '@keyframes hudflt-blink{0%{opacity:1}50%{opacity:0}}',
      '.hudflt-tool{align-self:flex-start;background:rgba(30,41,59,0.5);border:1px dashed rgba(148,163,184,0.3);font-size:12px;color:#94a3b8;max-width:96%}.hudflt-tool-error{border-color:rgba(239,68,68,0.5);color:#fca5a5}.hudflt-tool-text{white-space:pre-wrap}',
      '.hudflt-tool-name{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:#60a5fa;margin-bottom:3px}',
      '.hudflt-pending{opacity:0.6}',
      '.hudflt-notice{margin:8px 10px 0;padding:5px 8px;border-radius:6px;background:rgba(239,68,68,0.15);color:#fca5a5;font-size:12px}',
      '.hudflt-composer{display:flex;gap:6px;padding:8px 10px;border-top:1px solid rgba(255,255,255,0.08)}',
      '.hudflt-input{flex:1;resize:none;min-height:38px;max-height:120px;background:rgba(255,255,255,0.06);color:#e2e8f0;border:1px solid rgba(255,255,255,0.14);border-radius:8px;padding:6px 8px;font:inherit;outline:none}.hudflt-input:focus{border-color:rgba(129,140,248,0.6)}',
      '.hudflt-send{border:none;border-radius:8px;padding:0 14px;background:#6366f1;color:#fff;font-size:13px;cursor:pointer}.hudflt-send:disabled{opacity:0.4;cursor:default}',
      '.hudflt-resize{position:absolute;right:2px;bottom:2px;width:14px;height:14px;cursor:nwse-resize}.hudflt-resize::before{content:\'\';position:absolute;right:3px;bottom:3px;width:7px;height:7px;border-right:2px solid rgba(148,163,184,0.5);border-bottom:2px solid rgba(148,163,184,0.5);border-bottom-right-radius:3px}',
      '.hudflt-md pre{background:rgba(0,0,0,0.35);border-radius:6px;padding:6px 8px;overflow-x:auto;font-size:12px;margin:4px 0}.hudflt-md code{background:rgba(0,0,0,0.35);border-radius:4px;padding:1px 4px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}.hudflt-md pre code{background:none;padding:0}.hudflt-md a{color:#818cf8;text-decoration:underline}.hudflt-md h1,.hudflt-md h2,.hudflt-md h3,.hudflt-md h4{margin:6px 0 2px;font-size:14px}.hudflt-md h5,.hudflt-md h6{margin:4px 0 2px;font-size:12px}.hudflt-md p{margin:2px 0}.hudflt-md ul,.hudflt-md ol{margin:2px 0;padding-left:18px}.hudflt-md blockquote{border-left:3px solid rgba(129,140,248,0.5);margin:4px 0;padding-left:8px;color:#b6c2d9}.hudflt-md hr{border:none;border-top:1px solid rgba(148,163,184,0.3);margin:6px 0}',
      '.hudflt-toggle{display:flex;align-items:center;justify-content:center;min-height:30px;padding:4px 10px;border:1px solid transparent;border-radius:8px;background:transparent;color:#94a3b8;font-size:12px;cursor:pointer;white-space:nowrap}.hudflt-toggle:hover{background:rgba(255,255,255,0.08);color:#e2e8f0}.hudflt-toggle-on{color:#818cf8;border-color:rgba(129,140,248,0.35)}',
    ].join('')
    var PIP_CSS = '.hudflt-bar-pip{position:fixed;inset:0;display:flex;flex-direction:column;background:rgba(13,15,24,0.98);color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,Microsoft YaHei,sans-serif;font-size:13px;overflow:hidden}.hudflt-bar-pip .hudflt-header{cursor:default}.hudflt-bar-pip .hudflt-header:active{cursor:default}.hudflt-bar-pip .hudflt-scroll{flex:1}'

    // ---------- 轻量 Markdown 渲染（React 版 + PiP HTML 版） ----------
    function mdInlineTokens(text) {
      var tokens = []
      var re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\n]+\*)|(\[([^\]]+)\]\(([^)\s]+)\))/g
      var last = 0
      var m
      while ((m = re.exec(text)) !== null) {
        if (m.index > last) tokens.push({ kind: 'text', text: text.slice(last, m.index) })
        if (m[1] !== undefined) tokens.push({ kind: 'code', text: m[1].slice(1, -1) })
        else if (m[2] !== undefined) tokens.push({ kind: 'bold', text: m[2].slice(2, -2) })
        else if (m[3] !== undefined) tokens.push({ kind: 'italic', text: m[3].slice(1, -1) })
        else if (m[4] !== undefined) tokens.push({ kind: 'link', text: m[5], href: m[6] })
        last = m.index + m[0].length
      }
      if (last < text.length) tokens.push({ kind: 'text', text: text.slice(last) })
      return tokens
    }

    function mdTokenize(text) {
      var blocks = []
      var lines = String(text == null ? '' : text).split('\n')
      var i = 0
      while (i < lines.length) {
        var line = lines[i]
        var trimmed = line.trim()
        if (trimmed === '') { i++; continue }
        if (/^```/.test(trimmed)) {
          var buf = []
          i++
          while (i < lines.length && !/^```/.test(lines[i].trim())) { buf.push(lines[i]); i++ }
          i++
          blocks.push({ type: 'code', text: buf.join('\n') })
          continue
        }
        var h = /^(#{1,6})\s+(.*)$/.exec(line)
        if (h) { blocks.push({ type: 'h', level: h[1].length, text: h[2] }); i++; continue }
        if (/^>\s?/.test(line)) {
          var buf2 = []
          while (i < lines.length && /^>\s?/.test(lines[i])) { buf2.push(lines[i].replace(/^>\s?/, '')); i++ }
          blocks.push({ type: 'quote', text: buf2.join('\n') })
          continue
        }
        if (/^[-*+]\s/.test(line) || /^\d+\.\s/.test(line)) {
          var ordered = /^\d+\.\s/.test(line)
          var items = []
          while (i < lines.length && (/^[-*+]\s/.test(lines[i]) || (ordered && /^\d+\.\s/.test(lines[i])))) {
            items.push(lines[i].replace(/^[-*+]\s/, '').replace(/^\d+\.\s/, ''))
            i++
          }
          blocks.push({ type: ordered ? 'ol' : 'ul', items: items })
          continue
        }
        if (/^(\s*)(---+|\*\*\*+)(\s*)$/.test(line)) { blocks.push({ type: 'hr' }); i++; continue }
        var buf3 = [line]
        i++
        while (i < lines.length) {
          var t = lines[i].trim()
          if (t === '' || /^```/.test(t) || /^#{1,6}\s/.test(t) || /^[-*+]\s/.test(t) || /^\d+\.\s/.test(t) || /^>\s?/.test(t) || /^(\s*)(---+|\*\*\*+)(\s*)$/.test(t)) break
          buf3.push(lines[i])
          i++
        }
        blocks.push({ type: 'p', text: buf3.join('\n') })
      }
      return blocks
    }

    function mdReactInline(tokens, base) {
      var out = []
      for (var n = 0; n < tokens.length; n++) {
        var t = tokens[n]
        if (t.kind === 'text') out.push(t.text)
        else if (t.kind === 'code') out.push(React.createElement('code', { key: base + 'c' + n }, t.text))
        else if (t.kind === 'bold') out.push(React.createElement('strong', { key: base + 'b' + n }, t.text))
        else if (t.kind === 'italic') out.push(React.createElement('em', { key: base + 'i' + n }, t.text))
        else if (t.kind === 'link') out.push(React.createElement('a', { key: base + 'a' + n, href: t.href, target: '_blank', rel: 'noreferrer' }, t.text))
      }
      return out
    }

    function mdReactBlocks(blocks, base) {
      var out = []
      for (var b = 0; b < blocks.length; b++) {
        var blk = blocks[b]
        if (blk.type === 'code') out.push(React.createElement('pre', { key: base + 'pre' + b }, React.createElement('code', null, blk.text)))
        else if (blk.type === 'h') out.push(React.createElement('h' + blk.level, { key: base + 'h' + b }, mdReactInline(mdInlineTokens(blk.text), base + 'h' + b)))
        else if (blk.type === 'quote') out.push(React.createElement('blockquote', { key: base + 'q' + b }, mdReactInline(mdInlineTokens(blk.text), base + 'q' + b)))
        else if (blk.type === 'ul' || blk.type === 'ol') {
          var items = blk.items.map(function (it, n) { return React.createElement('li', { key: base + 'li' + b + '-' + n }, mdReactInline(mdInlineTokens(it), base + 'li' + b + '-' + n)) })
          out.push(React.createElement(blk.type === 'ul' ? 'ul' : 'ol', { key: base + 'l' + b }, items))
        } else if (blk.type === 'hr') out.push(React.createElement('hr', { key: base + 'hr' + b }))
        else out.push(React.createElement('p', { key: base + 'p' + b }, mdReactInline(mdInlineTokens(blk.text), base + 'p' + b)))
      }
      return out
    }

    function mdReact(text, base) {
      return React.createElement('div', { className: 'hudflt-md' }, mdReactBlocks(mdTokenize(text), base))
    }

    function escHtml(s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    }

    function mdHtmlInline(tokens) {
      var out = ''
      for (var i = 0; i < tokens.length; i++) {
        var t = tokens[i]
        if (t.kind === 'text') out += escHtml(t.text)
        else if (t.kind === 'code') out += '<code>' + escHtml(t.text) + '</code>'
        else if (t.kind === 'bold') out += '<strong>' + escHtml(t.text) + '</strong>'
        else if (t.kind === 'italic') out += '<em>' + escHtml(t.text) + '</em>'
        else if (t.kind === 'link') out += '<a href="' + escHtml(t.href) + '" target="_blank" rel="noreferrer">' + escHtml(t.text) + '</a>'
      }
      return out
    }

    function mdHtmlBlocks(blocks) {
      var out = ''
      for (var i = 0; i < blocks.length; i++) {
        var blk = blocks[i]
        if (blk.type === 'code') out += '<pre><code>' + escHtml(blk.text) + '</code></pre>'
        else if (blk.type === 'h') out += '<h' + blk.level + '>' + mdHtmlInline(mdInlineTokens(blk.text)) + '</h' + blk.level + '>'
        else if (blk.type === 'quote') out += '<blockquote>' + mdHtmlInline(mdInlineTokens(blk.text)) + '</blockquote>'
        else if (blk.type === 'ul' || blk.type === 'ol') {
          var tag = blk.type === 'ul' ? 'ul' : 'ol'
          var inner = ''
          for (var j = 0; j < blk.items.length; j++) inner += '<li>' + mdHtmlInline(mdInlineTokens(blk.items[j])) + '</li>'
          out += '<' + tag + '>' + inner + '</' + tag + '>'
        } else if (blk.type === 'hr') out += '<hr/>'
        else out += '<p>' + mdHtmlInline(mdInlineTokens(blk.text)) + '</p>'
      }
      return out
    }

    function mdHtml(text) {
      return mdHtmlBlocks(mdTokenize(text))
    }

    // ---------- 插件本体 ----------
    module.exports = {
      name: 'hud-floating-bar',
      apply(ctx) {
        var slots = ctx.get('slots')
        var sessionsService = ctx.get('sessions')
        var workspacesService = ctx.get('workspaces')
        var timer = ctx.get('timer')
        if (!slots) return

        // 样式自管理（动态插件的 styles.insert 在静态 bundle 中不存在）
        var styleEl = document.createElement('style')
        styleEl.textContent = HUD_CSS + PIP_CSS
        document.head.appendChild(styleEl)
        ctx.effect(function () {
          return function () {
            if (styleEl.parentNode) styleEl.parentNode.removeChild(styleEl)
          }
        }, 'hud: style cleanup')

        // 与 Host half 的 HTTP 通信（同源 /hud-api/*）
        function hudCall(method, path, body) {
          var init = method === 'GET' ? undefined : {
            method: method,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body || {}),
          }
          return fetch(path, init).then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status)
            return res.json()
          })
        }
        var surfacePath = function (sessionId) { return '/hud-api/surface?sessionId=' + encodeURIComponent(sessionId) }
        var modelPath = function (sessionId) { return '/hud-api/model?sessionId=' + encodeURIComponent(sessionId) }

        // ---- shared HUD state (package-lifetime, in-memory) ----
        var hudListeners = new Set()
        var hudState = { open: true, pip: false, pinned: false, sessionId: null, pos: { x: 24, y: 64 }, size: { w: 420, h: 560 } }
        var getHud = function () { return hudState }
        var setHud = function (patch) {
          hudState = Object.assign({}, hudState, patch)
          Array.from(hudListeners).forEach(function (fn) { fn(hudState) })
        }
        var subscribeHud = function (fn) {
          hudListeners.add(fn)
          return function () { hudListeners.delete(fn) }
        }
        function useHud() {
          var snap = React.useState(getHud())
          var state = snap[0]
          var setSnap = snap[1]
          React.useEffect(function () { return subscribeHud(function (next) { setSnap(Object.assign({}, next)) }) }, [])
          return state
        }

        // ---- PiP 外置窗口状态 ----
        var pipWindow = null
        var pipOpening = false
        var pipSending = false
        var pipRefs = {}
        var pipActionsRef = { current: null }
        function resetPipRefs() {
          Object.keys(pipRefs).forEach(function (key) { delete pipRefs[key] })
        }
        ctx.effect(function () {
          return function () {
            if (pipWindow) {
              try { pipWindow.close() } catch (error) { /* ignore */ }
              pipWindow = null
            }
            resetPipRefs()
          }
        }, 'hud: pip cleanup')

        // ---- HUD bar ----
        function HudBar(props) {
          var useSessions = props.useSessions
          var useWorkspaces = props.useWorkspaces
          if (typeof useSessions !== 'function' || typeof useWorkspaces !== 'function') return null
          var hud = useHud()
          var list = useSessions(function (s) { return s })
          var wsList = useWorkspaces(function (s) { return s })
          var current = list.current
          var ids = list.ids || []
          var byId = list.byId || {}
          var wsItems = (wsList && wsList.items) || []
          var surfaceState = React.useState(null)
          var surface = surfaceState[0]
          var setSurface = surfaceState[1]
          var modelState = React.useState(null)
          var modelInfo = modelState[0]
          var setModelInfo = modelState[1]
          var noticeState = React.useState('')
          var notice = noticeState[0]
          var setNotice = noticeState[1]
          var draftState = React.useState('')
          var draft = draftState[0]
          var setDraft = draftState[1]
          var sendingState = React.useState(false)
          var sending = sendingState[0]
          var setSending = sendingState[1]
          var pendingRef = React.useRef([])
          var scrollRef = React.useRef(null)
          var textareaRef = React.useRef(null)

          var sessionId = hud.pinned ? hud.sessionId : current
          if (!sessionId || !byId[sessionId]) sessionId = current && byId[current] ? current : (ids[0] || null)

          var meta = sessionId ? byId[sessionId] : null

          React.useEffect(function () {
            if (hud.pinned && hud.sessionId && !byId[hud.sessionId]) setHud({ pinned: false, sessionId: null })
          }, [hud.pinned, hud.sessionId, byId])

          // ---- polling (页内与 PiP 共用) ----
          React.useEffect(function () {
            if (!hud.open || !sessionId) return
            var cancelled = false
            var refresh = function () {
              return hudCall('GET', surfacePath(sessionId)).then(function (res) {
                if (cancelled || !res) return
                setSurface(function (prev) {
                  var a = prev && Array.isArray(prev.rows) ? prev.rows : []
                  var b = Array.isArray(res.rows) ? res.rows : []
                  if (a.length > 0 && b.length === a.length) {
                    var la = a[a.length - 1]
                    var lb = b[b.length - 1]
                    if (la && lb && la.seq === lb.seq && la.kind === lb.kind && la.text === lb.text) return prev
                  }
                  return res
                })
              }).catch(function () { /* transient */ })
            }
            refresh()
            if (!timer) return function () { cancelled = true }
            var dispose = timer.interval(refresh, 1200)
            return function () { cancelled = true; if (dispose) dispose() }
          }, [hud.open, sessionId])

          // ---- model info (切换模型/推理强度) ----
          React.useEffect(function () {
            if (!hud.open || !sessionId) return
            var cancelled = false
            var load = function () {
              return hudCall('GET', modelPath(sessionId)).then(function (res) {
                if (!cancelled && res) setModelInfo(res)
              }).catch(function () { /* ignore */ })
            }
            load()
            if (!timer) return function () { cancelled = true }
            var dispose = timer.interval(load, 30000)
            return function () { cancelled = true; if (dispose) dispose() }
          }, [hud.open, sessionId])

          // ---- autofocus on open ----
          React.useEffect(function () {
            if (hud.open && !hud.pip) {
              var el = textareaRef.current
              if (el) el.focus()
            }
          }, [hud.open, hud.pip])

          var rows = surface && Array.isArray(surface.rows) ? surface.rows : []
          var lastRow = rows.length > 0 ? rows[rows.length - 1] : null
          var rowsKey = rows.length + ':' + (lastRow ? lastRow.text.length : 0)
          var pendingCount = pendingRef.current.length

          // ---- autoscroll (页内) ----
          React.useEffect(function () {
            var el = scrollRef.current
            if (!el) return
            var nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
            if (nearBottom) el.scrollTop = el.scrollHeight
          }, [rowsKey, pendingCount])

          var modelGroups = (modelInfo && Array.isArray(modelInfo.groups)) ? modelInfo.groups : []
          var currentSel = modelInfo && modelInfo.current ? modelInfo.current : null
          var curGroup = currentSel ? modelGroups.find(function (g) { return g.id === currentSel.provider }) : null
          var curModel = curGroup ? curGroup.models.find(function (m) { return m.id === currentSel.model }) : null
          var efforts = (curModel && curModel.reasoning && Array.isArray(curModel.reasoning.efforts)) ? curModel.reasoning.efforts : []
          var modelValue = currentSel && currentSel.provider ? currentSel.provider + '|' + currentSel.model : ''
          var effortValue = currentSel && currentSel.reasoningEffort ? currentSel.reasoningEffort : ''
          var wsCurrent = meta && meta.cwd ? wsItems.find(function (w) { return w.path === meta.cwd }) : null
          var wsValue = wsCurrent ? wsCurrent.workspaceId : ''

          function applySelection(sel) {
            setModelInfo(function (prev) {
              if (!prev) return prev
              return Object.assign({}, prev, { current: sel })
            })
          }

          function onModelChange(provider, model) {
            if (!sessionId || !provider || !model) return Promise.resolve()
            var group = modelGroups.find(function (g) { return g.id === provider })
            var entry = group ? group.models.find(function (m) { return m.id === model }) : null
            var supported = (entry && entry.reasoning && Array.isArray(entry.reasoning.efforts)) ? entry.reasoning.efforts : []
            var keepEffort = currentSel && currentSel.reasoningEffort && supported.some(function (e) { return e.id === currentSel.reasoningEffort })
            return hudCall('POST', '/hud-api/set-model', {
              sessionId: sessionId,
              provider: provider,
              model: model,
              ...(keepEffort ? { reasoningEffort: currentSel.reasoningEffort } : {}),
            }).then(function (res) {
              if (res && res.ok && res.selected) applySelection(res.selected)
              else if (res && res.error) setNotice('切换模型失败：' + res.error)
            }).catch(function (error) {
              setNotice('切换模型失败：' + String(error))
            })
          }

          function onEffortChange(effort) {
            if (!sessionId || !currentSel || !currentSel.provider || !currentSel.model) return Promise.resolve()
            return hudCall('POST', '/hud-api/set-model', {
              sessionId: sessionId,
              provider: currentSel.provider,
              model: currentSel.model,
              ...(effort ? { reasoningEffort: effort } : {}),
            }).then(function (res) {
              if (res && res.ok && res.selected) applySelection(res.selected)
              else if (res && res.error) setNotice('切换推理强度失败：' + res.error)
            }).catch(function (error) {
              setNotice('切换推理强度失败：' + String(error))
            })
          }

          function onWorkspaceChange(id) {
            if (!id || !workspacesService) return
            workspacesService.connectWorkspace(id).then(function (sid) {
              if (sid && sessionsService) sessionsService.open(sid)
              // 切换工作区后取消固定，HUD 跟随新打开的会话
              setHud({ pinned: false, sessionId: null })
            }).catch(function (error) {
              setNotice('切换工作区失败：' + String(error))
            })
          }

          function onPickSession(id) {
            if (!id) return
            setHud({ pinned: true, sessionId: id })
            if (sessionsService) sessionsService.open(id)
          }

          function send() {
            var text = draft
            if (!text.trim() || !sessionId || sending) return
            setSending(true)
            setNotice('')
            pendingRef.current = pendingRef.current.concat([text])
            setDraft('')
            hudCall('POST', '/hud-api/send', { sessionId: sessionId, text: text }).then(function (res) {
              if (!res || !res.ok) {
                pendingRef.current = pendingRef.current.filter(function (t) { return t !== text })
                if (res && res.error === 'not-live') {
                  setNotice('会话未激活，正在为你打开…')
                  if (sessionsService) sessionsService.open(sessionId)
                } else {
                  setNotice('发送失败：' + ((res && res.error) ? res.error : 'unknown'))
                }
              }
            }).catch(function (error) {
              pendingRef.current = pendingRef.current.filter(function (t) { return t !== text })
              setNotice('发送失败：' + String(error))
            }).finally(function () {
              setSending(false)
            })
          }

          // ================= PiP 外置模式 =================
          function openPip() {
            if (pipOpening || pipWindow) return
            var win = typeof window === 'undefined' ? null : window
            if (!win || !win.documentPictureInPicture) {
              setNotice('当前浏览器不支持画中画外置（需 Chrome/Edge 116+），已保持页内悬浮')
              return
            }
            pipOpening = true
            win.documentPictureInPicture.requestWindow({ width: 440, height: 620 }).then(function (w) {
              pipOpening = false
              pipWindow = w
              try {
                w.document.title = 'HUD 悬浮条'
                w.document.body.style.margin = '0'
                w.document.body.style.background = '#0d0f18'
              } catch (error) { /* ignore */ }
              w.addEventListener('pagehide', function () {
                pipWindow = null
                resetPipRefs()
                setHud({ pip: false })
              })
              setHud({ pip: true })
              try { w.focus() } catch (error) { /* ignore */ }
            }).catch(function () {
              pipOpening = false
              setNotice('画中画窗口打开失败，已保持页内悬浮')
            })
          }

          function pipRowEl(row) {
            var b = pipWindow.document.createElement('div')
            b.className = 'hudflt-bubble hudflt-' + row.kind + (row.error ? ' hudflt-tool-error' : '') + (row.pending ? ' hudflt-pending' : '')
            if (row.kind === 'tool') {
              var n = pipWindow.document.createElement('div')
              n.className = 'hudflt-tool-name'
              n.textContent = row.name || 'tool'
              b.appendChild(n)
              var t = pipWindow.document.createElement('div')
              t.className = 'hudflt-tool-text'
              t.textContent = row.text
              b.appendChild(t)
            } else {
              var md = pipWindow.document.createElement('div')
              md.className = 'hudflt-md'
              md.innerHTML = mdHtml(row.text)
              b.appendChild(md)
            }
            return b
          }

          function buildPipDom() {
            if (!pipWindow || pipRefs.bar) return
            var doc = pipWindow.document
            var style = doc.createElement('style')
            style.textContent = HUD_CSS + PIP_CSS
            doc.head.appendChild(style)
            var bar = doc.createElement('div')
            bar.className = 'hudflt-bar-pip'
            var header = doc.createElement('div')
            header.className = 'hudflt-header'
            var dot = doc.createElement('span')
            dot.className = 'hudflt-dot'
            var title = doc.createElement('span')
            title.className = 'hudflt-title'
            var closeBtn = doc.createElement('button')
            closeBtn.className = 'hudflt-btn hudflt-btn-close'
            closeBtn.textContent = '×'
            closeBtn.title = '关闭画中画，返回页内悬浮'
            closeBtn.addEventListener('click', function () {
              if (pipWindow) pipWindow.close()
            })
            header.appendChild(dot)
            header.appendChild(title)
            header.appendChild(closeBtn)
            var controls = doc.createElement('div')
            controls.className = 'hudflt-controls'
            var scroll = doc.createElement('div')
            scroll.className = 'hudflt-scroll'
            var noticeEl = doc.createElement('div')
            noticeEl.className = 'hudflt-notice'
            noticeEl.style.display = 'none'
            var composer = doc.createElement('div')
            composer.className = 'hudflt-composer'
            var input = doc.createElement('textarea')
            input.className = 'hudflt-input'
            input.placeholder = '输入消息，Enter 发送，Shift+Enter 换行'
            input.addEventListener('input', function () {
              input.style.height = 'auto'
              input.style.height = Math.min(input.scrollHeight, 120) + 'px'
              if (pipRefs.sendBtn) pipRefs.sendBtn.disabled = !input.value.trim() || pipSending
            })
            input.addEventListener('keydown', function (e) {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (pipActionsRef.current) pipActionsRef.current.send()
              } else if (e.key === 'Escape') {
                if (pipWindow) pipWindow.close()
              }
            })
            var sendBtn = doc.createElement('button')
            sendBtn.className = 'hudflt-send'
            sendBtn.textContent = '发送'
            sendBtn.disabled = true
            sendBtn.addEventListener('click', function () {
              if (pipActionsRef.current) pipActionsRef.current.send()
            })
            composer.appendChild(input)
            composer.appendChild(sendBtn)
            bar.appendChild(header)
            bar.appendChild(controls)
            bar.appendChild(scroll)
            bar.appendChild(noticeEl)
            bar.appendChild(composer)
            doc.body.appendChild(bar)
            pipRefs.bar = bar
            pipRefs.controls = controls
            pipRefs.dot = dot
            pipRefs.title = title
            pipRefs.scroll = scroll
            pipRefs.notice = noticeEl
            pipRefs.input = input
            pipRefs.sendBtn = sendBtn
            pipRefs.structuralKey = null
            pipRefs.controlsKey = null
          }

          function buildPipControls() {
            if (!pipWindow || !pipRefs.bar) return
            var doc = pipWindow.document
            var row = doc.createElement('div')
            row.className = 'hudflt-controls'
            function makeSel(title) {
              var s = doc.createElement('select')
              s.className = 'hudflt-session-picker hudflt-control'
              s.title = title
              return s
            }
            var ws = makeSel('切换工作区')
            var ph = doc.createElement('option')
            ph.value = ''
            ph.disabled = true
            ph.textContent = '工作区'
            ws.appendChild(ph)
            wsItems.forEach(function (w) {
              var o = doc.createElement('option')
              o.value = w.workspaceId
              o.textContent = w.title || (w.path ? String(w.path).split('/').pop() || w.path : w.workspaceId)
              ws.appendChild(o)
            })
            ws.addEventListener('change', function () { if (pipActionsRef.current) pipActionsRef.current.setWorkspace(ws.value) })
            var ss = makeSel('切换会话')
            var ph2 = doc.createElement('option')
            ph2.value = ''
            ph2.disabled = true
            ph2.textContent = '会话'
            ss.appendChild(ph2)
            ids.slice(0, 200).forEach(function (id) {
              var o = doc.createElement('option')
              o.value = id
              o.textContent = byId[id] ? byId[id].displayTitle : id
              ss.appendChild(o)
            })
            ss.addEventListener('change', function () { if (pipActionsRef.current) pipActionsRef.current.pickSession(ss.value) })
            var ms = makeSel('切换模型')
            ms.className = 'hudflt-session-picker hudflt-control hudflt-control-wide'
            var ph3 = doc.createElement('option')
            ph3.value = ''
            ph3.disabled = true
            ph3.textContent = '模型'
            ms.appendChild(ph3)
            modelGroups.forEach(function (g) {
              var og = doc.createElement('optgroup')
              og.label = g.name
              g.models.forEach(function (m) {
                var o = doc.createElement('option')
                o.value = g.id + '|' + m.id
                o.textContent = m.name
                og.appendChild(o)
              })
              ms.appendChild(og)
            })
            ms.addEventListener('change', function () {
              var v = ms.value
              var idx = v.indexOf('|')
              if (idx > 0 && pipActionsRef.current) pipActionsRef.current.setModel(v.slice(0, idx), v.slice(idx + 1))
            })
            var es = makeSel('推理强度')
            var ph4 = doc.createElement('option')
            ph4.value = ''
            ph4.disabled = true
            ph4.textContent = '推理'
            es.appendChild(ph4)
            efforts.forEach(function (e) {
              var o = doc.createElement('option')
              o.value = e.id
              o.textContent = e.name
              es.appendChild(o)
            })
            es.addEventListener('change', function () { if (pipActionsRef.current) pipActionsRef.current.setEffort(es.value) })
            row.appendChild(ws)
            row.appendChild(ss)
            row.appendChild(ms)
            row.appendChild(es)
            if (pipRefs.controls) pipRefs.bar.replaceChild(row, pipRefs.controls)
            else pipRefs.bar.insertBefore(row, pipRefs.scroll)
            pipRefs.controls = row
            pipRefs.wsSel = ws
            pipRefs.ssSel = ss
            pipRefs.msSel = ms
            pipRefs.esSel = es
          }

          function syncPip() {
            if (!pipWindow) return
            buildPipDom()
            var r = pipRefs
            if (!r.bar) return
            r.title.textContent = title
            r.dot.className = 'hudflt-dot' + (statusRunning ? ' hudflt-running' : '')
            if (notice) {
              r.notice.textContent = notice
              r.notice.style.display = ''
            } else {
              r.notice.style.display = 'none'
            }
            if (r.sendBtn) r.sendBtn.disabled = pipSending || !sessionId || !(r.input && r.input.value.trim())
            var controlsKey = sessionId + '|' + modelValue + '|' + effortValue + '|' + wsItems.map(function (w) { return w.workspaceId }).join(',') + '|' + modelGroups.map(function (g) { return g.id }).join(',') + '|' + efforts.length
            if (r.controlsKey !== controlsKey) {
              r.controlsKey = controlsKey
              buildPipControls()
            }
            try {
              if (r.wsSel) r.wsSel.value = wsValue || ''
              if (r.ssSel) r.ssSel.value = sessionId || ''
              if (r.msSel) r.msSel.value = modelValue
              if (r.esSel) r.esSel.value = effortValue
            } catch (error) { /* ignore */ }
            // 合并服务端行 + 乐观待确认行
            var merged = []
            for (var i = 0; i < rows.length; i++) merged.push(rows[i])
            for (var p = 0; p < pendingVisible.length; p++) merged.push({ kind: 'user', seq: 'p' + p, text: pendingVisible[p], pending: true })
            var last = merged.length > 0 ? merged[merged.length - 1] : null
            var structuralKey = merged.length + ':' + (last ? String(last.seq) + ':' + last.kind : '')
            if (r.structuralKey !== structuralKey) {
              r.structuralKey = structuralKey
              r.scroll.textContent = ''
              if (merged.length === 0) {
                var empty = pipWindow.document.createElement('div')
                empty.className = 'hudflt-empty'
                empty.textContent = '暂无消息 — 直接输入即可发消息'
                r.scroll.appendChild(empty)
              } else {
                for (var j = 0; j < merged.length; j++) r.scroll.appendChild(pipRowEl(merged[j]))
              }
              var sc = r.scroll
              if (sc.scrollHeight - sc.scrollTop - sc.clientHeight < 80) sc.scrollTop = sc.scrollHeight
            } else if (last && r.scroll.lastChild) {
              var bubble = r.scroll.lastChild
              var mdEl = bubble.lastChild
              if (mdEl && mdEl.className === 'hudflt-md') mdEl.innerHTML = mdHtml(last.text)
              else if (mdEl && typeof mdEl.textContent === 'string' && bubble.className.indexOf('hudflt-tool') >= 0) mdEl.textContent = last.text
              var sc2 = r.scroll
              if (sc2.scrollHeight - sc2.scrollTop - sc2.clientHeight < 80) sc2.scrollTop = sc2.scrollHeight
            }
          }

          function sendPip() {
            if (pipSending || !sessionId) return
            var input = pipRefs.input
            var text = input ? input.value : ''
            if (!text.trim()) return
            pipSending = true
            pendingRef.current = pendingRef.current.concat([text])
            if (input) input.value = ''
            if (pipRefs.sendBtn) pipRefs.sendBtn.disabled = true
            hudCall('POST', '/hud-api/send', { sessionId: sessionId, text: text }).then(function (res) {
              if (!res || !res.ok) {
                pendingRef.current = pendingRef.current.filter(function (t) { return t !== text })
                if (res && res.error === 'not-live') {
                  setNotice('会话未激活，正在为你打开…')
                  if (sessionsService) sessionsService.open(sessionId)
                }
              }
            }).catch(function () {
              pendingRef.current = pendingRef.current.filter(function (t) { return t !== text })
            }).finally(function () {
              pipSending = false
              if (pipRefs.sendBtn && pipRefs.input) pipRefs.sendBtn.disabled = !pipRefs.input.value.trim()
            })
          }

          var serverUserTexts = new Set()
          for (var ri = 0; ri < rows.length; ri++) if (rows[ri].kind === 'user') serverUserTexts.add(rows[ri].text)
          var pendingVisible = pendingRef.current.filter(function (t) { return !serverUserTexts.has(t) })

          var title = meta ? meta.displayTitle : (sessionId ? sessionId : '未选择会话')
          var running = sessionId ? Boolean(meta && meta.running) : false
          var statusRunning = running || (surface && surface.status === 'running')

          // ---- PiP 同步 ----
          var pipSyncKey = (hud.pip ? '1' : '0') + '|' + rowsKey + '|' + pendingCount + '|' + (statusRunning ? '1' : '0') + '|' + title + '|' + (notice || '') + '|' + (sessionId || '') + '|' + modelValue + '|' + effortValue + '|' + wsValue + '|' + modelGroups.length + '|' + wsItems.length
          React.useEffect(function () {
            if (!hud.pip || !pipWindow) return
            pipActionsRef.current = {
              send: sendPip,
              setModel: onModelChange,
              setEffort: onEffortChange,
              setWorkspace: onWorkspaceChange,
              pickSession: onPickSession,
            }
            syncPip()
          }, [pipSyncKey])

          if (!hud.open || hud.pip) return null

          var items = []
          for (var k = 0; k < rows.length; k++) {
            var row = rows[k]
            var cls = 'hudflt-bubble hudflt-' + row.kind + (row.error ? ' hudflt-tool-error' : '')
            var children = []
            if (row.kind === 'tool') {
              children.push(React.createElement('div', { className: 'hudflt-tool-name' }, row.name || 'tool'))
              children.push(React.createElement('div', { className: 'hudflt-tool-text' }, row.text))
            } else {
              children.push(mdReact(row.text, String(row.seq)))
            }
            items.push(React.createElement('div', { key: row.seq + '-' + row.kind, className: cls }, children))
          }
          for (var pi = 0; pi < pendingVisible.length; pi++) {
            items.push(React.createElement('div', { key: 'pending-' + pi, className: 'hudflt-bubble hudflt-user hudflt-pending' }, mdReact(pendingVisible[pi], 'p' + pi)))
          }

          var sessionOptions = ids.slice(0, 200).map(function (id) {
            var m = byId[id]
            return React.createElement('option', { key: id, value: id }, m ? m.displayTitle : id)
          })
          var wsOptions = wsItems.map(function (w) { return React.createElement('option', { key: w.workspaceId, value: w.workspaceId }, w.title || (w.path ? String(w.path).split('/').pop() || w.path : w.workspaceId)) })
          var modelOptions = modelGroups.map(function (g) {
            return React.createElement('optgroup', { key: g.id, label: g.name },
              g.models.map(function (m) { return React.createElement('option', { key: m.id, value: g.id + '|' + m.id }, m.name) })
            )
          })
          var effortOptions = [React.createElement('option', { key: 'default', value: '' }, '默认')].concat(
            efforts.map(function (e) { return React.createElement('option', { key: e.id, value: e.id }, e.name) })
          )

          function startDrag(e) {
            if (e.button !== 0) return
            if (e.target && e.target.closest && e.target.closest('button, select, textarea')) return
            var doc = e.currentTarget.ownerDocument
            var startX = e.clientX
            var startY = e.clientY
            var orig = hud.pos
            var vw = doc.documentElement.clientWidth
            var vh = doc.documentElement.clientHeight
            function onMove(ev) {
              var nx = orig.x + ev.clientX - startX
              var ny = orig.y + ev.clientY - startY
              nx = Math.max(8, Math.min(nx, vw - 160))
              ny = Math.max(8, Math.min(ny, vh - 80))
              setHud({ pos: { x: nx, y: ny } })
            }
            function onUp() {
              doc.removeEventListener('pointermove', onMove)
              doc.removeEventListener('pointerup', onUp)
            }
            doc.addEventListener('pointermove', onMove)
            doc.addEventListener('pointerup', onUp)
            e.preventDefault()
          }

          function startResize(e) {
            if (e.button !== 0) return
            e.stopPropagation()
            var doc = e.currentTarget.ownerDocument
            var startX = e.clientX
            var startY = e.clientY
            var orig = hud.size
            var vw = doc.documentElement.clientWidth
            var vh = doc.documentElement.clientHeight
            function onMove(ev) {
              var w = Math.max(300, Math.min(orig.w + ev.clientX - startX, vw - 16))
              var h = Math.max(280, Math.min(orig.h + ev.clientY - startY, vh - 16))
              setHud({ size: { w: w, h: h } })
            }
            function onUp() {
              doc.removeEventListener('pointermove', onMove)
              doc.removeEventListener('pointerup', onUp)
            }
            doc.addEventListener('pointermove', onMove)
            doc.addEventListener('pointerup', onUp)
            e.preventDefault()
          }

          function togglePin() {
            if (hud.pinned) setHud({ pinned: false, sessionId: null })
            else setHud({ pinned: true, sessionId: sessionId })
          }

          var header = React.createElement('div', { className: 'hudflt-header', onPointerDown: startDrag },
            React.createElement('span', { className: 'hudflt-dot' + (statusRunning ? ' hudflt-running' : ''), title: statusRunning ? 'Agent 运行中' : 'Agent 空闲' }),
            React.createElement('span', { className: 'hudflt-title' }, title),
            React.createElement('button', {
              className: 'hudflt-btn',
              title: '外置为画中画窗口：OS 级置顶，可盖在其他应用上（Chrome/Edge）',
              onClick: openPip,
            }, '外置'),
            React.createElement('button', {
              className: 'hudflt-btn' + (hud.pinned ? ' hudflt-btn-on' : ''),
              title: hud.pinned ? '已固定此会话 — 点击取消固定（跟随当前会话）' : '固定到当前会话（不再跟随切换）',
              onClick: togglePin,
            }, hud.pinned ? '◉' : '○'),
            React.createElement('button', {
              className: 'hudflt-btn hudflt-btn-close',
              title: '关闭 HUD（Esc 或 Ctrl+Shift+H）',
              onClick: function () { setHud({ open: false }) },
            }, '×')
          )

          var controlsRow = React.createElement('div', { className: 'hudflt-controls' },
            React.createElement('select', {
              className: 'hudflt-session-picker hudflt-control',
              value: wsValue || '',
              onChange: function (e) { onWorkspaceChange(e.target.value) },
              title: '切换工作区',
            }, [React.createElement('option', { key: 'ws-ph', value: '', disabled: true }, '工作区')].concat(wsOptions)),
            React.createElement('select', {
              className: 'hudflt-session-picker hudflt-control',
              value: sessionId || '',
              onChange: function (e) { onPickSession(e.target.value) },
              title: '切换会话（同时切换主界面）',
            }, [React.createElement('option', { key: 'ss-ph', value: '', disabled: true }, '会话')].concat(sessionOptions)),
            React.createElement('select', {
              className: 'hudflt-session-picker hudflt-control hudflt-control-wide',
              value: modelValue,
              onChange: function (e) {
                var v = e.target.value
                var idx = v.indexOf('|')
                if (idx > 0) onModelChange(v.slice(0, idx), v.slice(idx + 1))
              },
              title: '切换模型（下一轮生效，同步保存为默认）',
            }, [React.createElement('option', { key: 'm-ph', value: '', disabled: true }, '模型')].concat(modelOptions)),
            React.createElement('select', {
              className: 'hudflt-session-picker hudflt-control',
              value: effortValue,
              onChange: function (e) { onEffortChange(e.target.value) },
              title: '推理强度',
            }, effortOptions)
          )

          var scroll = React.createElement('div', { className: 'hudflt-scroll', ref: scrollRef },
            rows.length === 0 && pendingVisible.length === 0
              ? React.createElement('div', { className: 'hudflt-empty' }, '暂无消息 — 直接输入即可向当前会话发消息')
              : items
          )
          var composer = React.createElement('div', { className: 'hudflt-composer' },
            React.createElement('textarea', {
              ref: textareaRef,
              className: 'hudflt-input',
              placeholder: '输入消息，Enter 发送，Shift+Enter 换行',
              value: draft,
              onChange: function (e) { setDraft(e.target.value) },
              onKeyDown: function (e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              },
            }),
            React.createElement('button', { className: 'hudflt-send', disabled: !draft.trim() || sending || !sessionId, onClick: send }, '发送')
          )
          var body = React.createElement('div', { className: 'hudflt-body' },
            notice ? React.createElement('div', { className: 'hudflt-notice' }, notice) : null,
            scroll,
            composer
          )

          return React.createElement('div', {
            className: 'hudflt-bar',
            style: {
              left: hud.pos.x + 'px',
              top: hud.pos.y + 'px',
              width: hud.size.w + 'px',
              height: hud.size.h + 'px',
            },
            onKeyDown: function (e) {
              if (e.key === 'Escape') setHud({ open: false })
              else if (e.key === 'H' && (e.ctrlKey || e.metaKey) && e.shiftKey) setHud({ open: false })
            },
          }, header, controlsRow, body, React.createElement('div', { className: 'hudflt-resize', onPointerDown: startResize }))
        }

        // ---- sidebar toggle ----
        function HudToggle(props) {
          var hud = useHud()
          return React.createElement('button', {
            className: 'hudflt-toggle' + (hud.open ? ' hudflt-toggle-on' : ''),
            title: 'HUD 悬浮条 — 开/关（外置模式中点击将关闭画中画窗口）',
            onClick: function () {
              if (hud.pip) {
                if (pipWindow) pipWindow.close()
              } else {
                setHud({ open: !hud.open })
              }
            },
          }, hud.pip ? '外置中' : (props.wide ? 'HUD 悬浮条' : 'HUD'))
        }

        slots.inject('shell.overlay', function () { return slots.register(
          { name: 'shell.overlay', id: 'hud-bar', order: 40, label: 'HUD 悬浮条' },
          function (props) { return React.createElement(HudBar, props) }
        ) })
        slots.inject('sidebar.footer.action', function () { return slots.register(
          { name: 'sidebar.footer.action', id: 'hud-toggle', order: 20, label: 'HUD 悬浮条' },
          function (props) { return React.createElement(HudToggle, props) }
        ) })
      },
    }

    return module.exports
  },
})
