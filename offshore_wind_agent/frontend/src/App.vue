<script setup>
import { computed, onMounted } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { useDashboard } from './composables/useDashboard'

const route = useRoute()
const {
  dashboard,
  loading,
  errorMessage,
  agentBackend,
  activeStation,
  stationOverview,
  summaryCards,
  ensureDashboardLoaded,
  fmt,
} = useDashboard()

const navItems = [
  { to: '/overview', label: '总览大屏', note: '精度验证、策略对比与风险监控' },
  { to: '/prediction', label: '预测分析', note: '纯预测vs实际对比、误差统计' },
  { to: '/sites', label: '站点驾驶舱', note: '地图、日汇总与验证曲线' },
  { to: '/experiments', label: '算法实验', note: '策略模拟差距分析与对比' },
  { to: '/agent', label: '智能体中心', note: '问答工作台与数据导出' },
]

const heroTitle = computed(() =>
  dashboard.value?.project_title || '海上风电历史数据分析与多算法智能体系统',
)
const heroSubtitle = computed(
  () =>
    dashboard.value?.subtitle ||
    '基于海上风电历史数据，集成功率建模验证、风险量化评估与多策略调度对比的一体化分析平台。',
)

const headlineMetrics = computed(() => {
  if (!dashboard.value?.meta) return []
  return [
    {
      label: '风场数量',
      value: `${dashboard.value.meta.site_count}`,
      note: '福建海域 5 个风电场统一纳入分析',
    },
    {
      label: '验证集周期',
      value: dashboard.value.meta.validation_range
        ? dashboard.value.meta.validation_range[0]?.slice(0, 10)
        : '--',
      note: '训练集后20%数据，有真实功率可对比',
    },
    {
      label: '验证集 MAE',
      value: `${fmt(dashboard.value.meta.validation_mae_mw)} MW`,
      note: `整体 RMSE: ${fmt(dashboard.value.meta.validation_rmse_mw)} MW`,
    },
  ]
})

onMounted(() => {
  ensureDashboardLoaded()
})
</script>

<template>
  <div class="shell">
    <aside class="sidebar">
      <div class="brand-card">
        <p class="eyebrow">海上风电智能分析中枢</p>
        <h1>海上风电智能体</h1>
        <p class="brand-copy">基于2022-2023年福建海上风电历史数据的多页面分析大屏，分层展示精度验证、站点详情、算法实验与智能问答。</p>
      </div>

      <nav class="nav-stack">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="nav-card"
          :class="{ active: route.path === item.to }"
        >
          <strong>{{ item.label }}</strong>
          <span>{{ item.note }}</span>
        </RouterLink>
      </nav>

      <div class="sidebar-panel">
        <span>问答后端</span>
        <strong>{{ agentBackend ? `${agentBackend.backend} · ${agentBackend.model || 'fallback'}` : '加载中...' }}</strong>
        <small>{{ agentBackend?.message || '正在连接智能问答模块。' }}</small>
      </div>

      <div class="sidebar-panel">
        <span>当前站点</span>
        <strong>{{ activeStation?.site_name || '--' }}</strong>
        <small>{{ activeStation ? `${activeStation.region} · ${fmt(activeStation.capacity_mw, 0)} MW` : '等待数据' }}</small>
      </div>
    </aside>

    <div class="workspace">
      <header class="workspace-hero">
        <div class="hero-copy">
          <p class="eyebrow">数据大屏</p>
          <h2>{{ heroTitle }}</h2>
          <p>{{ heroSubtitle }}</p>
        </div>

        <div class="hero-stats">
          <article v-for="item in headlineMetrics" :key="item.label" class="hero-stat-card">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
            <small>{{ item.note }}</small>
          </article>
        </div>
      </header>

      <section v-if="errorMessage" class="page-panel error-banner">
        <h3>加载失败</h3>
        <p>{{ errorMessage }}</p>
      </section>

      <section v-else-if="loading && !dashboard" class="page-panel loading-banner">
        <div class="loading-line"></div>
        <p>正在加载系统数据与分析看板...</p>
      </section>

      <RouterView v-else />

      <footer class="footer-strip">
        <div class="footer-metrics">
          <article v-for="card in summaryCards.slice(0, 4)" :key="card.label" class="footer-card">
            <span>{{ card.label }}</span>
            <strong>{{ card.value }}</strong>
          </article>
        </div>
        <p class="footer-note">当前共接入 {{ stationOverview.length }} 个福建风电场，覆盖 2022-2023 年度海上风电运行数据。</p>
      </footer>
    </div>
  </div>
</template>
