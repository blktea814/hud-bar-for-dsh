/**
 * hud-floating-bar — Host half (Cordis entry)
 *
 * Exposes seven JSON endpoints over the DSH web server (same-origin with the
 * web UI, no auth required on the local surface):
 *
 *   GET  /hud-api/surface?sessionId=<id>  -> { rows, status, cwd, source, missing, approvals }
 *   POST /hud-api/send                    -> { ok, error? }
 *   GET  /hud-api/model?sessionId=<id>    -> { current, groups, failures }
 *   POST /hud-api/set-model               -> { ok, selected?, error? }
 *   POST /hud-api/set-open                -> { ok }            (HUD open state sync)
 *   POST /hud-api/approve                 -> { ok, error? }    (answer a pending approval)
 *   GET  /hud-api/debug                   -> { hudOpen, approvalListenerActive, pendingCount }
 *
 * IMPORTANT — approval listener ordering: to answer `approval/request` before
 * the web UI's api-proxy, the listener MUST be registered in apply() directly
 * (no service inject, which would defer apply until services appear and place
 * us AFTER api-proxy). Route registration alone waits on `webServer` via
 * ctx.inject. Business services are read lazily with ctx.get inside handlers.
 */
export default {
  name: 'hud-floating-bar',
  apply(ctx) {
    const CAP = 500
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

    // ---------- 审批（HUD 内批准权限） ----------
    // listener 在 apply 主体立即注册，不依赖任何服务——确保在 api-proxy 之前
    // 进入 approval/request 链（api-proxy 的 listener 会终结该链）。若组合行
    // 顺序晚于 @deepseek-ai/dsh-web-app，本监听器不会被执行，审批维持主界面
    // 原样行为——插件安全降级。
    let hudOpen = true
    let approvalListenerActive = false
    const pendingApprovals = new Map() // approvalId -> { approvalId, sessionId, toolName, callId, reason, resolve }

    ctx.on('approval/request', (req, next) => {
      approvalListenerActive = true
      // HUD 未打开时透传给主界面（api-proxy 的 answerer）
      if (!hudOpen) return next()
      // 从会话日志反向查找未决的 approval/asked 事件（与 api-proxy 同一逻辑）
      const events = req.agent.session.events
      const decided = new Set()
      let approvalId
      for (let i = events.length - 1; i >= 0; i -= 1) {
        const event = events[i]
        if (event.type === 'approval/decided') decided.add(event.data.id)
        else if (event.type === 'approval/asked') {
          if (decided.has(event.data.id)) continue
          if ((req.callId ?? null) !== (event.data.callId ?? null)) continue
          approvalId = event.data.id
          break
        }
      }
      if (approvalId === undefined) return next()
      return new Promise((resolve) => {
        const settle = (outcome) => {
          pendingApprovals.delete(approvalId)
          req.signal?.removeEventListener('abort', onAbort)
          resolve(outcome)
        }
        const onAbort = () => settle('cancelled')
        req.signal?.addEventListener('abort', onAbort, { once: true })
        pendingApprovals.set(approvalId, {
          approvalId: approvalId,
          sessionId: req.agent.session.id,
          toolName: req.toolName,
          callId: req.callId,
          reason: req.reason,
          resolve: settle,
        })
      })
    })

    ctx.effect(() => () => {
      // 插件卸载时取消所有待审批，避免 agent 永久阻塞
      for (const entry of pendingApprovals.values()) entry.resolve('cancelled')
      pendingApprovals.clear()
    }, 'hud: approval cleanup')

    // ---------- 模型 / 推理强度切换（服务惰性获取） ----------
    const selections = new Map()
    const catalogCache = { at: 0, value: null }
    const MODEL_TTL = 60000

    ctx.on('llm/adapters-updated', () => { catalogCache.value = null })

    async function modelCatalog() {
      const now = Date.now()
      if (catalogCache.value !== null && now - catalogCache.at < MODEL_TTL) return catalogCache.value
      const llm = ctx.get('llm')
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
      const adm = ctx.get('agentDefaultModel')
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
    }, 'hud: model selection cleanup')

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
      const empty = { rows: [], status: 'idle', missing: true, approvals: [] }
      if (!sessionId) return empty
      const sessions = ctx.get('sessions')
      const live = sessions ? sessions.get(sessionId) : undefined
      const persistence = ctx.get('sessionPersistence')
      let events = null
      let source = 'live'
      let header = null
      if (live) {
        events = live.events
        header = live.header
      } else if (persistence) {
        try {
          const res = await persistence.readFrom(sessionId, 0)
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
        } else if (persistence) {
          try {
            tail = (await persistence.readFrom(sessionId, buffer.seq + 1)).events
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
      const agents = ctx.get('agents')
      const agent = agents ? agents.get(sessionId) : undefined
      const status = agent ? (agent.status === 'running' ? 'running' : 'idle') : 'idle'
      const approvals = Array.from(pendingApprovals.values())
        .filter((a) => a.sessionId === sessionId)
        .map((a) => ({ approvalId: a.approvalId, toolName: a.toolName, callId: a.callId, reason: a.reason }))
      return {
        rows: buffer.rows,
        status: status,
        cwd: header && header.cwd ? header.cwd : null,
        source: source,
        missing: false,
        approvals: approvals,
      }
    }

    // ---------- HTTP 端点 ----------
    const routes = [
      {
        kind: 'exact',
        path: '/hud-api/debug',
        handler: async (req, res) => {
          sendJson(res, 200, {
            hudOpen,
            approvalListenerActive,
            pendingCount: pendingApprovals.size,
            pendingIds: Array.from(pendingApprovals.keys()),
          })
        },
      },
      {
        kind: 'exact',
        path: '/hud-api/set-open',
        handler: async (req, res) => {
          const body = await readBody(req)
          if (typeof body.open === 'boolean') hudOpen = body.open
          sendJson(res, 200, { ok: true })
        },
      },
      {
        kind: 'exact',
        path: '/hud-api/approve',
        handler: async (req, res) => {
          const body = await readBody(req)
          const approvalId = typeof body.approvalId === 'string' ? body.approvalId : ''
          const outcome = body.outcome === 'allowed-once' || body.outcome === 'rejected' ? body.outcome : null
          if (!approvalId || !outcome) {
            sendJson(res, 400, { ok: false, error: 'bad-args' })
            return
          }
          const entry = pendingApprovals.get(approvalId)
          if (!entry) {
            sendJson(res, 404, { ok: false, error: 'not-pending' })
            return
          }
          entry.resolve(outcome)
          sendJson(res, 200, { ok: true })
        },
      },
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
          const agents = ctx.get('agents')
          const agent = agents ? agents.get(sessionId) : undefined
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
          const agents = ctx.get('agents')
          const agent = agents ? agents.get(sessionId) : undefined
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
          const agents = ctx.get('agents')
          const agent = agents ? agents.get(sessionId) : undefined
          if (!agent) {
            sendJson(res, 409, { ok: false, error: 'not-live' })
            return
          }
          const llm = ctx.get('llm')
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
            const adm = ctx.get('agentDefaultModel')
            if (adm) {
              try {
                await adm.saveSelection({ provider: selected.provider, model: selected.model, ...(selected.reasoningEffort === undefined ? {} : { reasoningEffort: selected.reasoningEffort }) })
              } catch (error) { /* best-effort */ }
            }
            sendJson(res, 200, { ok: true, selected: selected })
          } catch (error) {
            sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) })
          }
        },
      },
    ]

    // 路由注册等待 webServer 服务（仅此部分延迟，不影响 approval listener 顺序）
    ctx.inject(['webServer'], (wsCtx) => {
      const disposers = routes.map((route) => wsCtx.webServer.register(route))
      ctx.effect(() => () => {
        for (const dispose of disposers) {
          try { dispose() } catch (error) { /* ignore */ }
        }
      }, 'hud: route cleanup')
    })
  },
}
