// =============================================================================
// RLK AI Board Brief — PDF Report Generator
// =============================================================================
// Renders a branded, multi-page diagnostic report using @react-pdf/renderer.
// Designed to match RLK Consulting letterhead exactly.
// =============================================================================

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer';
import type {
  DiagnosticResult,
  GeneratedReport,
  ReportSection,
  DimensionScore,
  CompositeIndex,
  Dimension,
} from '@/types/diagnostic';

// =============================================================================
// BRAND CONSTANTS (PDF-specific, matches src/lib/brand.ts)
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
  gradientBar: ['#0B1D3A', '#364E6E', '#6B7F99', '#A8B5C4', '#CED5DD'],
} as const;

const FONT_FAMILY = 'Helvetica';
const FONT_FAMILY_BOLD = 'Helvetica-Bold';
const FONT_FAMILY_OBLIQUE = 'Helvetica-Oblique';
const FONT_FAMILY_BOLD_OBLIQUE = 'Helvetica-BoldOblique';

// =============================================================================
// SHARED STYLES
// =============================================================================

const s = StyleSheet.create({
  // ---- Page ----
  page: {
    fontFamily: FONT_FAMILY,
    fontSize: 9.5,
    color: C.body,
    paddingTop: 50,
    paddingBottom: 72,
    paddingHorizontal: 54,
  },
  coverPage: {
    fontFamily: FONT_FAMILY,
    fontSize: 9.5,
    color: C.body,
    paddingTop: 0,
    paddingBottom: 72,
    paddingHorizontal: 0,
  },

  // ---- Gradient bar ----
  gradientBar: {
    flexDirection: 'row',
    height: 4,
    width: '100%',
  },
  gradientBarCover: {
    flexDirection: 'row',
    height: 8,
    width: '100%',
  },
  gradientSegment: {
    flex: 1,
  },

  // ---- Header ----
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: 8,
  },
  headerCompany: {
    fontFamily: FONT_FAMILY_BOLD,
    fontSize: 8,
    color: C.navy,
    letterSpacing: 4,
  },
  headerConfidential: {
    fontSize: 8,
    color: C.accent,
    letterSpacing: 3,
  },

  // ---- Footer ----
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 54,
    right: 54,
  },
  footerBorder: {
    borderTopWidth: 0.5,
    borderTopColor: C.light,
    paddingTop: 6,
  },
  footerConfidential: {
    fontFamily: FONT_FAMILY_BOLD,
    fontSize: 6.5,
    color: C.accent,
    textAlign: 'center',
    marginBottom: 3,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  footerText: {
    fontSize: 7,
    color: C.tertiary,
  },
  footerDisclaimer: {
    fontFamily: FONT_FAMILY_OBLIQUE,
    fontSize: 6,
    color: C.light,
    textAlign: 'center',
    lineHeight: 1.4,
  },

  // ---- Typography ----
  h1: {
    fontFamily: FONT_FAMILY_BOLD,
    fontSize: 20,
    color: C.navy,
    marginBottom: 14,
    marginTop: 4,
  },
  h2: {
    fontFamily: FONT_FAMILY_BOLD,
    fontSize: 14,
    color: C.secondary,
    marginBottom: 8,
    marginTop: 16,
  },
  h3: {
    fontFamily: FONT_FAMILY_BOLD,
    fontSize: 11.5,
    color: C.tertiary,
    marginBottom: 6,
    marginTop: 12,
  },
  paragraph: {
    fontSize: 9.5,
    color: C.body,
    lineHeight: 1.55,
    marginBottom: 8,
  },
  bold: {
    fontFamily: FONT_FAMILY_BOLD,
  },
  italic: {
    fontFamily: FONT_FAMILY_OBLIQUE,
  },
  boldItalic: {
    fontFamily: FONT_FAMILY_BOLD_OBLIQUE,
  },

  // ---- Bullet list ----
  bulletItem: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: 8,
  },
  bulletMarker: {
    width: 14,
    fontSize: 9.5,
    color: C.tertiary,
  },
  bulletText: {
    flex: 1,
    fontSize: 9.5,
    color: C.body,
    lineHeight: 1.55,
  },

  // ---- Numbered list ----
  numberedItem: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: 4,
  },
  numberMarker: {
    width: 20,
    fontSize: 9.5,
    color: C.secondary,
    fontFamily: FONT_FAMILY_BOLD,
  },

  // ---- Cover page ----
  coverContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 72,
  },
  coverCompanyName: {
    fontFamily: FONT_FAMILY_BOLD,
    fontSize: 10,
    color: C.navy,
    letterSpacing: 6,
    marginBottom: 40,
  },
  coverTitle: {
    fontFamily: FONT_FAMILY_BOLD,
    fontSize: 36,
    color: C.navy,
    marginBottom: 6,
    textAlign: 'center',
  },
  coverSubtitle: {
    fontSize: 14,
    color: C.secondary,
    textAlign: 'center',
    marginBottom: 48,
  },
  coverClientName: {
    fontFamily: FONT_FAMILY_BOLD,
    fontSize: 18,
    color: C.secondary,
    textAlign: 'center',
    marginBottom: 12,
  },
  coverDate: {
    fontSize: 11,
    color: C.tertiary,
    textAlign: 'center',
    marginBottom: 36,
  },
  coverPrepared: {
    fontSize: 10,
    color: C.tertiary,
    textAlign: 'center',
    fontFamily: FONT_FAMILY_OBLIQUE,
    marginBottom: 60,
  },
  coverConfidential: {
    fontSize: 10,
    color: C.accent,
    letterSpacing: 4,
    textAlign: 'center',
  },

  // ---- Stage classification box ----
  stageBox: {
    borderWidth: 1,
    borderColor: C.light,
    borderRadius: 4,
    padding: 16,
    marginBottom: 16,
    backgroundColor: C.offWhite,
  },
  stageBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  stageNumber: {
    fontFamily: FONT_FAMILY_BOLD,
    fontSize: 28,
    color: C.navy,
    marginRight: 12,
  },
  stageName: {
    fontFamily: FONT_FAMILY_BOLD,
    fontSize: 16,
    color: C.secondary,
  },
  stageDescription: {
    fontSize: 9,
    color: C.bodyMuted,
    lineHeight: 1.5,
  },

  // ---- Score display ----
  overallScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  overallScoreLabel: {
    fontSize: 10,
    color: C.tertiary,
    fontFamily: FONT_FAMILY_BOLD,
    marginRight: 10,
    letterSpacing: 1,
  },
  overallScoreValue: {
    fontFamily: FONT_FAMILY_BOLD,
    fontSize: 26,
    color: C.navy,
  },
  overallScoreMax: {
    fontSize: 14,
    color: C.tertiary,
    marginLeft: 2,
  },

  // ---- Dimension score bars ----
  dimensionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dimensionLabel: {
    width: 130,
    fontSize: 8.5,
    color: C.body,
    fontFamily: FONT_FAMILY_BOLD,
  },
  dimensionBarBg: {
    flex: 1,
    height: 10,
    backgroundColor: '#EDF0F4',
    borderRadius: 2,
    overflow: 'hidden',
  },
  dimensionBarFill: {
    height: 10,
    borderRadius: 2,
  },
  dimensionValue: {
    width: 32,
    fontSize: 8.5,
    color: C.secondary,
    fontFamily: FONT_FAMILY_BOLD,
    textAlign: 'right',
  },

  // ---- Composite index ----
  compositeIndexBox: {
    borderWidth: 0.5,
    borderColor: C.light,
    borderRadius: 3,
    padding: 12,
    marginBottom: 10,
  },
  compositeIndexHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  compositeIndexName: {
    fontFamily: FONT_FAMILY_BOLD,
    fontSize: 10,
    color: C.secondary,
  },
  compositeIndexScore: {
    fontFamily: FONT_FAMILY_BOLD,
    fontSize: 12,
    color: C.navy,
  },
  compositeIndexInterpretation: {
    fontSize: 8.5,
    color: C.bodyMuted,
    lineHeight: 1.4,
  },

  // ---- Economic highlight ----
  economicHighlight: {
    backgroundColor: C.navy,
    borderRadius: 4,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  economicHighlightLabel: {
    fontSize: 8,
    color: C.accent,
    letterSpacing: 2,
    marginBottom: 6,
    fontFamily: FONT_FAMILY_BOLD,
  },
  economicHighlightValue: {
    fontFamily: FONT_FAMILY_BOLD,
    fontSize: 22,
    color: C.white,
    marginBottom: 4,
  },
  economicHighlightSub: {
    fontSize: 8.5,
    color: C.light,
    textAlign: 'center',
  },

  // ---- About page ----
  aboutSection: {
    marginBottom: 20,
  },
  aboutTitle: {
    fontFamily: FONT_FAMILY_BOLD,
    fontSize: 11,
    color: C.secondary,
    marginBottom: 6,
  },
  aboutText: {
    fontSize: 9,
    color: C.body,
    lineHeight: 1.55,
    marginBottom: 6,
  },
  aboutContactRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  aboutContactLabel: {
    fontFamily: FONT_FAMILY_BOLD,
    fontSize: 9,
    color: C.tertiary,
    width: 60,
  },
  aboutContactValue: {
    fontSize: 9,
    color: C.body,
  },
  disclaimerBox: {
    borderTopWidth: 0.5,
    borderTopColor: C.light,
    paddingTop: 14,
    marginTop: 24,
  },
  disclaimerTitle: {
    fontFamily: FONT_FAMILY_BOLD,
    fontSize: 8,
    color: C.accent,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  disclaimerText: {
    fontFamily: FONT_FAMILY_OBLIQUE,
    fontSize: 7.5,
    color: C.tertiary,
    lineHeight: 1.5,
  },

  // ---- Utility ----
  sectionDivider: {
    borderBottomWidth: 0.5,
    borderBottomColor: C.light,
    marginTop: 10,
    marginBottom: 16,
  },
  spacer: {
    height: 12,
  },
  keyValueRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  keyValueLabel: {
    fontFamily: FONT_FAMILY_BOLD,
    fontSize: 9,
    color: C.tertiary,
    width: 150,
  },
  keyValueValue: {
    fontSize: 9.5,
    color: C.body,
    flex: 1,
  },
});

