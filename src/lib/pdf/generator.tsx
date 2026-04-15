// =============================================================================
// RLK AI Diagnostic — PDF Report Generator (Executive-Grade)
// =============================================================================
// Renders a branded, multi-page diagnostic report with SVG charts and
// data visualizations using @react-pdf/renderer.
// Designed to be CEO-shareable and organization-ready.
// =============================================================================

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
  Svg,
  Circle,
  Line,
  Polygon,
  Path,
  Rect,
} from '@react-pdf/renderer';
import type {
  DiagnosticResult,
  GeneratedReport,
  ReportSection,
  DimensionScore,
  CompositeIndex,
  Dimension,
  StageClassification,
  EconomicEstimate,
} from '@/types/diagnostic';

// =============================================================================
// BRAND CONSTANTS
// =============================================================================

const C = {
  navy: '#0B1D3A',
  secondary: '#364E6E',
  tertiary: '#6B7F99',
  accent: '#A8B5C4',
  light: '#CED5DD',
  body: '#2D2D2D',
  bodyMuted: '#5A5A5A',
  white: '#FFFFFF',
  offWhite: '#F7F8FA',
  // Brand-only score palette (no traffic-light colors)
  radarFill: '#E1E5ED', // Navy at ~12% on white — safe flat color for SVG fill
  gradientBar: ['#0B1D3A', '#364E6E', '#6B7F99', '#A8B5C4', '#CED5DD'],
} as const;

const FONT = 'Helvetica';
const FONT_B = 'Helvetica-Bold';
const FONT_I = 'Helvetica-Oblique';
const FONT_BI = 'Helvetica-BoldOblique';

// =============================================================================
// SHARED STYLES
// =============================================================================

const s = StyleSheet.create({
  page: {
    fontFamily: FONT,
    fontSize: 9.5,
    color: C.body,
    paddingTop: 50,
    paddingBottom: 70,
    paddingHorizontal: 54,
  },
  coverPage: {
    fontFamily: FONT,
    backgroundColor: C.navy,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
  },
  gradientBar: { flexDirection: 'row', height: 4, width: '100%' },
  gradientBarThick: { flexDirection: 'row', height: 8, width: '100%' },
  gradientSegment: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
    paddingTop: 8,
  },
  headerCompany: { fontFamily: FONT_B, fontSize: 7.5, color: C.navy, letterSpacing: 4 },
  headerConf: { fontSize: 6.5, color: C.accent, letterSpacing: 3 },

  // Footer
  footer: { position: 'absolute', bottom: 18, left: 54, right: 54 },
  footerBorder: { borderTopWidth: 0.5, borderTopColor: C.light, paddingTop: 5 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  footerText: { fontSize: 6, color: C.tertiary },
  footerDisc: { fontFamily: FONT_I, fontSize: 5, color: C.light, textAlign: 'center', marginTop: 2 },

  // Typography
  h1: { fontFamily: FONT_B, fontSize: 20, color: C.navy, marginBottom: 4, marginTop: 4 },
  h2: { fontFamily: FONT_B, fontSize: 14, color: C.secondary, marginBottom: 8, marginTop: 14 },
  h3: { fontFamily: FONT_B, fontSize: 11, color: C.tertiary, marginBottom: 6, marginTop: 10 },
  p: { fontSize: 9.5, color: C.body, lineHeight: 1.55, marginBottom: 8 },
  bold: { fontFamily: FONT_B },
  italic: { fontFamily: FONT_I },
  boldItalic: { fontFamily: FONT_BI },

  // Lists
  bullet: { flexDirection: 'row', marginBottom: 4, paddingLeft: 8 },
  bulletDot: { width: 14, fontSize: 9.5, color: C.tertiary },
  bulletTxt: { flex: 1, fontSize: 9.5, color: C.body, lineHeight: 1.55 },
  numItem: { flexDirection: 'row', marginBottom: 4, paddingLeft: 4 },
  numMarker: { width: 20, fontSize: 9.5, color: C.secondary, fontFamily: FONT_B },
});

// =============================================================================
// HELPERS
// =============================================================================

