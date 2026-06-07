<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useDashboard } from '../composables/useDashboard'

const STORAGE_KEY = 'wind-agent-custom-algorithms'

const {
  experimentModules,
  heuristicExamples,
  gaExamples,
  actionCatalog,
  rlComparison,
  algorithmSimulation,
  ensureDashboardLoaded,
  fmt,
} = useDashboard()

// ---- 算法模拟对比 ----
const simData = computed(() => algorithmSimulation.value)
const strategies = computed(() => simData.value?.strategies || [])
const selectedStratKey = ref('')
const colors = ['#ff9800', '#03a9f4', '#e91e63', '#9c27b0', '#ff5722', '#00bcd4']

// 每条策略线的显隐状态
const stratVisible = reactive({})

watch(strategies, (s) => {
  s.forEach(st => { if (!(st.key in stratVisible)) stratVisible[st.key] = true })
}, { immediate: true })

function toggleStrat(key) { stratVisible[key] = !stratVisible[key] }

// 构建策略对比 SVG 图
const simSvgMarkup = computed(() => {
  const strats = strategies.value
  if (!strats.length) return ''
  const W = 920; const H = 260; const P = 30

  const series0 = strats[0].dispatch_series || []
  const maxLen = series0.length || 1
  const actualVals = series0.map(r => Number(r.actual_power_mw) || 0)
  const maxV = Math.max(...actualVals, 1)

  function pathFromSeries(series, key) {
    if (!series.length) return ''
    // 超过600点时降采样
    const step = series.length > 600 ? Math.ceil(series.length / 600) : 1
    const pts = series.filter((_, i) => i % step === 0)
    return pts.map((r, i) => {
      const x = P + (i / Math.max(pts.length - 1, 1)) * (W - P * 2)
      const y = H - P - ((Number(r[key]) || 0) / maxV) * (H - P * 2)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
  }

  const actualPath = pathFromSeries(series0, 'actual_power_mw')
  const grid = Array.from({length: 4}, (_, i) => {
    const y = P + ((H - P*2) / 3) * i
    const v = maxV - (maxV / 3) * i
    return `<line x1="${P}" y1="${y}" x2="${W-P}" y2="${y}" class="gridline"/>
      <text x="8" y="${y+3}" class="axis-label">${fmt(v,0)}</text>`
  }).join('')

  // 只渲染可见的策略线
  const stratPaths = strats.map((s, i) => {
    if (!stratVisible[s.key]) return ''
    const p = pathFromSeries(s.dispatch_series || [], 'dispatch_power_mw')
    const c = colors[i % colors.length]
    return `<path d="${p}" fill="none" stroke="${c}" stroke-width="2.5" opacity="0.75"/>`
  }).filter(Boolean).join('\n')

  const labels = [0, Math.floor(maxLen*0.25), Math.floor(maxLen*0.5), Math.floor(maxLen*0.75), maxLen-1]
    .map(i => {
      const idx = Math.min(i, maxLen-1)
      const pt = series0[idx]
      const x = P + (idx / Math.max(maxLen-1, 1)) * (W - P*2)
      return `<text x="${x}" y="${H-8}" text-anchor="middle" class="axis-label">${pt?.timestamp||''}</text>`
    }).join('')

  return `${grid}\n<path d="${actualPath}" class="path-actual"/>\n${stratPaths}\n${labels}`
})

function selectStrat(key) { selectedStratKey.value = key }

// ---- 自定义算法 ----
const customAlgorithms = ref([])
const form = ref({ name: '', module: '', description: '', avg_reward: '', incident_rate: '', note: '' })

const allAlgorithms = computed(() => [...experimentModules.value, ...customAlgorithms.value])

function persistCustomAlgorithms() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(customAlgorithms.value))
}
function loadCustomAlgorithms() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) customAlgorithms.value = parsed
    }
  } catch { customAlgorithms.value = [] }
}
function resetForm() { form.value = { name: '', module: '', description: '', avg_reward: '', incident_rate: '', note: '' } }
function addCustomAlgorithm() {
  const { name, module, description } = form.value
  if (!name.trim() || !module.trim() || !description.trim()) return
  customAlgorithms.value.unshift({
    module: module.trim(), algorithm: name.trim(), description: description.trim(),
    avg_reward: Number(form.value.avg_reward) || 0,
    incident_rate: Number(form.value.incident_rate) || 0,
    note: form.value.note.trim(), isCustom: true, id: `custom-${Date.now()}`,
  })
  resetForm()
}
function removeCustomAlgorithm(id) {
  customAlgorithms.value = customAlgorithms.value.filter(item => item.id !== id)
}
watch(customAlgorithms, persistCustomAlgorithms, { deep: true })

