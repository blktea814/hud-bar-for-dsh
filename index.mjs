/**
 * hud-floating-bar — Host half (Cordis entry)
 *
 * Exposes five JSON endpoints over the DSH web server (same-origin with the
 * web UI, no auth required on the local surface):
 *
 *   GET  /hud-api/surface?sessionId=<id>  -> { rows, status, cwd, source, missing }
 *   POST /hud-api/send                    -> { ok, error? }
 *   GET  /hud-api/model?sessionId=<id>    -> { current, groups, failures }
 *   POST /hud-api/set-model               -> { ok, selected?, error? }
 *   POST /hud-api/stop                    -> { ok, error? }  (stop generating)
 *
 * Business logic is identical to the dynamic-plugin implementation: an
 * incremental per-session transcript buffer (with streaming text folding),
 * user-message injection through the official agent inbox, and per-agent
 * model/reasoning-effort override installed on the agent request waterfalls.
 */
export default {
  name: 'hud-floating-bar',
  inject: ['sessions', 'sessionPersistence', 'agents', 'llm', 'agentDefaultModel', 'webServer'],
  apply(ctx) {
    // 单行文本显示上限（字符）。500 过小导致长消息被截断；10000 覆盖
    // 几乎所有消息，仅对极端超长内容截断以保护轮询 payload 大小。
    const CAP = 10000
    const MAX_ROWS = 150
    const MAX_BUFFERS = 30

    function extractText(content) {
      const parts = []
      const blocks = Array.isArray(content) ? content : []
      for (const block of blocks) {
        if (!block || typeof block !== 'object') continue
        if (block.type === 'text' && typeof block.text === 'string') parts.push(block.text)
        else if (block.type === 'tool-call') parts.push('[工具调用' + (typeof block.name === 'string' ? ' ' + block.name : '') + ']')
        else if (block.type === 'image') parts.push('[图片]')
      }
      let text = parts.join('\n').replace(/\n{3,}/g, '\n\n').trim()
      if (text.length > CAP) text = text.slice(0, CAP) + ' …'
      return text
    }

    const buffers = new Map()

    // ---------- 待审批请求观察（只读，不接管审批链） ----------
    // 通过 session/event 全局事件监听 approval/asked + approval/decided 审计对，
    // 把“有待审批”状态带给 HUD 提示，让用户知道需要回主界面批准。
    const pendingApprovals = new Map() // id -> { sessionId, toolName, reason, at }
    const APPROVAL_TTL = 15 * 60 * 1000
    ctx.on('session/event', (session, event) => {
      if (!event || typeof event.type !== 'string') return
      const data = event.data || {}
      if (event.type === 'approval/asked' && typeof data.id === 'string') {
        pendingApprovals.set(data.id, {
          sessionId: session && session.id ? session.id : '',
          toolName: typeof data.toolName === 'string' ? data.toolName : 'tool',
          reason: typeof data.reason === 'string' ? data.reason : '',
          at: Date.now(),
        })
      } else if (event.type === 'approval/decided' && typeof data.id === 'string') {
        pendingApprovals.delete(data.id)
      }
    })

    function pendingApprovalsList() {
      const now = Date.now()
      const list = []
      for (const entry of pendingApprovals.values()) {
        if (now - entry.at > APPROVAL_TTL) continue
        list.push(entry)
      }
      return list
    }

    function rememberBuffer(sessionId, buffer) {
      buffers.set(sessionId, buffer)
      // LRU 上限：防止长期使用内存增长
      while (buffers.size > MAX_BUFFERS) {
        const oldest = buffers.keys().next().value
        if (oldest === undefined) break
        buffers.delete(oldest)
      }
    }

    function buildRows(events) {
      const state = { seq: 0, rows: [], streams: new Map(), tools: new Map() }
      for (const event of events) {
        if (!event || typeof event.seq !== 'number') continue
        state.seq = event.seq
        const data = event.data
        if (!data || typeof data !== 'object') continue
        switch (event.type) {
          case 'user/message': {
            state.rows.push({ kind: 'user', seq: event.seq, text: extractText(data.content) })
            break
          }
          case 'assistant/chunk': {
            const chunk = data.chunk
            if (chunk && chunk.type === 'text-delta' && typeof chunk.text === 'string') {
              const key = String(data.turn) + ':' + String(data.step)
              let entry = state.streams.get(key)
              if (entry === undefined) {
                entry = { index: state.rows.length, text: '' }
                state.streams.set(key, entry)
                state.rows.push({ kind: 'stream', seq: event.seq, text: '' })
              }
              // 累积完整文本（上限 50000 防极端），显示时截断头部，与最终消息一致
              entry.text += chunk.text
              if (entry.text.length > 50000) entry.text = entry.text.slice(-50000)
              state.rows[entry.index].text = entry.text.length > CAP ? entry.text.slice(0, CAP) + ' …' : entry.text
            }
            break
          }
          case 'assistant/message': {
            const key = String(data.turn) + ':' + String(data.step)
            const text = extractText(data.message && data.message.content)
            const streamed = state.streams.get(key)
            if (streamed !== undefined) {
              state.streams.delete(key)
              state.rows[streamed.index] = { kind: 'assistant', seq: event.seq, text }
            } else {
              state.rows.push({ kind: 'assistant', seq: event.seq, text })
            }
            break
          }
          case 'tool/call': {
            if (typeof data.name === 'string') state.tools.set(String(data.turn) + ':' + String(data.step), data.name)
            break
          }
          case 'tool/result': {
            const key = String(data.turn) + ':' + String(data.step)
            const name = state.tools.get(key)
            state.rows.push({
              kind: 'tool',
              seq: event.seq,
              name: name || 'tool',
              text: extractText(data.message && data.message.content),
              error: Boolean(data.error),
            })
            break
          }
          default:
            break
        }
      }
      return state
    }

    function prune(state) {
      if (state.rows.length <= MAX_ROWS) return
      const drop = state.rows.length - MAX_ROWS
      state.rows = state.rows.slice(drop)
      for (const [key, entry] of state.streams) {
        if (entry.index < drop) state.streams.delete(key)
        else entry.index -= drop
      }
    }

    // ---------- HTTP 工具 ----------
    function readBody(req) {
      return new Promise((resolve) => {
        const chunks = []
        req.on('data', (chunk) => chunks.push(chunk))
        req.on('end', () => {
          let parsed = {}
          try {
            const raw = Buffer.concat(chunks).toString('utf8')
            if (raw) parsed = JSON.parse(raw)
          } catch (error) {
            parsed = {}
          }
          resolve(parsed)
        })
        req.on('error', () => resolve({}))
      })
    }

    function sendJson(res, status, data) {
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify(data))
    }

    // ---------- 会话转录 ----------
    async function surfaceFor(sessionId) {
      const empty = { rows: [], status: 'idle', missing: true }
      if (!sessionId) return empty
      const live = ctx.sessions.get(sessionId)
      let events = null
      let source = 'live'
      let header = null
      if (live) {
        events = live.events
        header = live.header
      } else if (ctx.sessionPersistence) {
        try {
          const res = await ctx.sessionPersistence.readFrom(sessionId, 0)
          events = res.events
          header = res.meta
          source = 'persisted'
        } catch (error) {
          return empty
        }
      }
      if (!events) return empty
      let buffer = buffers.get(sessionId)
      if (buffer === undefined || buffer.source !== source) {
        buffer = { source: source, ...buildRows(events) }
        prune(buffer)
        rememberBuffer(sessionId, buffer)
      } else if (events.length > 0 && buffer.seq < events[events.length - 1].seq) {
        let tail = []
        if (source === 'live') {
          tail = events.slice(buffer.seq + 1)
        } else if (ctx.sessionPersistence) {
          try {
            tail = (await ctx.sessionPersistence.readFrom(sessionId, buffer.seq + 1)).events
          } catch (error) {
            tail = []
          }
        }
        if (tail.length > 0) {
          const built = buildRows(tail)
          const offset = buffer.rows.length
          for (const row of built.rows) buffer.rows.push(row)
          for (const [key, entry] of built.streams) {
            buffer.streams.set(key, { index: offset + entry.index, text: entry.text })
          }
          for (const [key, name] of built.tools) buffer.tools.set(key, name)
          buffer.seq = built.seq
          prune(buffer)
        }
      }
      const agent = ctx.agents.get(sessionId)
      const status = agent ? (agent.status === 'running' ? 'running' : 'idle') : 'idle'
      return {
        rows: buffer.rows,
        status: status,
        cwd: header && header.cwd ? header.cwd : null,
        source: source,
        missing: false,
        approvals: pendingApprovalsList(),
      }
    }

    // ---------- 模型 / 推理强度切换 ----------
    const selections = new Map()
    const catalogCache = { at: 0, value: null }
    const MODEL_TTL = 60000

    async function modelCatalog() {
      const now = Date.now()
      if (catalogCache.value !== null && now - catalogCache.at < MODEL_TTL) return catalogCache.value
      const llm = ctx.llm
      if (!llm) return { groups: [], failures: [] }
      const groups = []
      const failures = []
      const providers = llm.listProviders()
      for (const provider of providers) {
        try {
          const models = await llm.listModels(provider.id)
          const entries = []
          for (const model of models) {
            let reasoning
            try {
              const info = await llm.resolveModelInfo(provider.id, model.id)
              if (info && info.reasoning) {
                reasoning = {
                  efforts: (info.reasoning.efforts || []).map((e) => ({ id: e.id, name: e.name, ...(e.description === undefined ? {} : { description: e.description }) })),
                  ...(info.reasoning.defaultEffort === undefined ? {} : { defaultEffort: info.reasoning.defaultEffort }),
                }
              }
            } catch (error) { /* keep model without reasoning info */ }
            entries.push({
              id: model.id,
              name: model.name,
              ...(model.description === undefined ? {} : { description: model.description }),
              ...(reasoning ? { reasoning: reasoning } : {}),
            })
          }
          if (entries.length > 0) groups.push({ id: provider.id, name: provider.name, models: entries })
        } catch (error) {
          failures.push({ id: provider.id, name: provider.name, message: error instanceof Error ? error.message : String(error) })
        }
      }
      catalogCache.value = { groups: groups, failures: failures }
      catalogCache.at = now
      return catalogCache.value
    }

    ctx.on('llm/adapters-updated', () => { catalogCache.value = null })

    function currentSelectionFor(agent) {
      // 本插件已设置的 override 尚未被会话 header 记录（切换后未跑新轮）时优先返回，防止 UI 回退
      const entry = selections.get(agent.id)
      if (entry && entry.selection && entry.selection.current !== undefined) {
        const s = entry.selection.current
        return { provider: s.provider, model: s.model, ...(s.reasoningEffort === undefined ? {} : { reasoningEffort: s.reasoningEffort }) }
      }
      try {
        const header = agent.session.requestHeader()
        const config = header && header.config
        if (config && config.provider && config.model) {
          return { provider: config.provider, model: config.model, ...(config.reasoningEffort === undefined ? {} : { reasoningEffort: config.reasoningEffort }) }
        }
      } catch (error) { /* fall through */ }
      const adm = ctx.agentDefaultModel
      if (adm) {
        try {
          const s = adm.currentSelection()
          if (s && s.provider && s.model) return { provider: s.provider, model: s.model, ...(s.reasoningEffort === undefined ? {} : { reasoningEffort: s.reasoningEffort }) }
        } catch (error) { /* fall through */ }
      }
      return { provider: '', model: '' }
    }

    function selectionFor(agent) {
      let entry = selections.get(agent.id)
      if (entry !== undefined) return entry
      const selection = { current: undefined, assembled: undefined }
      const agentCtx = agent.ctx
      const disposeAssembly = agentCtx.on('system-prompt/assemble', async (_assembly, _context, next) => {
        const selected = selection.current
        const assembled = await next()
        selection.assembled = selected
        if (selected === undefined) return assembled
        return Object.assign({}, assembled, {
          variables: Object.assign({}, assembled.variables, { provider: selected.provider, model: selected.model }),
        })
      })
      const disposeRequest = agentCtx.on('agent/request', async (_payload, next) => {
        const resolved = await next()
        const selected = selection.assembled
        if (selected === undefined) return resolved
        // 若会话日志 header 已反映所选（上一轮已生效），则让出控制，避免覆盖主界面后续切换
        try {
          const logged = agent.session.requestHeader()
          const cfg = logged && logged.config
          if (cfg && cfg.provider === selected.provider && cfg.model === selected.model && (cfg.reasoningEffort === selected.reasoningEffort || (cfg.reasoningEffort === undefined && selected.reasoningEffort === undefined))) {
            selection.current = undefined
            selection.assembled = undefined
            return resolved
          }
        } catch (error) { /* keep overriding */ }
        const rest = {}
        for (const key of Object.keys(resolved)) if (key !== 'reasoningEffort') rest[key] = resolved[key]
        return Object.assign({}, rest, {
          provider: selected.provider,
          model: selected.model,
          ...(selected.reasoningEffort === undefined ? {} : { reasoningEffort: selected.reasoningEffort }),
        })
      })
      entry = { selection: selection, dispose: () => { disposeAssembly(); disposeRequest() } }
      selections.set(agent.id, entry)
      return entry
    }

    ctx.on('agent/disposed', (payload) => {
      const agent = payload && payload.agent
      if (!agent) return
      const entry = selections.get(agent.id)
      if (entry) {
        selections.delete(agent.id)
        try { entry.dispose() } catch (error) { /* ignore */ }
      }
      // 顺带清理该会话的转录 buffer
      buffers.delete(agent.id)
    })

    ctx.effect(() => () => {
      for (const entry of selections.values()) {
        try { entry.dispose() } catch (error) { /* ignore */ }
      }
      selections.clear()
      buffers.clear()
      pendingApprovals.clear()
    }, 'hud: model selection cleanup')

    // ---------- HTTP 端点 ----------
    const routes = [
      {
        kind: 'exact',
        path: '/hud-api/surface',
        handler: async (req, res) => {
          const url = new URL(req.url, 'http://localhost')
          const sessionId = url.searchParams.get('sessionId') || ''
          const data = await surfaceFor(sessionId)
          sendJson(res, 200, data)
        },
      },
      {
        kind: 'exact',
        path: '/hud-api/send',
        handler: async (req, res) => {
          const body = await readBody(req)
          const sessionId = typeof body.sessionId === 'string' ? body.sessionId : ''
          const text = typeof body.text === 'string' ? body.text : ''
          if (!sessionId || !text.trim()) {
            sendJson(res, 400, { ok: false, error: 'bad-args' })
            return
          }
          const agent = ctx.agents.get(sessionId)
          if (!agent) {
            sendJson(res, 409, { ok: false, error: 'not-live' })
            return
          }
          const message = Object.freeze({
            id: 'hud-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10),
            role: 'user',
            content: [{ type: 'text', text: text }],
            source: { kind: 'user' },
          })
          try {
            agent.followup(message)
            sendJson(res, 200, { ok: true })
          } catch (error) {
            sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
          }
        },
      },
      {
        kind: 'exact',
        path: '/hud-api/model',
        handler: async (req, res) => {
          const url = new URL(req.url, 'http://localhost')
          const sessionId = url.searchParams.get('sessionId') || ''
          const empty = { current: { provider: '', model: '' }, groups: [], failures: [] }
          if (!sessionId) {
            sendJson(res, 200, empty)
            return
          }
          const agent = ctx.agents.get(sessionId)
          if (!agent) {
            sendJson(res, 200, empty)
            return
          }
          const current = currentSelectionFor(agent)
          const catalog = await modelCatalog()
          sendJson(res, 200, { current: current, groups: catalog.groups, failures: catalog.failures })
        },
      },
      {
        kind: 'exact',
        path: '/hud-api/set-model',
        handler: async (req, res) => {
          const body = await readBody(req)
          const sessionId = typeof body.sessionId === 'string' ? body.sessionId : ''
          const provider = typeof body.provider === 'string' ? body.provider : ''
          const model = typeof body.model === 'string' ? body.model : ''
          const reasoningEffort = typeof body.reasoningEffort === 'string' && body.reasoningEffort !== '' ? body.reasoningEffort : undefined
          if (!sessionId || !provider || !model) {
            sendJson(res, 400, { ok: false, error: 'bad-args' })
            return
          }
          const agent = ctx.agents.get(sessionId)
          if (!agent) {
            sendJson(res, 409, { ok: false, error: 'not-live' })
            return
          }
          const llm = ctx.llm
          if (!llm) {
            sendJson(res, 503, { ok: false, error: 'no-llm' })
            return
          }
          try {
            const resolved = await llm.resolveCallConfig({
              provider: provider,
              model: model,
              ...(reasoningEffort === undefined ? {} : { reasoningEffort: reasoningEffort }),
            })
            const selected = {
              provider: resolved.provider,
              model: resolved.model,
              ...(resolved.reasoningEffort === undefined ? {} : { reasoningEffort: resolved.reasoningEffort }),
            }
            selectionFor(agent).selection.current = selected
            const adm = ctx.agentDefaultModel
            if (adm) {
              try {
                await adm.saveSelection({ provider: selected.provider, model: selected.model, ...(selected.reasoningEffort === undefined ? {} : { reasoningEffort: selected.reasoningEffort }) })
              } catch (error) { /* best-effort */ }
            }
            // 同步官方会话选择（主界面模型选择器的数据源），让网页版 UI 反映切换。
            // 注意：apiProxy.sessions.selectModel 走 C→S HTTP carrier（INTERNAL_BASE 是假域名，
            // Host 内调用必然失败），因此直接以真实回环地址调用官方 /api/session.selectModel。
            try {
              const ws = ctx.webServer
              const origin = 'http://' + (ws.host === '0.0.0.0' ? '127.0.0.1' : ws.host) + ':' + ws.port
              const rpcId = crypto.randomUUID()
              const resp = await fetch(origin + '/api/session.selectModel', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                  type: 'client-request',
                  rpcId: rpcId,
                  method: 'session.selectModel',
                  payload: {
                    sessionId: sessionId,
                    provider: selected.provider,
                    model: selected.model,
                    ...(selected.reasoningEffort === undefined ? {} : { reasoningEffort: selected.reasoningEffort }),
                  },
                }),
              })
              const body = await resp.json()
              if (!body || !body.result || body.result.ok !== true) { /* 官方同步失败不影响 override */ }
            } catch (error) { /* best-effort: override 已生效，官方同步失败不影响使用 */ }
            sendJson(res, 200, { ok: true, selected: selected })
          } catch (error) {
            sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) })
          }
        },
      },
      {
        kind: 'exact',
        path: '/hud-api/stop',
        handler: async (req, res) => {
          const body = await readBody(req)
          const sessionId = typeof body.sessionId === 'string' ? body.sessionId : ''
          if (!sessionId) {
            sendJson(res, 400, { ok: false, error: 'bad-args' })
            return
          }
          const agent = ctx.agents.get(sessionId)
          if (!agent) {
            sendJson(res, 409, { ok: false, error: 'not-live' })
            return
          }
          if (agent.status !== 'running') {
            sendJson(res, 200, { ok: false, error: 'not-running' })
            return
          }
          try {
            // 与网页版“停止生成”等价：以用户原因中止当前 agent 驱动
            agent.cancel({ kind: 'user' })
            sendJson(res, 200, { ok: true })
          } catch (error) {
            sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
          }
        },
      },
    ]

    const disposers = routes.map((route) => ctx.webServer.register(route))
    ctx.effect(() => () => {
      for (const dispose of disposers) {
        try { dispose() } catch (error) { /* ignore */ }
      }
    }, 'hud: route cleanup')
  },
}
