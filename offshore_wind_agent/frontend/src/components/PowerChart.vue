<script setup>
import { computed, reactive, ref, watch } from 'vue'

const props = defineProps({
  series: { type: Array, default: () => [] },
  fmt: { type: Function, required: true },
  viewMode: { type: String, default: 'compare' },
  validationMode: { type: Boolean, default: false },
})

// ---- 曲线显隐状态 ----
const lineVisible = reactive({
  actual: true,
  predicted: true,
  dispatch: true,
  risk: false,
})

function toggleLine(key) {
  lineVisible[key] = !lineVisible[key]
}

// ---- 时间窗口 ----
const windowStart = ref(0)
const windowSize = ref(192)
const maxStart = computed(() => Math.max(0, props.series.length - windowSize.value))

watch(() => props.series.length, () => { windowStart.value = 0 })

const visibleSeries = computed(() => {
  const raw = props.series.slice(windowStart.value, windowStart.value + windowSize.value)
  if (raw.length <= 600) return raw
  const step = Math.ceil(raw.length / 600)
  return raw.filter((_, i) => i % step === 0)
})

const timeRangeLabel = computed(() => {
  if (!visibleSeries.value.length) return ''
  const f = visibleSeries.value[0]?.timestamp || ''
  const l = visibleSeries.value[visibleSeries.value.length - 1]?.timestamp || ''
  return `${f} ~ ${l}`
})

const totalRangeLabel = computed(() => {
  if (!props.series.length) return ''
  const f = props.series[0]?.timestamp || ''
  const l = props.series[props.series.length - 1]?.timestamp || ''
  return `${f} ~ ${l}  (共${props.series.length}个时间片)`
})