// =============================================================================
// MARKDOWN PARSER — Converts markdown text to React-PDF components
// =============================================================================

interface ParsedNode {
  type: 'h1' | 'h2' | 'h3' | 'paragraph' | 'bullet' | 'numbered' | 'blank';
  raw: string;
  number?: number;
}

function tokenizeMarkdown(markdown: string): ParsedNode[] {
  const lines = markdown.split('\n');
  const nodes: ParsedNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Blank line
    if (trimmed === '') {
      i++;
      continue;
    }

    // Headings
    if (trimmed.startsWith('### ')) {
      nodes.push({ type: 'h3', raw: trimmed.slice(4) });
      i++;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      nodes.push({ type: 'h2', raw: trimmed.slice(3) });
      i++;
      continue;
    }
    if (trimmed.startsWith('# ')) {
      nodes.push({ type: 'h1', raw: trimmed.slice(2) });
      i++;
      continue;
    }

    // Bullet lists (-, *, +)
    const bulletMatch = trimmed.match(/^[-*+]\s+(.*)$/);
    if (bulletMatch) {
      // Gather continuation lines (indented lines following a bullet)
      let text = bulletMatch[1];
      i++;
      while (i < lines.length) {
        const nextTrimmed = lines[i].trim();
        // Stop on blank lines, new bullets, headings, or numbered items
        if (
          nextTrimmed === '' ||
          /^[-*+]\s+/.test(nextTrimmed) ||
          /^#{1,3}\s/.test(nextTrimmed) ||
          /^\d+[.)]\s+/.test(nextTrimmed)
        ) {
          break;
        }
        text += ' ' + nextTrimmed;
        i++;
      }
      nodes.push({ type: 'bullet', raw: text });
      continue;
    }

    // Numbered lists
    const numberedMatch = trimmed.match(/^(\d+)[.)]\s+(.*)$/);
    if (numberedMatch) {
      let text = numberedMatch[2];
      const num = parseInt(numberedMatch[1], 10);
      i++;
      while (i < lines.length) {
        const nextTrimmed = lines[i].trim();
        if (
          nextTrimmed === '' ||
          /^[-*+]\s+/.test(nextTrimmed) ||
          /^#{1,3}\s/.test(nextTrimmed) ||
          /^\d+[.)]\s+/.test(nextTrimmed)
        ) {
          break;
        }
        text += ' ' + nextTrimmed;
        i++;
      }
      nodes.push({ type: 'numbered', raw: text, number: num });
      continue;
    }

    // Paragraph — collect consecutive lines
    let paragraphText = trimmed;
    i++;
    while (i < lines.length) {
      const nextTrimmed = lines[i].trim();
      if (
        nextTrimmed === '' ||
        /^[-*+]\s+/.test(nextTrimmed) ||
        /^#{1,3}\s/.test(nextTrimmed) ||
        /^\d+[.)]\s+/.test(nextTrimmed)
      ) {
        break;
      }
      paragraphText += ' ' + nextTrimmed;
      i++;
    }
    nodes.push({ type: 'paragraph', raw: paragraphText });
  }

  return nodes;
}