onMounted(() => {
  ensureDashboardLoaded()
  loadCustomAlgorithms()
  if (strategies.value.length && !selectedStratKey.value) {
    selectedStratKey.value = strategies.value[0].key
  }
})
</script>

<template>
  <div class="page-grid">
    <!-- 算法模拟 vs 真实值 对比大图 -->
    <section v-if="simData" class="page-panel wide-panel">
      <div class="panel-head">
        <div>
          <p class="eyebrow">算法模拟分析</p>
          <h3>各策略调度输出 vs 实际功率 — 差距分析</h3>
          <p>{{ simData.description }} 绿色=实际功率，彩色线=各策略的调度输出。调度线越贴近绿线且不低太多，策略越好。</p>
        </div>
        <div class="data-badge">
          <span>最优策略</span>
          <strong>{{ simData.best_strategy }}</strong>
          <small>收益差幅 {{ fmt(simData.reward_spread) }}</small>
        </div>
      </div>

      <div class="chart-surface">
        <svg viewBox="0 0 920 280" preserveAspectRatio="none" class="power-chart" v-html="simSvgMarkup"></svg>
        <div class="chart-legend clickable">
          <span><i class="legend-swatch actual"></i>实际功率</span>
          <template v-for="(s, i) in strategies" :key="s.key">
            <span @click="toggleStrat(s.key)" :class="{ dimmed: !stratVisible[s.key] }">
              <i class="legend-swatch" :style="{background: colors[i % colors.length]}"></i>{{ s.label }}
            </span>
          </template>
        </div>
      </div>
    </section>

    <!-- 策略模拟结果对比表 -->
    <section v-if="strategies.length" class="page-panel wide-panel">
      <div class="panel-head">
        <div>
          <p class="eyebrow">策略对比</p>
          <h3>各策略在验证集上的模拟调度结果</h3>
          <p>在同一段验证数据上运行每种调度策略，对比累计收益、事故次数和能量利用率。能量利用率越接近100%且事故越少，策略越优。</p>
        </div>
      </div>
      <div class="pred-site-table">
        <div class="pred-table-row head">
          <span>策略</span><span>累计收益</span><span>事故次数</span><span>实际总电量</span><span>调度总电量</span><span>能量利用率</span>
        </div>
        <div
          v-for="s in strategies"
          :key="s.key"
          class="pred-table-row"
          :class="{ active: s.key === selectedStratKey }"
          style="cursor:pointer"
          @click="selectStrat(s.key)"
        >
          <strong>{{ s.label }}</strong>
          <span>{{ fmt(s.total_reward) }}</span>
          <span>{{ s.incident_count }}</span>
          <span>{{ fmt(s.actual_energy_mwh) }} MWh</span>
          <span>{{ fmt(s.dispatched_energy_mwh) }} MWh</span>
          <span :style="{color: s.energy_utilization_pct > 90 ? '#81c784' : s.energy_utilization_pct > 75 ? '#ff9f5f' : '#ff7061'}">{{ fmt(s.energy_utilization_pct) }}%</span>
        </div>
      </div>
    </section>

    <!-- 内置实验模块 -->
    <section class="page-panel wide-panel">
      <div class="panel-head">
        <div>
          <p class="eyebrow">实验矩阵</p>
          <h3>内置算法实验模块</h3>
          <p>系统内置的五种实验方法概览。</p>
        </div>
      </div>
      <div class="experiment-grid">
        <article v-for="item in allAlgorithms" :key="item.id || item.module" class="experiment-card large" :class="{ 'custom-algorithm-card': item.isCustom }">
          <div class="experiment-head">
            <span>{{ item.module }}</span>
            <button v-if="item.isCustom" type="button" class="delete-chip" @click="removeCustomAlgorithm(item.id)">移除</button>
          </div>
          <strong>{{ item.algorithm }}</strong>
          <p>{{ item.description }}</p>
          <div class="mini-kpis">
            <div class="mini-kpi"><span>平均回报</span><strong>{{ fmt(item.avg_reward) }}</strong></div>
            <div class="mini-kpi"><span>事故率</span><strong>{{ fmt(item.incident_rate, 4) }}</strong></div>
          </div>
          <small v-if="item.note">{{ item.note }}</small>
        </article>
      </div>
    </section>

    <!-- 动作目录 + 样例 -->
    <section class="dual-grid">
      <article class="page-panel">
        <div class="panel-head"><div><p class="eyebrow">动作目录</p><h3>四种调度动作</h3></div></div>
        <div class="action-grid">
          <article v-for="item in actionCatalog" :key="item.id" class="action-card">
            <span>{{ item.label_zh || item.name }}</span>
            <strong>{{ item.name }}</strong>
            <small>{{ item.description }}</small>
            <div class="action-tags">
              <span>预留 {{ fmt(item.reserve_factor, 2) }}</span>
              <span>调度 {{ fmt(item.dispatch_factor, 2) }}</span>
              <span>维护 {{ fmt(item.maintenance_factor, 2) }}</span>
            </div>
          </article>
        </div>
      </article>

      <article class="page-panel">
        <div class="panel-head"><div><p class="eyebrow">样例展示</p><h3>启发式与遗传算法样例</h3></div></div>
        <div v-if="heuristicExamples.length">
          <p class="eyebrow" style="margin:8px 0">启发式搜索</p>
          <article v-for="item in heuristicExamples.slice(0, 1)" :key="`h-${item.date}`" class="example-card">
            <span>{{ item.site_id }} · {{ item.date }}</span>
            <strong>回报 {{ fmt(item.reward) }} / 事故率 {{ fmt(item.incident_rate, 4) }}</strong>
            <div class="action-seq">{{ item.actions.join(' → ') }}</div>
          </article>
        </div>
        <div v-if="gaExamples.length" style="margin-top:12px">
          <p class="eyebrow" style="margin:8px 0">遗传算法</p>
          <article v-for="item in gaExamples.slice(0, 1)" :key="`g-${item.date}`" class="example-card">
            <span>{{ item.site_id }} · {{ item.date }}</span>
            <strong>回报 {{ fmt(item.reward) }} / 事故率 {{ fmt(item.incident_rate, 4) }}</strong>
            <div class="action-seq">{{ item.actions.join(' → ') }}</div>
          </article>
        </div>
      </article>
    </section>

    <!-- 新增自定义算法 -->
    <section class="dual-grid">
      <article class="page-panel">
        <div class="panel-head"><div><p class="eyebrow">扩展入口</p><h3>新增自定义算法</h3></div></div>
        <div class="algorithm-form-grid">
          <label class="form-field"><span>算法名称</span><input v-model="form.name" class="filter-input" placeholder="例如：PPO" /></label>
          <label class="form-field"><span>模块名</span><input v-model="form.module" class="filter-input" placeholder="例如：自定义实验A" /></label>
          <label class="form-field form-field-wide"><span>说明</span><textarea v-model="form.description" placeholder="核心思想和与现有策略差异"></textarea></label>
          <label class="form-field"><span>平均回报</span><input v-model="form.avg_reward" class="filter-input" type="number" step="0.01" /></label>
          <label class="form-field"><span>事故率</span><input v-model="form.incident_rate" class="filter-input" type="number" step="0.0001" /></label>
          <label class="form-field form-field-wide"><span>备注</span><input v-model="form.note" class="filter-input" placeholder="适合场景" /></label>
        </div>
        <div class="export-row"><button class="button primary" @click="addCustomAlgorithm">加入实验矩阵</button></div>
      </article>

      <article class="page-panel">
        <div class="panel-head"><div><p class="eyebrow">策略对比摘要</p><h3>各策略核心表现</h3></div></div>
        <div class="summary-stack">
          <article v-for="item in rlComparison" :key="item.policy" class="summary-line-card">
            <span>{{ item.policy }}</span>
            <strong>{{ item.dominant_action }}</strong>
            <small>平均回报 {{ fmt(item.avg_reward) }} · 事故率 {{ fmt(item.incident_rate, 3) }}</small>
          </article>
        </div>
      </article>
    </section>
  </div>
</template>