function fmt$(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

const DIM_LABELS: Record<Dimension, string> = {
  adoption_behavior: 'Adoption Behavior',
  authority_structure: 'Authority Structure',
  workflow_integration: 'Workflow Integration',
  decision_velocity: 'Decision Velocity',
  economic_translation: 'Economic Translation',
};
const DIM_SHORT: Record<Dimension, string> = {
  adoption_behavior: 'Adoption',
  authority_structure: 'Authority',
  workflow_integration: 'Workflow',
  decision_velocity: 'Velocity',
  economic_translation: 'Economic',
};

function tierColor(sc: number): string {
  if (sc >= 80) return C.navy;
  if (sc >= 60) return C.secondary;
  if (sc >= 40) return C.tertiary;
  if (sc >= 20) return C.accent;
  return C.light;
}
function tierLabel(sc: number): string {
  if (sc >= 80) return 'Leading';
  if (sc >= 60) return 'Advancing';
  if (sc >= 40) return 'Developing';
  if (sc >= 20) return 'Emerging';
  return 'Foundational';
}

// =============================================================================
// SVG HELPERS
// =============================================================================

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function arc(cx: number, cy: number, r: number, s0: number, s1: number): string {
  const a = polar(cx, cy, r, s0);
  const b = polar(cx, cy, r, s1);
  const large = s1 - s0 <= 180 ? '0' : '1';
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`;
}

// =============================================================================
// SVG CHART COMPONENTS
// =============================================================================

/** Circular gauge showing overall score (0–100). */
function ScoreRing({ score, size = 130 }: { score: number; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - 24) / 2;
  const sw = 10;
  const color = tierColor(score);
  const angle = Math.min(Math.max(score, 0.5), 99.5) / 100 * 360;

  return (
    <View style={{ width: size, height: size, position: 'relative' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={cx} cy={cy} r={r} fill="none" stroke="#EDF0F4" strokeWidth={sw} />
        {score > 0 && score < 100 && (
          <Path d={arc(cx, cy, r, 0, angle)} fill="none" stroke={color} strokeWidth={sw} />
        )}
        {score >= 100 && (
          <Circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={sw} />
        )}
        <Circle cx={cx} cy={cy} r={r - sw / 2 - 3} fill="none" stroke="#F0F2F5" strokeWidth={0.5} />
      </Svg>
      <View style={{
        position: 'absolute', top: 0, left: 0, width: size, height: size,
        justifyContent: 'center', alignItems: 'center',
      }}>
        <Text style={{ fontFamily: FONT_B, fontSize: 32, color: C.navy, lineHeight: 1 }}>
          {Math.round(score)}
        </Text>
        <Text style={{ fontSize: 7.5, color: C.tertiary, marginTop: 2 }}>out of 100</Text>
      </View>
    </View>
  );
}

/** Pentagon radar chart for the five dimensions. */
function PentagonRadar({ scores }: { scores: DimensionScore[] }) {
  const svgW = 200;
  const cx = svgW / 2;
  const cy = svgW / 2;
  const maxR = 75;

  const dims: Dimension[] = [
    'adoption_behavior', 'authority_structure', 'workflow_integration',
    'decision_velocity', 'economic_translation',
  ];
  const ordered = dims.map(d => scores.find(sc => sc.dimension === d));
  const angles = dims.map((_, i) => (i * 2 * Math.PI) / 5 - Math.PI / 2);
  const pt = (i: number, frac: number) => ({
    x: cx + maxR * frac * Math.cos(angles[i]),
    y: cy + maxR * frac * Math.sin(angles[i]),
  });

  const grid = [0.2, 0.4, 0.6, 0.8, 1.0];
  const data = ordered.map((sc, i) => pt(i, (sc?.normalizedScore || 0) / 100));
  const dataPts = data.map(p => `${p.x},${p.y}`).join(' ');

  const cW = 360;
  const cH = 270;
  const oX = (cW - svgW) / 2;
  const oY = 25;

  // Manually-tuned label positions per vertex
  const labels: { top: number; left: number; w: number; align: 'center' | 'left' | 'right' }[] = [
    { top: 0, left: cW / 2 - 55, w: 110, align: 'center' },
    { top: oY + cy + maxR * Math.sin(angles[1]) - 10, left: oX + cx + maxR * Math.cos(angles[1]) + 10, w: 85, align: 'left' },
    { top: oY + cy + maxR * Math.sin(angles[2]) + 2, left: oX + cx + maxR * Math.cos(angles[2]) + 8, w: 90, align: 'left' },
    { top: oY + cy + maxR * Math.sin(angles[3]) + 2, left: 5, w: oX + cx + maxR * Math.cos(angles[3]) - 12, align: 'right' },
    { top: oY + cy + maxR * Math.sin(angles[4]) - 10, left: 5, w: oX + cx + maxR * Math.cos(angles[4]) - 12, align: 'right' },
  ];

  return (
    <View style={{ width: cW, height: cH, position: 'relative', alignSelf: 'center', marginVertical: 6 }}>
      <View style={{ position: 'absolute', left: oX, top: oY }}>
        <Svg width={svgW} height={svgW} viewBox={`0 0 ${svgW} ${svgW}`}>
          {/* Grid pentagons */}
          {grid.map((lv, li) => {
            const pts = dims.map((_, i) => pt(i, lv));
            return (
              <Polygon
                key={li}
                points={pts.map(p => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={li === grid.length - 1 ? '#D1D5DB' : '#E8EAED'}
                strokeWidth={li === grid.length - 1 ? 0.75 : 0.4}
              />
            );
          })}
          {/* Axis lines */}
          {dims.map((_, i) => {
            const o = pt(i, 1);
            return <Line key={i} x1={cx} y1={cy} x2={o.x} y2={o.y} stroke="#E8EAED" strokeWidth={0.4} />;
          })}
          {/* Data polygon */}
          <Polygon points={dataPts} fill={C.radarFill} stroke={C.navy} strokeWidth={1.5} />
          {/* Data dots */}
          {data.map((p, i) => (
            <Circle key={i} cx={p.x} cy={p.y} r={3.5} fill={C.navy} />
          ))}
          <Circle cx={cx} cy={cy} r={1.5} fill={C.light} />
        </Svg>
      </View>
      {/* Labels */}
      {dims.map((dim, i) => {
        const cfg = labels[i];
        const sc = ordered[i];
        return (
          <View key={dim} style={{ position: 'absolute', top: cfg.top, left: cfg.left, width: cfg.w }}>
            <Text style={{ fontFamily: FONT_B, fontSize: 7, color: C.secondary, textAlign: cfg.align }}>
              {DIM_SHORT[dim]}
            </Text>
            <Text style={{ fontFamily: FONT_B, fontSize: 9, color: C.navy, textAlign: cfg.align }}>
              {sc?.normalizedScore || 0}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** 2x2 competitive positioning matrix. */
function CompetitiveQuadrant({
  capScore, readScore, name,
}: { capScore: number; readScore: number; name: string }) {
  const sz = 180;
  const pad = 6;
  const g = sz - pad * 2;
  const dx = pad + (capScore / 100) * g;
  const dy = pad + ((100 - readScore) / 100) * g;

  return (
    <View style={{ width: sz + 100, height: sz + 36, position: 'relative', alignSelf: 'center', marginVertical: 8 }}>
      <View style={{ position: 'absolute', left: 56, top: 0 }}>
        <Svg width={sz} height={sz} viewBox={`0 0 ${sz} ${sz}`}>
          <Rect x={pad} y={pad} width={g / 2} height={g / 2} fill="#F0F4F8" />
          <Rect x={pad + g / 2} y={pad} width={g / 2} height={g / 2} fill="#E8F5EE" />
          <Rect x={pad} y={pad + g / 2} width={g / 2} height={g / 2} fill="#F3F4F6" />
          <Rect x={pad + g / 2} y={pad + g / 2} width={g / 2} height={g / 2} fill="#F0F8F0" />
          <Rect x={pad} y={pad} width={g} height={g} fill="none" stroke="#D1D5DB" strokeWidth={0.75} />
          <Line x1={pad + g / 2} y1={pad} x2={pad + g / 2} y2={pad + g} stroke="#D1D5DB" strokeWidth={0.5} />
          <Line x1={pad} y1={pad + g / 2} x2={pad + g} y2={pad + g / 2} stroke="#D1D5DB" strokeWidth={0.5} />
          <Circle cx={dx} cy={dy} r={7} fill={C.navy} />
          <Circle cx={dx} cy={dy} r={3} fill={C.white} />
        </Svg>
      </View>
      {/* Axis labels */}
      <View style={{ position: 'absolute', bottom: 0, left: 56, width: sz }}>
        <Text style={{ fontSize: 6.5, color: C.tertiary, textAlign: 'center', fontFamily: FONT_B, letterSpacing: 1 }}>
          AI CAPABILITY
        </Text>
      </View>
      <View style={{ position: 'absolute', top: sz / 2 - 16, left: 0, width: 48 }}>
        <Text style={{ fontSize: 6.5, color: C.tertiary, textAlign: 'right', fontFamily: FONT_B, letterSpacing: 1 }}>
          READINESS
        </Text>
      </View>
      {/* Quadrant labels */}
      <View style={{ position: 'absolute', top: pad + 6, left: 62 }}>
        <Text style={{ fontSize: 6, color: C.tertiary }}>Structure</Text>
        <Text style={{ fontSize: 6, color: C.tertiary }}>w/o Capability</Text>
      </View>
      <View style={{ position: 'absolute', top: pad + 6, left: 62 + g / 2 }}>
        <Text style={{ fontSize: 6, color: C.navy, fontFamily: FONT_B }}>AI-Native</Text>
        <Text style={{ fontSize: 6, color: C.navy, fontFamily: FONT_B }}>Leaders</Text>
      </View>
      <View style={{ position: 'absolute', top: pad + g / 2 + 6, left: 62 }}>
        <Text style={{ fontSize: 6, color: C.accent }}>Pre-AI</Text>
      </View>
      <View style={{ position: 'absolute', top: pad + g / 2 + 6, left: 62 + g / 2 }}>
        <Text style={{ fontSize: 6, color: C.tertiary }}>Capability</Text>
        <Text style={{ fontSize: 6, color: C.tertiary }}>w/o Structure</Text>
      </View>
      {/* Company label near dot */}
      <View style={{ position: 'absolute', top: Math.max(dy - 14, 2), left: Math.min(56 + dx + 12, sz + 40) }}>
        <Text style={{ fontSize: 6, color: C.navy, fontFamily: FONT_B }}>{name}</Text>
      </View>
    </View>
  );
}

// =============================================================================
// VIEW-BASED VISUAL COMPONENTS
// =============================================================================

/** Horizontal stage 1-5 timeline with current stage highlighted. */
function StageTimeline({ stage }: { stage: StageClassification }) {
  const nums = [1, 2, 3, 4, 5] as const;
  const names = ['Awareness', 'Experimentation', 'Organizational', 'Strategic', 'Transformational'];
  return (
    <View style={{ marginVertical: 10, paddingHorizontal: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        {nums.map((n, i) => {
          const cur = n === stage.primaryStage;
          const past = n < stage.primaryStage;
          return (
            <React.Fragment key={n}>
              {i > 0 && (
                <View style={{ flex: 1, height: 2, backgroundColor: past || cur ? C.navy : '#E5E7EB' }} />
              )}
              <View style={{
                width: cur ? 26 : 18, height: cur ? 26 : 18, borderRadius: 13,
                backgroundColor: cur ? C.navy : past ? C.secondary : C.white,
                borderWidth: cur ? 0 : 1.5, borderColor: past ? C.secondary : '#D1D5DB',
                justifyContent: 'center', alignItems: 'center',
              }}>
                <Text style={{
                  fontFamily: FONT_B, fontSize: cur ? 11 : 7.5,
                  color: cur || past ? C.white : C.tertiary,
                }}>{n}</Text>
              </View>
            </React.Fragment>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {nums.map((n, i) => (
          <View key={n} style={{ width: 68, alignItems: 'center' }}>
            <Text style={{
              fontSize: 5.5, textAlign: 'center',
              color: n === stage.primaryStage ? C.navy : C.tertiary,
              fontFamily: n === stage.primaryStage ? FONT_B : FONT,
            }}>{names[i]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Cover page stage bar — shows all 5 stages with the current stage highlighted. */
function CoverStageBar({ stage }: { stage: StageClassification }) {
  const nums = [1, 2, 3, 4, 5] as const;
  const names = ['Awareness', 'Experimentation', 'Organizational', 'Strategic', 'Transformational'];
  return (
    <View style={{ marginBottom: 28, width: 400, alignSelf: 'center' }}>
      {/* Stage label */}
      <Text style={{ fontFamily: FONT_B, fontSize: 7, color: C.accent, letterSpacing: 3, textAlign: 'center', marginBottom: 10 }}>
        YOUR MATURITY STAGE
      </Text>
      {/* 5-stage row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
        {nums.map((n, i) => {
          const cur = n === stage.primaryStage;
          const past = n < stage.primaryStage;
          return (
            <React.Fragment key={n}>
              {i > 0 && (
                <View style={{ width: 28, height: 1.5, backgroundColor: past || cur ? C.accent : C.secondary }} />
              )}
              <View style={{ alignItems: 'center', width: cur ? 64 : 52 }}>
                <View style={{
                  width: cur ? 32 : 22, height: cur ? 32 : 22, borderRadius: 16,
                  backgroundColor: cur ? C.white : 'transparent',
                  borderWidth: cur ? 0 : 1, borderColor: past ? C.accent : C.secondary,
                  justifyContent: 'center', alignItems: 'center', marginBottom: 4,
                }}>
                  <Text style={{
                    fontFamily: FONT_B, fontSize: cur ? 14 : 8,
                    color: cur ? C.navy : past ? C.accent : C.secondary,
                  }}>{n}</Text>
                </View>
                <Text style={{
                  fontSize: cur ? 7 : 5.5, textAlign: 'center',
                  color: cur ? C.white : past ? C.accent : C.secondary,
                  fontFamily: cur ? FONT_B : FONT,
                }}>{names[i]}</Text>
              </View>
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

/** Score legend — explains what the score tiers mean. Placed on exec dashboard. */
function ScoreLegend() {
  const tiers = [
    { label: 'Leading', range: '80-100', color: C.navy },
    { label: 'Advancing', range: '60-79', color: C.secondary },
    { label: 'Developing', range: '40-59', color: C.tertiary },
    { label: 'Emerging', range: '20-39', color: C.accent },
    { label: 'Foundational', range: '0-19', color: C.light },
  ];
  return (
    <View style={{
      borderWidth: 0.75, borderColor: C.light, borderRadius: 4,
      backgroundColor: C.white, paddingVertical: 8, paddingHorizontal: 12,
      marginBottom: 10,
    }}>
      <Text style={{ fontSize: 6.5, color: C.tertiary, fontFamily: FONT_B, letterSpacing: 2, marginBottom: 6 }}>
        SCORE GUIDE
      </Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {tiers.map(t => (
          <View key={t.label} style={{ alignItems: 'center', width: 80 }}>
            <View style={{ width: 36, height: 5, backgroundColor: t.color, borderRadius: 2.5, marginBottom: 3 }} />
            <Text style={{ fontFamily: FONT_B, fontSize: 7, color: C.body }}>{t.label}</Text>
            <Text style={{ fontSize: 6, color: C.bodyMuted }}>{t.range}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Enhanced horizontal dimension score bars with tier labels. */
function DimensionBars({ scores }: { scores: DimensionScore[] }) {
  const sorted = [...scores].sort((a, b) => b.normalizedScore - a.normalizedScore);
  return (
    <View style={{ marginTop: 8, marginBottom: 12 }}>
      {sorted.map(dim => {
        const color = tierColor(dim.normalizedScore);
        return (
          <View key={dim.dimension} style={{ marginBottom: 9 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2.5 }}>
              <Text style={{ fontFamily: FONT_B, fontSize: 8.5, color: C.body }}>
                {DIM_LABELS[dim.dimension]}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 6.5, color: C.tertiary, marginRight: 5 }}>{tierLabel(dim.normalizedScore)}</Text>
                <Text style={{ fontFamily: FONT_B, fontSize: 10, color }}>{Math.round(dim.normalizedScore)}</Text>
              </View>
            </View>
            <View style={{ height: 7, backgroundColor: '#EDF0F4', borderRadius: 3.5, overflow: 'hidden' }}>
              <View style={{
                height: 7, borderRadius: 3.5, backgroundColor: color,
                width: `${Math.max(dim.normalizedScore, 2)}%`,
              }} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Reusable metric card with colored left border. */
function MetricCard({ label, value, sub, accent = C.navy }: {
  label: string; value: string; sub?: string; accent?: string;
}) {
  return (
    <View style={{
      flex: 1, borderLeftWidth: 3, borderLeftColor: accent,
      backgroundColor: C.offWhite, padding: 9, marginHorizontal: 3,
    }}>
      <Text style={{ fontSize: 6.5, color: C.tertiary, fontFamily: FONT_B, letterSpacing: 0.5, marginBottom: 3 }}>
        {label.toUpperCase()}
      </Text>
      <Text style={{ fontFamily: FONT_B, fontSize: 13, color: C.navy, marginBottom: sub ? 2 : 0 }}>{value}</Text>
      {sub && <Text style={{ fontSize: 6.5, color: C.bodyMuted }}>{sub}</Text>}
    </View>
  );
}

/** Economic metrics dashboard with hero value and metric cards. */
function EconomicDashboard({ est }: { est: EconomicEstimate }) {
  return (
    <View style={{ marginVertical: 10 }}>
      <View style={{
        backgroundColor: C.navy, borderRadius: 4, padding: 14, marginBottom: 8, alignItems: 'center',
      }}>
        <Text style={{ fontSize: 7, color: C.accent, letterSpacing: 2, fontFamily: FONT_B, marginBottom: 4 }}>
          ESTIMATED UNREALIZED AI VALUE
        </Text>
        <Text style={{ fontFamily: FONT_B, fontSize: 22, color: C.white, marginBottom: 3 }}>
          {fmt$(est.unrealizedValueLow)} – {fmt$(est.unrealizedValueHigh)}
        </Text>
        <Text style={{ fontSize: 8, color: C.light }}>
          Annually | Current capture: {est.currentCapturePercent}% of potential
        </Text>
      </View>
      <View style={{ flexDirection: 'row', marginBottom: 5 }}>
        <MetricCard label="Productivity Potential" value={`${est.productivityPotentialPercent}%`} sub="of workforce capacity" accent={C.navy} />
        <MetricCard label="Current Capture" value={`${est.currentCapturePercent}%`} sub="of AI potential realized" accent={C.secondary} />
        <MetricCard label="Wasted Hours" value={est.annualWastedHours.toLocaleString()} sub="hours per year" accent={C.tertiary} />
      </View>
      <View style={{ flexDirection: 'row' }}>
        <MetricCard label="Cost Per Employee" value={fmt$(est.costPerEmployee)} sub="annually" accent={C.secondary} />
        <MetricCard label="Industry Benchmark" value={est.industryBenchmark} accent={C.tertiary} />
        <View style={{ flex: 1, marginHorizontal: 3 }} />
      </View>
    </View>
  );
}

/** Composite index cards with mini progress bars. */
function CompositeCards({ indices }: { indices: CompositeIndex[] }) {
  return (
    <View style={{ marginVertical: 8 }}>
      {indices.map(idx => {
        const color = tierColor(idx.score);
        return (
          <View key={idx.slug} style={{
            borderWidth: 0.75, borderColor: C.light, borderRadius: 4,
            padding: 11, marginBottom: 7, backgroundColor: C.white,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 3.5, height: 18, backgroundColor: color, borderRadius: 2, marginRight: 7 }} />
                <Text style={{ fontFamily: FONT_B, fontSize: 10, color: C.secondary }}>{idx.name}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <Text style={{ fontFamily: FONT_B, fontSize: 15, color }}>{Math.round(idx.score)}</Text>
                <Text style={{ fontSize: 8.5, color: C.tertiary }}> / 100</Text>
              </View>
            </View>
            <View style={{ height: 4, backgroundColor: '#EDF0F4', borderRadius: 2, overflow: 'hidden', marginBottom: 5 }}>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: color, width: `${Math.max(idx.score, 2)}%` }} />
            </View>
            <Text style={{ fontSize: 6.5, color: C.tertiary, fontFamily: FONT_B, marginBottom: 3 }}>{tierLabel(idx.score)}</Text>
            <Text style={{ fontSize: 8, color: C.bodyMuted, lineHeight: 1.4 }}>{idx.interpretation}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** Key metrics grid for the executive dashboard. */
function AtAGlance({ result }: { result: DiagnosticResult }) {
  const sorted = [...result.dimensionScores].sort((a, b) => a.normalizedScore - b.normalizedScore);
  const weakest = sorted[0];
  const strongest = sorted[sorted.length - 1];
  return (
    <View style={{
      borderWidth: 0.75, borderColor: C.light, borderRadius: 4,
      backgroundColor: C.offWhite, padding: 12, marginVertical: 8,
    }}>
      <Text style={{ fontSize: 6.5, color: C.tertiary, fontFamily: FONT_B, letterSpacing: 2, marginBottom: 8 }}>
        AT A GLANCE
      </Text>
      <View style={{ flexDirection: 'row', marginBottom: 7 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 6.5, color: C.tertiary }}>Overall Score</Text>
          <Text style={{ fontFamily: FONT_B, fontSize: 16, color: C.navy }}>{Math.round(result.overallScore)}/100</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 6.5, color: C.tertiary }}>Maturity Stage</Text>
          <Text style={{ fontFamily: FONT_B, fontSize: 12, color: C.navy }}>
            Stage {result.stageClassification.primaryStage}
          </Text>
          <Text style={{ fontSize: 7, color: C.secondary }}>{result.stageClassification.stageName}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 6.5, color: C.tertiary }}>Unrealized Value</Text>
          <Text style={{ fontFamily: FONT_B, fontSize: 10, color: C.navy }}>
            {fmt$(result.economicEstimate.unrealizedValueLow)} –
          </Text>
          <Text style={{ fontFamily: FONT_B, fontSize: 10, color: C.navy }}>
            {fmt$(result.economicEstimate.unrealizedValueHigh)}
          </Text>
        </View>
      </View>
      <View style={{ borderTopWidth: 0.5, borderTopColor: C.light, paddingTop: 7, flexDirection: 'row' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 6.5, color: C.tertiary }}>Primary Constraint</Text>
          <Text style={{ fontFamily: FONT_B, fontSize: 8.5, color: C.tertiary }}>{DIM_LABELS[weakest.dimension]}</Text>
          <Text style={{ fontSize: 7.5, color: C.bodyMuted }}>{weakest.normalizedScore}/100</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 6.5, color: C.tertiary }}>Organizational Strength</Text>
          <Text style={{ fontFamily: FONT_B, fontSize: 8.5, color: C.navy }}>{DIM_LABELS[strongest.dimension]}</Text>
          <Text style={{ fontSize: 7.5, color: C.bodyMuted }}>{strongest.normalizedScore}/100</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 6.5, color: C.tertiary }}>Confidence</Text>
          <Text style={{ fontFamily: FONT_B, fontSize: 8.5, color: C.secondary }}>
            {Math.round(result.stageClassification.confidence * 100)}%
          </Text>
        </View>
      </View>
    </View>
  );
}

// =============================================================================
// MARKDOWN PARSER (renders markdown strings to react-pdf components)
// =============================================================================

interface MdNode {
  type: 'h1' | 'h2' | 'h3' | 'paragraph' | 'bullet' | 'numbered';
  raw: string;
  number?: number;
}

function tokenize(md: string): MdNode[] {
  const lines = md.split('\n');
  const nodes: MdNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (t === '') { i++; continue; }
    if (t.startsWith('### ')) { nodes.push({ type: 'h3', raw: t.slice(4) }); i++; continue; }
    if (t.startsWith('## ')) { nodes.push({ type: 'h2', raw: t.slice(3) }); i++; continue; }
    if (t.startsWith('# ')) { nodes.push({ type: 'h1', raw: t.slice(2) }); i++; continue; }
    const bm = t.match(/^[-*+]\s+(.*)$/);
    if (bm) {
      let txt = bm[1]; i++;
      while (i < lines.length) {
        const nx = lines[i].trim();
        if (nx === '' || /^[-*+]\s+/.test(nx) || /^#{1,3}\s/.test(nx) || /^\d+[.)]\s+/.test(nx)) break;
        txt += ' ' + nx; i++;
      }
      nodes.push({ type: 'bullet', raw: txt }); continue;
    }
    const nm = t.match(/^(\d+)[.)]\s+(.*)$/);
    if (nm) {
      let txt = nm[2]; const num = parseInt(nm[1], 10); i++;
      while (i < lines.length) {
        const nx = lines[i].trim();
        if (nx === '' || /^[-*+]\s+/.test(nx) || /^#{1,3}\s/.test(nx) || /^\d+[.)]\s+/.test(nx)) break;
        txt += ' ' + nx; i++;
      }
      nodes.push({ type: 'numbered', raw: txt, number: num }); continue;
    }
    let para = t; i++;
    while (i < lines.length) {
      const nx = lines[i].trim();
      if (nx === '' || /^[-*+]\s+/.test(nx) || /^#{1,3}\s/.test(nx) || /^\d+[.)]\s+/.test(nx)) break;
      para += ' ' + nx; i++;
    }
    nodes.push({ type: 'paragraph', raw: para });
  }
  return nodes;
}

function inlineText(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const rx = /(\*{3}(.*?)\*{3}|\*{2}(.*?)\*{2}|\*(.*?)\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = rx.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[2] !== undefined) parts.push(<Text key={k++} style={s.boldItalic}>{m[2]}</Text>);
    else if (m[3] !== undefined) parts.push(<Text key={k++} style={s.bold}>{m[3]}</Text>);
    else if (m[4] !== undefined) parts.push(<Text key={k++} style={s.italic}>{m[4]}</Text>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length > 0 ? parts : [text];
}

function Md({ markdown }: { markdown: string }) {
  const nodes = tokenize(markdown);
  return (
    <View>
      {nodes.map((n, i) => {
        switch (n.type) {
          case 'h1': return <Text key={i} style={s.h1}>{n.raw}</Text>;
          case 'h2': return <Text key={i} style={s.h2}>{n.raw}</Text>;
          case 'h3': return <Text key={i} style={s.h3}>{n.raw}</Text>;
          case 'bullet':
            return (
              <View key={i} style={s.bullet}>
                <Text style={s.bulletDot}>{'\u2022'}</Text>
                <Text style={s.bulletTxt}>{inlineText(n.raw)}</Text>
              </View>
            );
          case 'numbered':
            return (
              <View key={i} style={s.numItem}>
                <Text style={s.numMarker}>{n.number}.</Text>
                <Text style={s.bulletTxt}>{inlineText(n.raw)}</Text>
              </View>
            );
          default:
            return <Text key={i} style={s.p}>{inlineText(n.raw)}</Text>;
        }
      })}
    </View>
  );
}

// =============================================================================
// PAGE CHROME
// =============================================================================

function GradientBar({ tall }: { tall?: boolean }) {
  return (
    <View style={tall ? s.gradientBarThick : s.gradientBar} fixed>
      {C.gradientBar.map((color, i) => (
        <View key={i} style={[s.gradientSegment, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

function PageHeader() {
  return (
    <View fixed>
      <GradientBar />
      <View style={s.header}>
        <Text style={s.headerCompany}>RLK CONSULTING</Text>
        <Text style={s.headerConf}>CONFIDENTIAL</Text>
      </View>
    </View>
  );
}

function PageFooter() {
  return (
    <View style={s.footer} fixed>
      <View style={s.footerBorder}>
        <View style={s.footerRow}>
          <Text style={s.footerText}>RLK Consulting, LLC | rlkconsultingco.com</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
        <Text style={s.footerDisc}>Confidential & Proprietary. Unauthorized distribution prohibited.</Text>
      </View>
    </View>
  );
}

function Divider() {
  return (
    <View style={{ marginBottom: 14, marginTop: 4 }}>
      <View style={{ flexDirection: 'row', height: 2 }}>
        <View style={{ width: 60, height: 2, backgroundColor: C.navy }} />
        <View style={{ flex: 1, height: 1, backgroundColor: C.light, marginTop: 0.5 }} />
      </View>
    </View>
  );
}

// =============================================================================
// PAGE COMPONENTS
// =============================================================================

function CoverPage({ report, result }: { report: GeneratedReport; result: DiagnosticResult }) {
  const date = new Date(report.generatedAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  return (
    <Page size="LETTER" style={s.coverPage}>
      <GradientBar tall />
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 72 }}>
        <Text style={{ fontFamily: FONT_B, fontSize: 9, color: C.accent, letterSpacing: 8, marginBottom: 52 }}>
          RLK CONSULTING
        </Text>
        <Text style={{ fontFamily: FONT_B, fontSize: 38, color: C.white, textAlign: 'center', marginBottom: 4 }}>
          AI Diagnostic
        </Text>
        <Text style={{ fontSize: 14, color: C.light, textAlign: 'center', marginBottom: 44 }}>
          Organizational AI Readiness Report
        </Text>
        <View style={{ width: 40, height: 0.5, backgroundColor: C.accent, marginBottom: 44 }} />
        <Text style={{ fontFamily: FONT_I, fontSize: 11, color: C.accent, textAlign: 'center', marginBottom: 8 }}>
          Prepared exclusively for
        </Text>
        <Text style={{ fontFamily: FONT_B, fontSize: 26, color: C.white, textAlign: 'center', marginBottom: 6 }}>
          {report.companyProfile.companyName}
        </Text>
        {/* Overall score badge */}
        <View style={{
          flexDirection: 'row', alignItems: 'baseline',
          marginTop: 12, marginBottom: 20, paddingHorizontal: 16, paddingVertical: 8,
          borderWidth: 0.5, borderColor: C.secondary, borderRadius: 4,
        }}>
          <Text style={{ fontFamily: FONT_B, fontSize: 20, color: C.white, marginRight: 4 }}>
            {Math.round(result.overallScore)}
          </Text>
          <Text style={{ fontSize: 10, color: C.accent }}>/100</Text>
          <Text style={{ fontSize: 10, color: C.accent, marginLeft: 12 }}>|</Text>
          <Text style={{ fontSize: 10, color: C.light, marginLeft: 12 }}>
            Overall AI Readiness Score
          </Text>
        </View>
        {/* 5-stage bar across cover */}
        <CoverStageBar stage={result.stageClassification} />
        <View style={{ flexDirection: 'row', marginBottom: 52 }}>
          <Text style={{ fontSize: 10, color: C.light }}>{date}</Text>
          <Text style={{ fontSize: 10, color: C.accent, marginHorizontal: 10 }}>|</Text>
          <Text style={{ fontSize: 10, color: C.light }}>{result.companyProfile.employeeCount.toLocaleString()} employees</Text>
        </View>
        <Text style={{ fontSize: 8, color: C.accent, letterSpacing: 5 }}>CONFIDENTIAL</Text>
      </View>
      <GradientBar tall />
    </Page>
  );
}

function TOCPage({ sections }: { sections: ReportSection[] }) {
  return (
    <Page size="LETTER" style={s.page}>
      <PageHeader />
      <Text style={[s.h1, { marginBottom: 20 }]}>Table of Contents</Text>
      <Divider />
      {sections.map((sec, i) => (
        <View key={sec.slug} style={{
          flexDirection: 'row', alignItems: 'center', paddingVertical: 7,
          borderBottomWidth: 0.5, borderBottomColor: '#F0F1F3',
        }}>
          <View style={{
            width: 26, height: 26, borderRadius: 13,
            backgroundColor: i === 0 ? C.navy : C.offWhite,
            borderWidth: i === 0 ? 0 : 1, borderColor: C.light,
            justifyContent: 'center', alignItems: 'center', marginRight: 12,
          }}>
            <Text style={{ fontFamily: FONT_B, fontSize: 9, color: i === 0 ? C.white : C.secondary }}>
              {i + 1}
            </Text>
          </View>
          <Text style={{ fontFamily: FONT_B, fontSize: 10.5, color: C.secondary, flex: 1 }}>
            {sec.title}
          </Text>
        </View>
      ))}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7, marginTop: 4 }}>
        <View style={{
          width: 26, height: 26, borderRadius: 13,
          backgroundColor: C.offWhite, borderWidth: 1, borderColor: C.light,
          justifyContent: 'center', alignItems: 'center', marginRight: 12,
        }}>
          <Text style={{ fontFamily: FONT_B, fontSize: 9, color: C.tertiary }}>{'\u2022'}</Text>
        </View>
        <Text style={{ fontFamily: FONT_B, fontSize: 10.5, color: C.tertiary }}>
          About RLK Consulting & Disclaimer
        </Text>
      </View>
      <PageFooter />
    </Page>
  );
}

function ExecDashPage({ report, result }: { report: GeneratedReport; result: DiagnosticResult }) {
  const execSec = report.sections.find(s => s.slug === 'executive-summary');
  return (
    <Page size="LETTER" style={s.page} wrap>
      <PageHeader />
      <Text style={s.h1}>Executive Summary</Text>
      <Divider />

      {/* Score ring + Stage row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <ScoreRing score={result.overallScore} size={118} />
        <View style={{ flex: 1, marginLeft: 14 }}>
          <View style={{
            backgroundColor: C.offWhite, borderWidth: 0.75, borderColor: C.light,
            borderRadius: 4, padding: 11,
          }}>
            <Text style={{ fontFamily: FONT_B, fontSize: 6.5, color: C.tertiary, letterSpacing: 2, marginBottom: 2 }}>
              MATURITY STAGE
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 3 }}>
              <Text style={{ fontFamily: FONT_B, fontSize: 13, color: C.secondary, marginRight: 2 }}>
                Stage
              </Text>
              <Text style={{ fontFamily: FONT_B, fontSize: 26, color: C.navy, marginRight: 8 }}>
                {result.stageClassification.primaryStage}
              </Text>
              <Text style={{ fontSize: 9, color: C.tertiary, marginRight: 4 }}>of 5</Text>
              <View style={{ width: 0.5, height: 14, backgroundColor: C.light, marginRight: 8 }} />
              <Text style={{ fontFamily: FONT_B, fontSize: 13, color: C.secondary }}>
                {result.stageClassification.stageName}
              </Text>
            </View>
            <Text style={{ fontSize: 7.5, color: C.bodyMuted, lineHeight: 1.4 }}>
              {result.stageClassification.stageDescription.slice(0, 220)}
              {result.stageClassification.stageDescription.length > 220 ? '...' : ''}
            </Text>
          </View>
        </View>
      </View>

      <StageTimeline stage={result.stageClassification} />
      <ScoreLegend />
      <AtAGlance result={result} />

      {/* Compact economic bar */}
      <View style={{
        backgroundColor: C.navy, borderRadius: 4, padding: 10,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
      }}>
        <View>
          <Text style={{ fontSize: 6.5, color: C.accent, letterSpacing: 1.5, fontFamily: FONT_B, marginBottom: 2 }}>
            ESTIMATED UNREALIZED AI VALUE
          </Text>
          <Text style={{ fontFamily: FONT_B, fontSize: 16, color: C.white }}>
            {fmt$(result.economicEstimate.unrealizedValueLow)} – {fmt$(result.economicEstimate.unrealizedValueHigh)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 6.5, color: C.light }}>Annually</Text>
          <Text style={{ fontSize: 6.5, color: C.light }}>Capture: {result.economicEstimate.currentCapturePercent}%</Text>
        </View>
      </View>

      {execSec && <Md markdown={execSec.content} />}
      <PageFooter />
    </Page>
  );
}

// =============================================================================
// SECTION-SPECIFIC VISUALS
// =============================================================================

function SectionVis({ slug, result }: { slug: string; result: DiagnosticResult }): React.JSX.Element | null {
  switch (slug) {
    case 'ai-posture-diagnosis':
      return (
        <View>
          <PentagonRadar scores={result.dimensionScores} />
          <Text style={s.h3}>Dimension Breakdown</Text>
          <DimensionBars scores={result.dimensionScores} />
        </View>
      );
    case 'structural-constraints':
      return (
        <View>
          <Text style={s.h3}>Composite Indices</Text>
          <CompositeCards indices={result.compositeIndices} />
        </View>
      );
    case 'competitive-positioning': {
      const cap =
        (result.dimensionScores.find(d => d.dimension === 'adoption_behavior')?.normalizedScore || 0) * 0.5 +
        (result.dimensionScores.find(d => d.dimension === 'workflow_integration')?.normalizedScore || 0) * 0.5;
      const read =
        (result.dimensionScores.find(d => d.dimension === 'authority_structure')?.normalizedScore || 0) * 0.4 +
        (result.dimensionScores.find(d => d.dimension === 'decision_velocity')?.normalizedScore || 0) * 0.3 +
        (result.dimensionScores.find(d => d.dimension === 'economic_translation')?.normalizedScore || 0) * 0.3;
      return <CompetitiveQuadrant capScore={cap} readScore={read} name={result.companyProfile.companyName} />;
    }
    case 'financial-impact':
      return <EconomicDashboard est={result.economicEstimate} />;
    case 'pnl-business-case':
      return (
        <View style={{ flexDirection: 'row', marginBottom: 10 }}>
          <MetricCard label="Unrealized (Low)" value={fmt$(result.economicEstimate.unrealizedValueLow)} accent={C.secondary} />
          <MetricCard label="Unrealized (High)" value={fmt$(result.economicEstimate.unrealizedValueHigh)} accent={C.navy} />
          <MetricCard
            label="Quarterly Cost of Inaction"
            value={fmt$(Math.round((result.economicEstimate.unrealizedValueLow + result.economicEstimate.unrealizedValueHigh) / 2 / 4))}
            accent={C.tertiary}
          />
        </View>
      );
    case 'security-governance-risk':
      return (
        <View style={{
          borderLeftWidth: 3, borderLeftColor: C.secondary,
          backgroundColor: C.offWhite, padding: 10, marginBottom: 10,
        }}>
          <Text style={{ fontFamily: FONT_B, fontSize: 8.5, color: C.secondary, marginBottom: 2 }}>RISK ASSESSMENT</Text>
          <Text style={{ fontSize: 7.5, color: C.body, lineHeight: 1.4 }}>
            This section identifies security vulnerabilities, governance gaps, and compliance risks
            in your current AI posture. Review with your CISO and General Counsel.
          </Text>
        </View>
      );
    case 'vendor-landscape':
      return (
        <View style={{
          borderLeftWidth: 3, borderLeftColor: C.secondary,
          backgroundColor: C.offWhite, padding: 10, marginBottom: 10,
        }}>
          <Text style={{ fontFamily: FONT_B, fontSize: 8.5, color: C.secondary, marginBottom: 2 }}>VENDOR ASSESSMENT</Text>
          <Text style={{ fontSize: 7.5, color: C.body, lineHeight: 1.4 }}>
            Independent analysis of your AI vendor landscape with buy/build/partner recommendations.
          </Text>
        </View>
      );
    default:
      return null;
  }
}

/** Standard report section page with numbered header and visuals. */
function SectionPage({
  section, num, result,
}: { section: ReportSection; num: number; result: DiagnosticResult }) {
  return (
    <Page size="LETTER" style={s.page} wrap>
      <PageHeader />
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
        <View style={{
          width: 22, height: 22, borderRadius: 11,
          backgroundColor: C.navy, justifyContent: 'center', alignItems: 'center', marginRight: 9,
        }}>
          <Text style={{ fontFamily: FONT_B, fontSize: 9, color: C.white }}>{num}</Text>
        </View>
        <Text style={[s.h1, { marginBottom: 0, marginTop: 0, flex: 1 }]}>{section.title}</Text>
      </View>
      <Divider />
      <SectionVis slug={section.slug} result={result} />
      <Md markdown={section.content} />
      <PageFooter />
    </Page>
  );
}

function CTAPage({ result }: { result: DiagnosticResult }) {
  const sorted = [...result.dimensionScores].sort((a, b) => a.normalizedScore - b.normalizedScore);
  const weakest = sorted[0];
  const secondWeakest = sorted[1];
  return (
    <Page size="LETTER" style={s.coverPage}>
      <GradientBar tall />
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 72 }}>
        <Text style={{ fontFamily: FONT_B, fontSize: 7, color: C.accent, letterSpacing: 6, marginBottom: 36 }}>
          NEXT STEPS
        </Text>
        <Text style={{ fontFamily: FONT_B, fontSize: 28, color: C.white, textAlign: 'center', marginBottom: 8, lineHeight: 1.3 }}>
          From Diagnosis to Action
        </Text>
        <Text style={{ fontSize: 11, color: C.light, textAlign: 'center', marginBottom: 36, lineHeight: 1.5 }}>
          This diagnostic identifies where {result.companyProfile.companyName} stands.{'\n'}
          Closing the gap requires a tailored operationalization plan.
        </Text>
        <View style={{ width: 40, height: 0.5, backgroundColor: C.accent, marginBottom: 36 }} />
        {/* Key gaps callout */}
        <View style={{
          borderWidth: 0.5, borderColor: C.secondary, borderRadius: 4,
          padding: 18, marginBottom: 28, width: 360,
        }}>
          <Text style={{ fontFamily: FONT_B, fontSize: 8, color: C.accent, letterSpacing: 3, marginBottom: 10 }}>
            YOUR CRITICAL GAPS
          </Text>
          <View style={{ flexDirection: 'row', marginBottom: 6 }}>
            <Text style={{ fontFamily: FONT_B, fontSize: 10, color: C.white, width: 160 }}>
              {DIM_LABELS[weakest.dimension]}
            </Text>
            <Text style={{ fontSize: 10, color: C.light }}>
              {weakest.normalizedScore}/100
            </Text>
          </View>
          <View style={{ flexDirection: 'row', marginBottom: 10 }}>
            <Text style={{ fontFamily: FONT_B, fontSize: 10, color: C.white, width: 160 }}>
              {DIM_LABELS[secondWeakest.dimension]}
            </Text>
            <Text style={{ fontSize: 10, color: C.light }}>
              {secondWeakest.normalizedScore}/100
            </Text>
          </View>
          <Text style={{ fontSize: 8, color: C.accent, lineHeight: 1.5 }}>
            RLK builds tailored 90-day plans that translate these findings into specific
            governance structures, vendor decisions, and organizational changes.
          </Text>
        </View>
        {/* Contact info */}
        <Text style={{ fontFamily: FONT_B, fontSize: 14, color: C.white, marginBottom: 16 }}>
          Schedule a Strategy Session
        </Text>
        <Text style={{ fontSize: 10, color: C.light, marginBottom: 4 }}>
          ryan.king@rlkconsultingco.com
        </Text>
        <Text style={{ fontSize: 10, color: C.light, marginBottom: 4 }}>
          rlkconsultingco.com
        </Text>
      </View>
      <GradientBar tall />
    </Page>
  );
}

function AboutPage() {
  return (
    <Page size="LETTER" style={s.page}>
      <PageHeader />
      <Text style={s.h1}>About RLK Consulting</Text>
      <Divider />
      <View style={{ marginBottom: 18 }}>
        <Text style={{ fontSize: 9.5, color: C.body, lineHeight: 1.6, marginBottom: 8 }}>
          RLK Consulting is a CIO advisory firm serving mid-market and
          enterprise organizations. We help boards, C-suites, and operating
          leaders navigate digital transformation and translate technology
          investment into measurable business value.
        </Text>
        <Text style={{ fontSize: 9.5, color: C.body, lineHeight: 1.6, marginBottom: 8 }}>
          Our AI Diagnostic gives organizational leaders the same caliber of AI
          readiness analysis that Fortune 100 companies receive from top-tier
          strategy firms — made accessible, actionable, and specific to your
          organization.
        </Text>
        <Text style={{ fontSize: 9.5, color: C.body, lineHeight: 1.6, marginBottom: 8 }}>
          We do not sell software. We do not take equity. We provide clear-eyed,
          data-driven analysis and concrete recommendations that help leadership
          teams make informed decisions about AI strategy and investment.
        </Text>
      </View>
      {/* Contact card */}
      <View style={{
        borderLeftWidth: 3, borderLeftColor: C.navy,
        backgroundColor: C.offWhite, padding: 14, marginBottom: 24,
      }}>
        <Text style={{ fontFamily: FONT_B, fontSize: 10, color: C.navy, marginBottom: 8 }}>
          Schedule a Strategy Session
        </Text>
        <View style={{ flexDirection: 'row', marginBottom: 3 }}>
          <Text style={{ fontFamily: FONT_B, fontSize: 8.5, color: C.tertiary, width: 50 }}>Web</Text>
          <Text style={{ fontSize: 8.5, color: C.navy }}>rlkconsultingco.com</Text>
        </View>
        <View style={{ flexDirection: 'row', marginBottom: 3 }}>
          <Text style={{ fontFamily: FONT_B, fontSize: 8.5, color: C.tertiary, width: 50 }}>Email</Text>
          <Text style={{ fontSize: 8.5, color: C.navy }}>hello@rlkconsultingco.com</Text>
        </View>
      </View>
      {/* Disclaimer */}
      <View style={{ borderTopWidth: 0.5, borderTopColor: C.light, paddingTop: 14 }}>
        <Text style={{ fontFamily: FONT_B, fontSize: 6.5, color: C.accent, letterSpacing: 2, marginBottom: 8 }}>
          DISCLAIMER
        </Text>
        <Text style={{ fontFamily: FONT_I, fontSize: 7, color: C.tertiary, lineHeight: 1.5, marginBottom: 5 }}>
          This report is provided for informational purposes only and does not
          constitute legal, financial, or professional advice. The analysis,
          scores, and recommendations contained herein are based on responses
          provided during the diagnostic assessment and publicly available
          industry benchmarks. RLK Consulting, LLC makes no warranties,
          express or implied, regarding the accuracy, completeness, or
          suitability of this information for any particular purpose.
        </Text>
        <Text style={{ fontFamily: FONT_I, fontSize: 7, color: C.tertiary, lineHeight: 1.5, marginBottom: 5 }}>
          The economic estimates presented are modeled projections based on
          industry research and the specific inputs provided. Actual results
          will vary based on implementation quality, organizational context,
          market conditions, and other factors outside the scope of this assessment.
        </Text>
        <Text style={{ fontFamily: FONT_I, fontSize: 7, color: C.tertiary, lineHeight: 1.5 }}>
          This document is the confidential and proprietary property of RLK
          Consulting, LLC. Unauthorized distribution, reproduction, or disclosure
          is strictly prohibited without prior written consent.
        </Text>
      </View>
      <PageFooter />
    </Page>
  );
}

// =============================================================================
// MAIN DOCUMENT
// =============================================================================

function ReportDoc({ report, result }: { report: GeneratedReport; result: DiagnosticResult }) {
  const contentSections = report.sections.filter(sec => sec.slug !== 'executive-summary');
  return (
    <Document
      title={`RLK AI Diagnostic | ${report.companyProfile.companyName}`}
      author="RLK Consulting, LLC"
      subject="AI Readiness Diagnostic Report"
      creator="RLK Consulting AI Diagnostic"
      producer="RLK Consulting"
    >
      <CoverPage report={report} result={result} />
      <TOCPage sections={report.sections} />
      <ExecDashPage report={report} result={result} />
      {contentSections.map((sec, i) => (
        <SectionPage key={sec.slug} section={sec} num={i + 2} result={result} />
      ))}
      <CTAPage result={result} />
      <AboutPage />
    </Document>
  );
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Generate a complete PDF report buffer. Returns a Node.js Buffer ready to be
 * sent as a response body, saved to disk, or attached to an email.
 */
export async function generateReportPDF(
  report: GeneratedReport,
  result: DiagnosticResult,
): Promise<Buffer> {
  const buffer = await renderToBuffer(
    <ReportDoc report={report} result={result} />
  );
  return Buffer.from(buffer);
}