// ---- SVG 渲染 ----
function buildSvg() {
  const vs = visibleSeries.value
  if (!vs.length) return ''
  const W = 920; const H = 280; const P = 30

  const hasActual = props.validationMode && vs.some(r => Number(r.actual_power_mw) > 0)
  const predicted = vs.map(r => Number(r.predicted_power_mw) || 0)
  const actual = hasActual ? vs.map(r => Number(r.actual_power_mw) || 0) : []
  const dispatch = vs.map(r => Number(r.dispatch_power_mw) || 0)
  const risk = vs.map(r => Number(r.risk_score) || 0)

  const useRiskScale = props.viewMode === 'risk'
  const allVals = [...predicted, ...dispatch, ...actual]
  const maxV = useRiskScale ? 1 : Math.max(...allVals, 1e-6)

  function path(vals) {
    if (!vals.length) return ''
    return vals.map((v, i) => {
      const x = P + (i / Math.max(vals.length - 1, 1)) * (W - P * 2)
      const y = H - P - (v / maxV) * (H - P * 2)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
  }

  const grid = Array.from({ length: 5 }, (_, i) => {
    const y = P + ((H - P * 2) / 4) * i
    const v = useRiskScale ? 1 - i * 0.25 : maxV - (maxV / 4) * i
    return `<line x1="${P}" y1="${y}" x2="${W-P}" y2="${y}" class="gridline"/>
      <text x="8" y="${y+4}" class="axis-label">${useRiskScale ? props.fmt(v, 2) : props.fmt(v, 0) + ' MW'}</text>`
  }).join('')

  const labels = [0, Math.floor(vs.length * 0.25), Math.floor(vs.length * 0.5), Math.floor(vs.length * 0.75), vs.length - 1]
    .map(i => {
      const pt = vs[Math.min(i, vs.length - 1)]
      const x = P + (i / Math.max(vs.length - 1, 1)) * (W - P * 2)
      return `<text x="${x}" y="${H-8}" text-anchor="middle" class="axis-label">${pt?.timestamp || ''}</text>`
    }).join('')

  let paths = ''
  if (useRiskScale && lineVisible.risk) {
    paths += `<path d="${path(risk)}" class="path-risk"/>`
  } else {
    if (hasActual && lineVisible.actual) paths += `<path d="${path(actual)}" class="path-actual"/>`
    if (lineVisible.predicted) paths += `<path d="${path(predicted)}" class="path-forecast"/>`
    if (lineVisible.dispatch) paths += `<path d="${path(dispatch)}" class="path-dispatch"/>`
  }
  return `${grid}\n${paths}\n${labels}`
}

const svgMarkup = computed(() => buildSvg())

// ---- 时间轴拖杆 ----
const isDragging = ref(false)
const scrubberRef = ref(null)

function scrubberLeft() {
  if (!props.series.length) return 0
  return (windowStart.value / props.series.length) * 100
}
function scrubberWidth() {
  if (!props.series.length) return 100
  return (windowSize.value / props.series.length) * 100
}

function onScrubberMouseDown(e) {
  isDragging.value = true
  document.addEventListener('mousemove', onScrubberMouseMove)
  document.addEventListener('mouseup', onScrubberMouseUp)
}

function onScrubberMouseMove(e) {
  if (!isDragging.value || !props.series.length) return
  const bar = document.querySelector('.scrubber-bar')
  if (!bar) return
  const rect = bar.getBoundingClientRect()
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  windowStart.value = Math.round(pct * maxStart.value)
  windowStart.value = Math.max(0, Math.min(maxStart.value, windowStart.value))
}

function onScrubberMouseUp() {
  isDragging.value = false
  document.removeEventListener('mousemove', onScrubberMouseMove)
  document.removeEventListener('mouseup', onScrubberMouseUp)
}

function scrollWindow(d) { windowStart.value = Math.max(0, Math.min(maxStart.value, windowStart.value + d)) }
function zoomTo(days) { windowSize.value = days * 96; windowStart.value = Math.min(windowStart.value, maxStart.value) }
</script>

<template>
  <div class="chart-surface">
    <!-- 控制栏 -->
    <div class="chart-controls">
      <div class="zoom-group">
        <button class="mode-chip" :class="{active:windowSize===96}" @click="zoomTo(1)">1天</button>
        <button class="mode-chip" :class="{active:windowSize===192}" @click="zoomTo(2)">2天</button>
        <button class="mode-chip" :class="{active:windowSize===480}" @click="zoomTo(5)">5天</button>
        <button class="mode-chip" :class="{active:windowSize===960}" @click="zoomTo(10)">10天</button>
        <button class="mode-chip" :class="{active:windowSize>=series.length}" @click="windowSize=series.length;windowStart=0">全部</button>
      </div>
      <div class="scroll-group">
        <button class="mode-chip" :disabled="windowStart===0" @click="scrollWindow(-96)">◀</button>
        <span class="range-label">{{ timeRangeLabel }}</span>
        <button class="mode-chip" :disabled="windowStart>=maxStart" @click="scrollWindow(96)">▶</button>
      </div>
    </div>

    <!-- 时间轴拖杆 -->
    <div v-if="series.length > windowSize" class="scrubber-bar" @mousedown="onScrubberMouseDown">
      <div class="scrubber-track">
        <div class="scrubber-window" :style="{left:scrubberLeft()+'%', width:scrubberWidth()+'%'}"></div>
      </div>
      <div class="scrubber-label">{{ totalRangeLabel }}</div>
    </div>

    <!-- SVG 图表 -->
    <svg viewBox="0 0 920 280" preserveAspectRatio="none" class="power-chart" v-html="svgMarkup"></svg>

    <!-- 可点击图例 (风险线默认不显示) -->
    <div class="chart-legend clickable">
      <span v-if="validationMode" @click="toggleLine('actual')" :class="{ dimmed: !lineVisible.actual }">
        <i class="legend-swatch actual"></i>实际功率
      </span>
      <span @click="toggleLine('predicted')" :class="{ dimmed: !lineVisible.predicted }">
        <i class="legend-swatch forecast"></i>模型预测
      </span>
      <span @click="toggleLine('dispatch')" :class="{ dimmed: !lineVisible.dispatch }">
        <i class="legend-swatch dispatch"></i>调度建议
      </span>
    </div>
  </div>
</template>
