<script setup>
import { computed } from 'vue'

const props = defineProps({
  stations: {
    type: Array,
    default: () => [],
  },
  currentSiteId: {
    type: String,
    default: '',
  },
  riskTone: {
    type: Function,
    required: true,
  },
  fmt: {
    type: Function,
    required: true,
  },
  selectedSite: {
    type: Object,
    default: null,
  },
})

const stationCoords = {
  f1: { x: 160, y: 150 },
  f2: { x: 212, y: 116 },
  f3: { x: 246, y: 176 },
  f4: { x: 132, y: 218 },
  f5: { x: 270, y: 98 },
}

const mappedStations = computed(() =>
  props.stations.map((site) => ({
    ...site,
    coord: stationCoords[site.site_id] || { x: 180, y: 180 },
  })),
)

function toneClass(site) {
  return props.riskTone(site.avg_risk)
}
</script>

<template>
  <div class="map-card">
    <div class="map-stage">
      <svg viewBox="0 0 360 320" class="fujian-map" aria-label="福建风电场分布图">
        <defs>
          <linearGradient id="fjGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0e4857" />
            <stop offset="100%" stop-color="#0c2837" />
          </linearGradient>
          <filter id="glowAqua" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          d="M98 35 L188 26 L260 58 L302 116 L284 178 L242 236 L182 282 L118 266 L70 220 L50 158 L64 100 Z"
          class="fujian-shape"
        />
        <path
          d="M270 214 C300 228 324 248 336 286"
          class="coast-line"
        />
        <g v-for="site in mappedStations" :key="site.site_id">
          <circle
            :cx="site.coord.x"
            :cy="site.coord.y"
            r="10"
            class="map-dot"
            :class="[toneClass(site), { active: site.site_id === currentSiteId }]"
            filter="url(#glowAqua)"
          />
          <circle
            :cx="site.coord.x"
            :cy="site.coord.y"
            r="22"
            class="map-ring"
            :class="toneClass(site)"
          />
          <circle
            v-if="site.site_id === currentSiteId"
            :cx="site.coord.x"
            :cy="site.coord.y"
            r="34"
            class="map-ring pulse"
            :class="toneClass(site)"
          />
          <text :x="site.coord.x + 14" :y="site.coord.y + 4" class="map-label">
            {{ site.site_name }}
          </text>
        </g>
      </svg>
    </div>

    <div class="map-site-list">
      <article
        v-for="site in mappedStations"
        :key="site.site_id"
        class="map-site-row"
        :class="{ active: site.site_id === currentSiteId }"
      >
        <div>
          <strong>{{ site.site_name }}</strong>
          <small>{{ site.region }} · {{ site.site_id.toUpperCase() }}</small>
        </div>
        <div class="map-site-side">
          <span class="risk-badge" :class="toneClass(site)">{{ fmt(site.avg_risk, 3) }}</span>
          <small>{{ site.dominant_action }}</small>
        </div>
      </article>
    </div>

    <div v-if="selectedSite" class="map-float-panel">
      <span>当前站点情报</span>
      <strong>{{ selectedSite.site_name }}</strong>
      <small>{{ selectedSite.region }} · {{ fmt(selectedSite.capacity_mw, 0) }} MW 装机</small>
      <div class="map-float-tags">
        <span>风险 {{ fmt(selectedSite.avg_risk, 3) }}</span>
        <span>{{ selectedSite.dominant_action }}</span>
      </div>
    </div>
  </div>
</template>
