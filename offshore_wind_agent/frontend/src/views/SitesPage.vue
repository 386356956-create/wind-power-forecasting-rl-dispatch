<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useDashboard } from '../composables/useDashboard'
import FujianMapCard from '../components/FujianMapCard.vue'
import PowerChart from '../components/PowerChart.vue'

const {
  stationOverview,
  currentSite,
  currentSiteId,
  dailySummary,
  siteTopWindows,
  ensureDashboardLoaded,
  ensureSiteLoaded,
  fmt,
  riskTone,
} = useDashboard()

const searchKeyword = ref('')
const riskFilter = ref('all')
const chartMode = ref('compare')
const drawerOpen = ref(false)
const hoveredWindow = ref(null)
const selectedDate = ref('')
const datePage = ref(0)
const DATES_PER_PAGE = 14

const filteredStations = computed(() => {
  return stationOverview.value.filter((site) => {
    const keyword = searchKeyword.value.trim().toLowerCase()
    const keywordMatch =
      !keyword ||
      site.site_name.toLowerCase().includes(keyword) ||
      site.site_id.toLowerCase().includes(keyword)
    const tone = riskTone(site.avg_risk)
    const riskMatch = riskFilter.value === 'all' || tone === riskFilter.value
    return keywordMatch && riskMatch
  })
})

const availableDates = computed(() => dailySummary.value.map((row) => row.date))

const selectedDailyRow = computed(() => {
  const target = selectedDate.value || availableDates.value[0]
  return dailySummary.value.find((row) => row.date === target) || null
})

const riskLevelLabel = computed(() => {
  if (!selectedDailyRow.value) return '--'
  const tone = riskTone(selectedDailyRow.value.avg_risk)
  if (tone === 'high') return '高风险日'
  if (tone === 'medium') return '中风险日'
  return '低风险日'
})

// 选中日期的实际vs预测对比
const dailyComparison = computed(() => {
  if (!selectedDailyRow.value) return null
  const row = selectedDailyRow.value
  const actualEnergy = row.total_actual_mwh || (row.actual_avg * 24 * 0.25)
  const predictedEnergy = row.total_predicted_mwh || (row.predicted_avg * 24 * 0.25)
  return {
    actual: fmt(actualEnergy),
    predicted: fmt(predictedEnergy),
    diff: fmt(actualEnergy - predictedEnergy),
  }
})

watch(filteredStations, async (sites) => {
  if (!sites.length) return
  if (!sites.some((site) => site.site_id === currentSiteId.value)) {
    await ensureSiteLoaded(sites[0].site_id)
  }
})

watch(availableDates, (dates) => {
  if (!dates.length) {
    selectedDate.value = ''
    return
  }
  if (!dates.includes(selectedDate.value)) {
    selectedDate.value = dates[0]
  }
})

onMounted(async () => {
  await ensureDashboardLoaded()
  if (currentSiteId.value) {
    await ensureSiteLoaded(currentSiteId.value)
  }
  selectedDate.value = availableDates.value[0] || ''
})

// 分页日期列表
const paginatedDates = computed(() => {
  const all = availableDates.value
  const start = datePage.value * DATES_PER_PAGE
  return all.slice(start, start + DATES_PER_PAGE)
})
const totalDatePages = computed(() => Math.ceil(availableDates.value.length / DATES_PER_PAGE))
const canPrevDatePage = computed(() => datePage.value > 0)
const canNextDatePage = computed(() => datePage.value < totalDatePages.value - 1)

function openDrawer() {
  drawerOpen.value = true
}

function closeDrawer() {
  drawerOpen.value = false
}
</script>

