import { computed, ref } from 'vue'
import { askAgent, fetchDashboard, fetchSite, getExportUrl } from '../services/agentApi'

const dashboard = ref(null)
const siteMap = ref({})
const currentSiteId = ref('')
const loading = ref(false)
const siteLoading = ref(false)
const asking = ref(false)
const errorMessage = ref('')
const answer = ref('等待提问...')
const answerMeta = ref('')

let dashboardPromise = null

const stationOverview = computed(() => dashboard.value?.station_overview || [])
const currentSite = computed(() => siteMap.value[currentSiteId.value] || null)
const summaryCards = computed(() => dashboard.value?.summary_cards || [])
const rlComparison = computed(() => dashboard.value?.rl_comparison || [])
const experimentModules = computed(() => dashboard.value?.experiment_modules || [])
const heuristicExamples = computed(() => dashboard.value?.heuristic_examples || [])
const gaExamples = computed(() => dashboard.value?.ga_examples || [])
const topRiskWindows = computed(() => dashboard.value?.top_risk_windows || [])
const actionCatalog = computed(() => dashboard.value?.action_catalog || [])
const agentBackend = computed(() => dashboard.value?.agent_backend || null)
const modelComparison = computed(() => dashboard.value?.model_comparison || {})
const rlAlgorithmComparison = computed(() => dashboard.value?.rl_algorithm_comparison || {})
const dailySummary = computed(() => currentSite.value?.daily_summary || [])
const siteTopWindows = computed(() => currentSite.value?.top_windows || [])
const exportForecastUrl = computed(() => getExportUrl('/export/forecast.csv'))
const exportReportUrl = computed(() => getExportUrl('/export/rl_report.json'))
const activeStation = computed(
  () => stationOverview.value.find((item) => item.site_id === currentSiteId.value) || null,
)

// ---- 新增: 验证集预测 vs 实际对比数据 ----
const validationComparison = computed(() => dashboard.value?.validation_comparison || null)
const algorithmSimulation = computed(() => dashboard.value?.algorithm_simulation || null)
const dataTimeline = computed(() => dashboard.value?.data_timeline || null)

function fmt(value, digits = 2) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric.toFixed(digits) : '--'
}

function riskTone(score) {
  const numeric = Number(score) || 0
  if (numeric >= 0.75) return 'high'
  if (numeric >= 0.45) return 'medium'
  return 'low'
}

function riskColor(score) {
  const safeScore = Math.max(0, Math.min(Number(score) || 0, 1))
  const hue = 148 - Math.round(safeScore * 138)
  return `hsl(${hue} 72% 48%)`
}

async function ensureDashboardLoaded(force = false) {
  if (dashboard.value && !force) return dashboard.value
  if (dashboardPromise && !force) return dashboardPromise

  loading.value = true
  errorMessage.value = ''
  dashboardPromise = fetchDashboard()
    .then(async (payload) => {
      dashboard.value = payload
      const firstSiteId = payload.station_overview?.[0]?.site_id || ''
      if (!currentSiteId.value && firstSiteId) {
        currentSiteId.value = firstSiteId
      }
      if (currentSiteId.value) {
        await ensureSiteLoaded(currentSiteId.value)
      }
      return payload
    })
    .catch((error) => {
      errorMessage.value = `加载仪表盘失败：${error instanceof Error ? error.message : '未知错误'}`
      throw error
    })
    .finally(() => {
      loading.value = false
      dashboardPromise = null
    })

  return dashboardPromise
}

async function ensureSiteLoaded(siteId) {
  if (!siteId) return null
  currentSiteId.value = siteId
  if (siteMap.value[siteId]) return siteMap.value[siteId]

  siteLoading.value = true
  try {
    const payload = await fetchSite(siteId)
    siteMap.value = {
      ...siteMap.value,
      [siteId]: payload,
    }
    return payload
  } catch (error) {
    errorMessage.value = `站点详情加载失败：${error instanceof Error ? error.message : '未知错误'}`
    throw error
  } finally {
    siteLoading.value = false
  }
}

async function submitQuestion(question) {
  const text = String(question || '').trim()
  if (!text) {
    answer.value = '请先输入问题。'
    answerMeta.value = ''
    return null
  }

  asking.value = true
  answer.value = '智能体正在分析问题，请稍候...'
  answerMeta.value = ''
  try {
    const payload = await askAgent(text)
    answer.value = payload.answer || '暂无回答。'
    answerMeta.value =
      payload.backend === 'ollama'
        ? `本次回答来自本地模型 ${payload.model || ''}`.trim()
        : '本次回答来自内置规则问答'
    return payload
  } catch (error) {
    answer.value = `提问失败：${error instanceof Error ? error.message : '未知错误'}`
    answerMeta.value = ''
    throw error
  } finally {
    asking.value = false
  }
}

export function useDashboard() {
  return {
    dashboard,
    siteMap,
    currentSiteId,
    loading,
    siteLoading,
    asking,
    errorMessage,
    answer,
    answerMeta,
    stationOverview,
    currentSite,
    summaryCards,
    rlComparison,
    experimentModules,
    heuristicExamples,
    gaExamples,
    topRiskWindows,
    actionCatalog,
    agentBackend,
    modelComparison,
    rlAlgorithmComparison,
    dailySummary,
    siteTopWindows,
    exportForecastUrl,
    exportReportUrl,
    activeStation,
    validationComparison,
    algorithmSimulation,
    dataTimeline,
    fmt,
    riskTone,
    riskColor,
    ensureDashboardLoaded,
    ensureSiteLoaded,
    submitQuestion,
  }
}