/**
 * Parse inline formatting (**bold**, *italic*, ***bold italic***) into
 * React-PDF Text spans. Handles nested bold/italic combinations.
 */
function renderInlineText(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Match ***bold italic***, **bold**, or *italic*
  const regex = /(\*{3}(.*?)\*{3}|\*{2}(.*?)\*{2}|\*(.*?)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    // Text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[2] !== undefined) {
      // ***bold italic***
      parts.push(
        <Text key={key++} style={s.boldItalic}>
          {match[2]}
        </Text>
      );
    } else if (match[3] !== undefined) {
      // **bold**
      parts.push(
        <Text key={key++} style={s.bold}>
          {match[3]}
        </Text>
      );
    } else if (match[4] !== undefined) {
      // *italic*
      parts.push(
        <Text key={key++} style={s.italic}>
          {match[4]}
        </Text>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last match
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

function MarkdownContent({ markdown }: { markdown: string }): React.JSX.Element {
  const nodes = tokenizeMarkdown(markdown);

  return (
    <View>
      {nodes.map((node, i) => {
        switch (node.type) {
          case 'h1':
            return (
              <Text key={i} style={s.h1}>
                {node.raw}
              </Text>
            );
          case 'h2':
            return (
              <Text key={i} style={s.h2}>
                {node.raw}
              </Text>
            );
          case 'h3':
            return (
              <Text key={i} style={s.h3}>
                {node.raw}
              </Text>
            );
          case 'bullet':
            return (
              <View key={i} style={s.bulletItem}>
                <Text style={s.bulletMarker}>{'\u2022'}</Text>
                <Text style={s.bulletText}>{renderInlineText(node.raw)}</Text>
              </View>
            );
          case 'numbered':
            return (
              <View key={i} style={s.numberedItem}>
                <Text style={s.numberMarker}>{node.number}.</Text>
                <Text style={s.bulletText}>{renderInlineText(node.raw)}</Text>
              </View>
            );
          case 'paragraph':
          default:
            return (
              <Text key={i} style={s.paragraph}>
                {renderInlineText(node.raw)}
              </Text>
            );
        }
      })}
    </View>
  );
}

// =============================================================================
// SHARED PAGE COMPONENTS
// =============================================================================

function GradientBar({ tall }: { tall?: boolean }): React.JSX.Element {
  return (
    <View style={tall ? s.gradientBarCover : s.gradientBar} fixed>
      {C.gradientBar.map((color, i) => (
        <View key={i} style={[s.gradientSegment, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

function PageHeader(): React.JSX.Element {
  return (
    <View fixed>
      <GradientBar />
      <View style={[s.header, { paddingHorizontal: 0 }]}>
        <Text style={s.headerCompany}>RLK CONSULTING</Text>
        <Text style={s.headerConfidential}>CONFIDENTIAL</Text>
      </View>
    </View>
  );
}

function PageFooter(): React.JSX.Element {
  return (
    <View style={s.footer} fixed>
      <View style={s.footerBorder}>
        <Text style={s.footerConfidential}>CONFIDENTIAL &amp; PROPRIETARY</Text>
        <View style={s.footerRow}>
          <Text style={s.footerText}>Prepared by RLK Consulting, LLC</Text>
          <Text
            style={s.footerText}
            render={({ pageNumber }) => `Page ${pageNumber}`}
          />
        </View>
        <Text style={s.footerDisclaimer}>
          This document contains information proprietary to RLK Consulting, LLC.
          Unauthorized distribution, reproduction, or disclosure is strictly
          prohibited.
        </Text>
      </View>
    </View>
  );
}

// =============================================================================
// DATA VISUALIZATION COMPONENTS
// =============================================================================

const DIMENSION_LABELS: Record<Dimension, string> = {
  adoption_behavior: 'Adoption Behavior',
  authority_structure: 'Authority Structure',
  workflow_integration: 'Workflow Integration',
  decision_velocity: 'Decision Velocity',
  economic_translation: 'Economic Translation',
};

function barColor(score: number): string {
  if (score >= 70) return '#1A6B3C';
  if (score >= 45) return C.secondary;
  return '#B85C38';
}

function DimensionScoreBars({
  scores,
}: {
  scores: DimensionScore[];
}): React.JSX.Element {
  const sorted = [...scores].sort((a, b) => b.normalizedScore - a.normalizedScore);

  return (
    <View style={{ marginTop: 8, marginBottom: 12 }}>
      {sorted.map((dim) => (
        <View key={dim.dimension} style={s.dimensionRow}>
          <Text style={s.dimensionLabel}>
            {DIMENSION_LABELS[dim.dimension] || dim.dimension}
          </Text>
          <View style={s.dimensionBarBg}>
            <View
              style={[
                s.dimensionBarFill,
                {
                  width: `${Math.max(dim.normalizedScore, 2)}%`,
                  backgroundColor: barColor(dim.normalizedScore),
                },
              ]}
            />
          </View>
          <Text style={s.dimensionValue}>{Math.round(dim.normalizedScore)}</Text>
        </View>
      ))}
    </View>
  );
}

function CompositeIndexDisplay({
  indices,
}: {
  indices: CompositeIndex[];
}): React.JSX.Element {
  return (
    <View style={{ marginTop: 8, marginBottom: 12 }}>
      {indices.map((idx) => (
        <View key={idx.slug} style={s.compositeIndexBox}>
          <View style={s.compositeIndexHeader}>
            <Text style={s.compositeIndexName}>{idx.name}</Text>
            <Text style={s.compositeIndexScore}>
              {Math.round(idx.score)} / 100
            </Text>
          </View>
          <Text style={s.compositeIndexInterpretation}>
            {idx.interpretation}
          </Text>
        </View>
      ))}
    </View>
  );
}

function StageClassificationBox({
  stage,
}: {
  stage: DiagnosticResult['stageClassification'];
}): React.JSX.Element {
  return (
    <View style={s.stageBox}>
      <View style={s.stageBoxHeader}>
        <Text style={s.stageNumber}>{stage.primaryStage}</Text>
        <View>
          <Text style={s.stageName}>{stage.stageName}</Text>
          <Text style={{ fontSize: 7.5, color: C.tertiary }}>
            AI Maturity Stage (of 5)
          </Text>
        </View>
      </View>
      <Text style={s.stageDescription}>{stage.stageDescription}</Text>
    </View>
  );
}

function EconomicHighlight({
  estimate,
}: {
  estimate: DiagnosticResult['economicEstimate'];
}): React.JSX.Element {
  const midpoint =
    (estimate.unrealizedValueLow + estimate.unrealizedValueHigh) / 2;

  return (
    <View style={s.economicHighlight}>
      <Text style={s.economicHighlightLabel}>ESTIMATED UNREALIZED AI VALUE</Text>
      <Text style={s.economicHighlightValue}>
        {formatCurrency(estimate.unrealizedValueLow)} &ndash;{' '}
        {formatCurrency(estimate.unrealizedValueHigh)}
      </Text>
      <Text style={s.economicHighlightSub}>
        Midpoint: {formatCurrency(midpoint)} annually | Current capture:{' '}
        {estimate.currentCapturePercent}% of potential
      </Text>
    </View>
  );
}

// =============================================================================
// PAGE COMPONENTS
// =============================================================================

function CoverPage({
  report,
}: {
  report: GeneratedReport;
}): React.JSX.Element {
  const date = new Date(report.generatedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Page size="LETTER" style={s.coverPage}>
      <GradientBar tall />
      <View style={s.coverContent}>
        <Text style={s.coverCompanyName}>RLK CONSULTING</Text>
        <Text style={s.coverTitle}>AI Board Brief</Text>
        <Text style={s.coverSubtitle}>
          Organizational AI Readiness Diagnostic
        </Text>
        <Text style={s.coverClientName}>{report.companyProfile.companyName}</Text>
        <Text style={s.coverDate}>{date}</Text>
        <Text style={s.coverPrepared}>
          Prepared exclusively for {report.companyProfile.companyName}
        </Text>
        <Text style={s.coverConfidential}>CONFIDENTIAL</Text>
      </View>
      <PageFooter />
    </Page>
  );
}

function ExecutiveSummaryPage({
  report,
  result,
}: {
  report: GeneratedReport;
  result: DiagnosticResult;
}): React.JSX.Element {
  const execSection = report.sections.find(
    (sec) => sec.slug === 'executive-summary'
  );

  return (
    <Page size="LETTER" style={s.page}>
      <PageHeader />
      <Text style={s.h1}>Executive Summary</Text>
      <View style={s.sectionDivider} />

      {/* Overall Score */}
      <View style={s.overallScoreRow}>
        <Text style={s.overallScoreLabel}>OVERALL SCORE</Text>
        <Text style={s.overallScoreValue}>{Math.round(result.overallScore)}</Text>
        <Text style={s.overallScoreMax}> / 100</Text>
      </View>

      {/* Stage classification */}
      <StageClassificationBox stage={result.stageClassification} />

      {/* Economic headline */}
      <EconomicHighlight estimate={result.economicEstimate} />

      {/* AI-generated executive summary */}
      {execSection && <MarkdownContent markdown={execSection.content} />}

      <PageFooter />
    </Page>
  );
}

/**
 * Determine which data visualizations to render alongside a report section,
 * based on its slug.
 */
function SectionVisuals({
  slug,
  result,
}: {
  slug: string;
  result: DiagnosticResult;
}): React.JSX.Element | null {
  switch (slug) {
    case 'ai-posture-diagnosis':
      return (
        <View>
          <Text style={s.h3}>Dimension Scores</Text>
          <DimensionScoreBars scores={result.dimensionScores} />
          <Text style={s.h3}>Composite Indices</Text>
          <CompositeIndexDisplay indices={result.compositeIndices} />
        </View>
      );

    case 'structural-constraints':
      return (
        <View>
          <Text style={s.h3}>Structural Dimension Breakdown</Text>
          <DimensionScoreBars
            scores={result.dimensionScores.filter((d) =>
              ['authority_structure', 'decision_velocity'].includes(d.dimension)
            )}
          />
        </View>
      );

    case 'financial-impact':
      return (
        <View>
          <EconomicHighlight estimate={result.economicEstimate} />
          <View style={{ marginBottom: 12 }}>
            <View style={s.keyValueRow}>
              <Text style={s.keyValueLabel}>Productivity Potential</Text>
              <Text style={s.keyValueValue}>
                {result.economicEstimate.productivityPotentialPercent}% of
                workforce capacity
              </Text>
            </View>
            <View style={s.keyValueRow}>
              <Text style={s.keyValueLabel}>Current Capture Rate</Text>
              <Text style={s.keyValueValue}>
                {result.economicEstimate.currentCapturePercent}% of potential
              </Text>
            </View>
            <View style={s.keyValueRow}>
              <Text style={s.keyValueLabel}>Annual Wasted Hours</Text>
              <Text style={s.keyValueValue}>
                {result.economicEstimate.annualWastedHours.toLocaleString()}{' '}
                hours
              </Text>
            </View>
            <View style={s.keyValueRow}>
              <Text style={s.keyValueLabel}>Cost Per Employee</Text>
              <Text style={s.keyValueValue}>
                {formatCurrency(result.economicEstimate.costPerEmployee)} /
                year
              </Text>
            </View>
            <View style={s.keyValueRow}>
              <Text style={s.keyValueLabel}>Industry Benchmark</Text>
              <Text style={s.keyValueValue}>
                {result.economicEstimate.industryBenchmark}
              </Text>
            </View>
          </View>
        </View>
      );

    case 'competitive-positioning':
      return (
        <View>
          <Text style={s.h3}>Competitive Readiness Scores</Text>
          <DimensionScoreBars scores={result.dimensionScores} />
        </View>
      );

    default:
      return null;
  }
}

/**
 * Renders a standard report section (pages 3-7). Each section gets its own
 * Page break so content flows naturally across multiple pages when needed.
 */
function ReportSectionPages({
  section,
  result,
}: {
  section: ReportSection;
  result: DiagnosticResult;
}): React.JSX.Element {
  return (
    <Page size="LETTER" style={s.page} wrap>
      <PageHeader />
      <Text style={s.h1}>{section.title}</Text>
      <View style={s.sectionDivider} />

      {/* Data visualizations specific to this section */}
      <SectionVisuals slug={section.slug} result={result} />

      {/* AI-generated narrative content */}
      <MarkdownContent markdown={section.content} />

      <PageFooter />
    </Page>
  );
}

function AboutPage(): React.JSX.Element {
  return (
    <Page size="LETTER" style={s.page}>
      <PageHeader />
      <Text style={s.h1}>About RLK Consulting</Text>
      <View style={s.sectionDivider} />

      <View style={s.aboutSection}>
        <Text style={s.aboutText}>
          RLK Consulting is a strategic advisory firm specializing in AI
          transformation for mid-market and enterprise organizations. We help
          boards, C-suites, and operating leaders translate AI potential into
          measurable business value.
        </Text>
        <Text style={s.aboutText}>
          Our AI Board Brief diagnostic is designed to give organizational
          leaders the same caliber of AI readiness analysis that Fortune 100
          companies receive from top-tier strategy firms — made accessible,
          actionable, and specific to your organization.
        </Text>
        <Text style={s.aboutText}>
          We do not sell software. We do not take equity. We provide clear-eyed,
          data-driven analysis and concrete recommendations that help leadership
          teams make informed decisions about AI strategy and investment.
        </Text>
      </View>

      <View style={s.aboutSection}>
        <Text style={s.aboutTitle}>Contact</Text>
        <View style={s.aboutContactRow}>
          <Text style={s.aboutContactLabel}>Web</Text>
          <Text style={s.aboutContactValue}>rlkconsultingco.com</Text>
        </View>
        <View style={s.aboutContactRow}>
          <Text style={s.aboutContactLabel}>Email</Text>
          <Text style={s.aboutContactValue}>hello@rlkconsultingco.com</Text>
        </View>
      </View>

      <View style={s.disclaimerBox}>
        <Text style={s.disclaimerTitle}>DISCLAIMER</Text>
        <Text style={s.disclaimerText}>
          This report is provided for informational purposes only and does not
          constitute legal, financial, or professional advice. The analysis,
          scores, and recommendations contained herein are based on responses
          provided during the diagnostic assessment and publicly available
          industry benchmarks. RLK Consulting, LLC makes no warranties,
          express or implied, regarding the accuracy, completeness, or
          suitability of this information for any particular purpose.
        </Text>
        <View style={s.spacer} />
        <Text style={s.disclaimerText}>
          The economic estimates presented are modeled projections based on
          industry research and the specific inputs provided. Actual results
          will vary based on implementation quality, organizational context,
          market conditions, and other factors outside the scope of this
          assessment. Past performance of AI initiatives in comparable
          organizations does not guarantee future results.
        </Text>
        <View style={s.spacer} />
        <Text style={s.disclaimerText}>
          This document is the confidential and proprietary property of RLK
          Consulting, LLC. Unauthorized distribution, reproduction, or
          disclosure of this material is strictly prohibited without the prior
          written consent of RLK Consulting, LLC.
        </Text>
      </View>

      <PageFooter />
    </Page>
  );
}

// =============================================================================
// MAIN DOCUMENT
// =============================================================================

function ReportDocument({
  report,
  result,
}: {
  report: GeneratedReport;
  result: DiagnosticResult;
}): React.JSX.Element {
  // Filter out executive summary — it gets its own dedicated page
  const contentSections = report.sections.filter(
    (sec) => sec.slug !== 'executive-summary'
  );

  return (
    <Document
      title={`AI Board Brief — ${report.companyProfile.companyName}`}
      author="RLK Consulting, LLC"
      subject="AI Readiness Diagnostic Report"
      creator="RLK Consulting AI Board Brief"
      producer="RLK Consulting"
    >
      {/* Page 1: Cover */}
      <CoverPage report={report} />

      {/* Page 2: Executive Summary */}
      <ExecutiveSummaryPage report={report} result={result} />

      {/* Pages 3–7: Report Sections */}
      {contentSections.map((section) => (
        <ReportSectionPages
          key={section.slug}
          section={section}
          result={result}
        />
      ))}

      {/* Final Page: About / Contact / Disclaimer */}
      <AboutPage />
    </Document>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function formatCurrency(value: number): string {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Generate a complete PDF report buffer from a GeneratedReport and its
 * underlying DiagnosticResult. Returns a Node.js Buffer ready to be sent
 * as a response body, saved to disk, or attached to an email.
 */
export async function generateReportPDF(
  report: GeneratedReport,
  result: DiagnosticResult
): Promise<Buffer> {
  const buffer = await renderToBuffer(
    <ReportDocument report={report} result={result} />
  );
  return Buffer.from(buffer);
}