<template>
  <div class="page-grid">
    <!-- 站点搜索与筛选 -->
    <section class="page-panel filter-panel">
      <div class="panel-head">
        <div>
          <p class="eyebrow">站点控制</p>
          <h3>站点搜索与风险筛选</h3>
          <p>按站点名称、编号和风险等级筛选福建风电场，快速进入目标站点验证详情。</p>
        </div>
      </div>
      <div class="filter-row">
        <input v-model="searchKeyword" class="filter-input" type="text" placeholder="搜索站点名称或站点编号" />
        <select v-model="riskFilter">
          <option value="all">全部风险等级</option>
          <option value="high">高风险</option>
          <option value="medium">中风险</option>
          <option value="low">低风险</option>
        </select>
      </div>
      <div class="station-list-grid">
        <button
          v-for="site in filteredStations"
          :key="site.site_id"
          type="button"
          class="station-summary-card"
          :class="{ active: site.site_id === currentSiteId }"
          @click="ensureSiteLoaded(site.site_id)"
        >
          <span>{{ site.region }}</span>
          <strong>{{ site.site_name }}</strong>
          <small>{{ site.site_id.toUpperCase() }} · {{ fmt(site.capacity_mw, 0) }} MW · MAE {{ fmt(site.site_mae_mw) }} MW</small>
          <div class="fleet-tags">
            <span>风险 {{ fmt(site.avg_risk, 3) }}</span>
            <span>{{ site.dominant_action }}</span>
          </div>
        </button>
      </div>
    </section>

    <!-- 地图 + 站点验证曲线 -->
    <section class="dual-grid">
      <article class="page-panel">
        <div class="panel-head">
          <div>
            <p class="eyebrow">福建风场地图</p>
            <h3>福建风电场分布</h3>
            <p>用发光联动地图展示站点位置与风险状态。</p>
          </div>
        </div>
        <FujianMapCard
          :stations="filteredStations"
          :current-site-id="currentSiteId"
          :risk-tone="riskTone"
          :fmt="fmt"
          :selected-site="currentSite"
        />
      </article>

      <article class="page-panel">
        <div class="panel-head">
          <div>
            <p class="eyebrow">验证集曲线</p>
            <h3>{{ currentSite?.site_name || '选择站点' }} — 预测 vs 实际功率</h3>
            <p>绿色=实际功率，青色=模型输出，橙色=调度建议。可用下方按钮切换视图和缩放。</p>
          </div>
          <div class="chip-group">
            <button type="button" class="mode-chip" :class="{ active: chartMode === 'compare' }" @click="chartMode = 'compare'">预测vs实际</button>
            <button type="button" class="mode-chip" :class="{ active: chartMode === 'dispatch' }" @click="chartMode = 'dispatch'">调度聚焦</button>
            <button type="button" class="mode-chip" :class="{ active: chartMode === 'risk' }" @click="chartMode = 'risk'">风险走势</button>
          </div>
        </div>
        <PowerChart
          :series="currentSite?.forecast_series || []"
          :fmt="fmt"
          :view-mode="chartMode"
          :validation-mode="true"
        />
      </article>
    </section>

    <!-- 日汇总 + 高风险窗口 -->
    <section class="dual-grid">
      <article class="page-panel">
        <div class="panel-head">
          <div>
            <p class="eyebrow">日期检索</p>
            <h3>验证集日汇总 — 预测 vs 实际</h3>
            <p>共 {{ availableDates.length }} 天验证数据。选择一个日期查看该日的实际与预测对比。</p>
          </div>
        </div>

        <div v-if="selectedDailyRow" class="daily-focus-layout">
          <article class="daily-focus-card">
            <div class="daily-card-top">
              <strong>{{ selectedDailyRow.date }}</strong>
              <span class="risk-pill" :class="riskTone(selectedDailyRow.avg_risk)">{{ riskLevelLabel }}</span>
            </div>
            <div class="daily-focus-metrics">
              <div>
                <span>实际均值</span>
                <strong>{{ fmt(selectedDailyRow.actual_avg) }} MW</strong>
              </div>
              <div>
                <span>预测均值</span>
                <strong>{{ fmt(selectedDailyRow.predicted_avg) }} MW</strong>
              </div>
              <div>
                <span>实际峰值</span>
                <strong>{{ fmt(selectedDailyRow.actual_peak) }} MW</strong>
              </div>
              <div>
                <span>预测峰值</span>
                <strong>{{ fmt(selectedDailyRow.predicted_peak) }} MW</strong>
              </div>
              <div>
                <span>当日实际电量</span>
                <strong>{{ dailyComparison?.actual }} MWh</strong>
              </div>
              <div>
                <span>当日预测电量</span>
                <strong>{{ dailyComparison?.predicted }} MWh</strong>
              </div>
              <div>
                <span>平均误差</span>
                <strong>{{ fmt(selectedDailyRow.avg_error) }} MW</strong>
              </div>
              <div>
                <span>电量偏差</span>
                <strong>{{ dailyComparison?.diff }} MWh</strong>
              </div>
            </div>
          </article>

          <!-- 分页日期导航 -->
          <div class="date-nav-bar">
            <button type="button" class="mode-chip" :disabled="!canPrevDatePage" @click="datePage--">◀ 前14天</button>
            <span class="range-label">第 {{ datePage + 1 }}/{{ totalDatePages }} 页</span>
            <button type="button" class="mode-chip" :disabled="!canNextDatePage" @click="datePage++">后14天 ▶</button>
          </div>
          <div class="daily-mini-calendar">
            <button
              v-for="date in paginatedDates"
              :key="date"
              type="button"
              class="mini-date-chip"
              :class="{ active: selectedDate === date }"
              @click="selectedDate = date"
            >
              {{ date.slice(5) }}
            </button>
          </div>
        </div>
      </article>

      <article class="page-panel">
        <div class="panel-head">
          <div>
            <p class="eyebrow">悬浮情报</p>
            <h3>高风险窗口详情</h3>
            <p>展示当前站点在验证集中风险最高的时段，含实际与预测对比。</p>
          </div>
        </div>
        <div class="table-list">
          <div
            v-for="row in siteTopWindows"
            :key="row.timestamp"
            class="table-row table-row-site"
            @mouseenter="hoveredWindow = row"
            @mouseleave="hoveredWindow = null"
          >
            <strong>{{ row.timestamp }}</strong>
            <span>实际 {{ fmt(row.actual_power_mw) }} / 预测 {{ fmt(row.predicted_power_mw) }} MW</span>
            <span class="risk-pill" :class="riskTone(row.risk_score)">{{ fmt(row.risk_score, 3) }}</span>
            <span>{{ row.action_label }}</span>
          </div>
        </div>
        <div v-if="hoveredWindow" class="hover-detail-card">
          <span>悬浮情报</span>
          <strong>{{ hoveredWindow.timestamp }}</strong>
          <small>
            风险 {{ fmt(hoveredWindow.risk_score, 3) }} ·
            实际 {{ fmt(hoveredWindow.actual_power_mw) }} MW ·
            预测 {{ fmt(hoveredWindow.predicted_power_mw) }} MW ·
            误差 {{ fmt(Math.abs(hoveredWindow.actual_power_mw - hoveredWindow.predicted_power_mw), 3) }} MW ·
            建议 {{ hoveredWindow.action_label }}
          </small>
        </div>
      </article>
    </section>

    <!-- 站点详情抽屉 -->
    <transition name="drawer-fade">
      <aside v-if="drawerOpen && currentSite" class="site-drawer-mask" @click.self="closeDrawer">
        <div class="site-drawer">
          <div class="panel-head">
            <div>
              <p class="eyebrow">站点详情抽屉</p>
              <h3>{{ currentSite.site_name }}</h3>
              <p>{{ currentSite.data_source || '验证集数据，含真实功率可对比' }}</p>
            </div>
            <button type="button" class="button ghost" @click="closeDrawer">关闭</button>
          </div>

          <div class="drawer-metrics">
            <article class="drawer-tile">
              <span>装机容量</span>
              <strong>{{ fmt(currentSite.capacity_mw, 0) }} MW</strong>
            </article>
            <article class="drawer-tile">
              <span>站点 MAE</span>
              <strong>{{ fmt(currentSite.site_mae_mw) }} MW</strong>
            </article>
            <article class="drawer-tile">
              <span>实际均值</span>
              <strong>{{ fmt(currentSite.actual_mean_mw) }} MW</strong>
            </article>
            <article class="drawer-tile">
              <span>预测均值</span>
              <strong>{{ fmt(currentSite.predicted_mean_mw) }} MW</strong>
            </article>
            <article class="drawer-tile">
              <span>平均风险</span>
              <strong>{{ fmt(currentSite.avg_risk, 3) }}</strong>
            </article>
            <article class="drawer-tile">
              <span>主导动作</span>
              <strong>{{ currentSite.dominant_action }}</strong>
            </article>
          </div>

          <div class="drawer-section">
            <span>近端高风险建议</span>
            <div class="summary-stack">
              <article v-for="row in siteTopWindows.slice(0, 4)" :key="row.timestamp" class="summary-line-card">
                <span>{{ row.timestamp }}</span>
                <strong>{{ row.action_label }}</strong>
                <small>风险 {{ fmt(row.risk_score, 3) }} · 实际 {{ fmt(row.actual_power_mw) }} MW · 预测 {{ fmt(row.predicted_power_mw) }} MW</small>
              </article>
            </div>
          </div>
        </div>
      </aside>
    </transition>
  </div>
</template>
