// =============================================================================
// RLK AI Board Brief — Customization Engine
// =============================================================================
// Adapts diagnostic behavior based on industry, company size, regulatory
// intensity, and functional AI usage. Controls question weighting,
// interpretation, and recommendations.
// =============================================================================

import { CompanyProfile, Dimension, Industry } from '@/types/diagnostic';

// ---------------------------------------------------------------------------
// INDUSTRY WEIGHT MODIFIERS
// ---------------------------------------------------------------------------
// Adjusts question weights by dimension per industry to reflect what matters
// most in that sector. 1.0 = no change, >1 = more important, <1 = less.

const INDUSTRY_WEIGHT_MODIFIERS: Record<Industry, Partial<Record<Dimension, number>>> = {
  financial_services: {
    authority_structure: 1.3,    // Heavily regulated, governance matters more
    economic_translation: 1.2,  // Financial rigor expected
    decision_velocity: 0.9,     // Regulated pace is somewhat expected
  },
  insurance: {
    authority_structure: 1.3,
    workflow_integration: 1.2,  // Claims/underwriting automation is central
    economic_translation: 1.2,
  },
  healthcare: {
    authority_structure: 1.4,   // Regulatory burden highest
    workflow_integration: 1.1,
    decision_velocity: 0.8,    // Slower pace is acceptable/expected
  },
  manufacturing: {
    workflow_integration: 1.3,  // Operational integration is primary value driver
    economic_translation: 1.1,
    adoption_behavior: 1.1,
  },
  technology: {
    decision_velocity: 1.3,    // Speed is the differentiator
    adoption_behavior: 1.2,
    authority_structure: 0.8,   // Typically flatter structures
  },
  retail_ecommerce: {
    decision_velocity: 1.2,
    workflow_integration: 1.2,
    adoption_behavior: 1.1,
  },
  professional_services: {
    adoption_behavior: 1.3,    // People-driven business
    economic_translation: 1.3, // Utilization/billing focus
    workflow_integration: 1.1,
  },
  energy_utilities: {
    authority_structure: 1.2,
    workflow_integration: 1.2,
    decision_velocity: 0.8,
  },
  government: {
    authority_structure: 1.4,
    decision_velocity: 0.7,    // Bureaucratic pace expected
    workflow_integration: 1.2,
  },
  education: {
    adoption_behavior: 1.3,
    workflow_integration: 1.1,
    economic_translation: 0.9,
  },
  media_entertainment: {
    adoption_behavior: 1.2,
    decision_velocity: 1.3,
    workflow_integration: 1.1,
  },
  other: {},
};

export function getIndustryWeightModifiers(
  industry: Industry
): Partial<Record<Dimension, number>> {
  return INDUSTRY_WEIGHT_MODIFIERS[industry] || {};
}

// ---------------------------------------------------------------------------
// REGULATORY INTENSITY ADJUSTMENTS
// ---------------------------------------------------------------------------

export function getRegulatoryAdjustments(
  regulatoryIntensity: CompanyProfile['regulatoryIntensity']
): { velocityPenalty: number; authorityWeight: number; riskNarrative: string } {
  switch (regulatoryIntensity) {
    case 'very_high':
      return {
        velocityPenalty: 0.85,  // Reduce velocity expectations
        authorityWeight: 1.4,
        riskNarrative: 'Your industry operates under significant regulatory oversight. AI governance must balance innovation speed with compliance requirements. The most successful organizations in heavily regulated industries build compliance into AI development processes rather than adding it as a review layer.',
      };
    case 'high':
      return {
        velocityPenalty: 0.9,
        authorityWeight: 1.2,
        riskNarrative: 'Regulatory considerations are a meaningful factor in your AI deployment strategy. Pre-approved frameworks for common use cases can dramatically reduce time-to-deployment while maintaining compliance.',
      };
    case 'moderate':
      return {
        velocityPenalty: 0.95,
        authorityWeight: 1.1,
        riskNarrative: 'Your regulatory environment allows meaningful flexibility for AI deployment while maintaining appropriate oversight.',
      };
    case 'low':
      return {
        velocityPenalty: 1.0,
        authorityWeight: 1.0,
        riskNarrative: 'Your regulatory environment is relatively permissive for AI adoption. The primary constraints are internal governance and risk appetite rather than external regulation.',
      };
  }
}

// ---------------------------------------------------------------------------
// COMPANY SIZE INTERPRETATION CONTEXT
// ---------------------------------------------------------------------------

export function getSizeContext(employeeCount: number): {
  sizeCategory: string;
  complexityNarrative: string;
  changeManagementNote: string;
} {
  if (employeeCount < 200) {
    return {
      sizeCategory: 'small',
      complexityNarrative: 'At your organization\'s size, AI adoption can move faster with fewer coordination challenges. The key risk is limited bandwidth to sustain multiple initiatives simultaneously.',
      changeManagementNote: 'Change management at your scale is primarily about leadership clarity and rapid feedback loops.',
    };
  }
  if (employeeCount < 2000) {
    return {
      sizeCategory: 'mid-market',
      complexityNarrative: 'Mid-market organizations face a unique challenge: enough complexity to require coordination but often without the dedicated AI leadership of larger enterprises.',
      changeManagementNote: 'At your scale, targeted change management in key functions can drive organization-wide behavior shifts.',
    };
  }
  if (employeeCount < 20000) {
    return {
      sizeCategory: 'large_enterprise',
      complexityNarrative: 'Large enterprise AI adoption requires balancing centralized governance with distributed execution. The "frozen middle," where middle management neither blocks nor enables, is the primary change management challenge.',
      changeManagementNote: 'Change management at enterprise scale requires systematic approaches including executive alignment, middle-management enablement, and frontline engagement.',
    };
  }
  return {
    sizeCategory: 'mega_enterprise',
    complexityNarrative: 'At your organization\'s scale, AI transformation is a multi-year journey requiring sustained executive commitment, federated governance, and continuous capability building across geographies and business units.',
    changeManagementNote: 'Enterprise-wide change management at this scale requires dedicated transformation office, regional execution teams, and structured community of practice models.',
  };
}

// ---------------------------------------------------------------------------
// PUBLIC/PRIVATE COMPANY ADJUSTMENTS
// ---------------------------------------------------------------------------

export function getPublicPrivateContext(
  publicOrPrivate: 'public' | 'private'
): { boardNarrative: string; financialFraming: string } {
  if (publicOrPrivate === 'public') {
    return {
      boardNarrative: 'As a publicly traded company, your AI strategy must withstand investor scrutiny. Activist investors are increasingly evaluating AI capability as a proxy for long-term competitiveness. The ability to articulate measurable AI value creation is not optional.',
      financialFraming: 'AI investments should be framed in terms that map to analyst models: impact on operating margin, revenue growth contribution, and capital efficiency. Quarterly progress metrics should be established.',
    };
  }
  return {
    boardNarrative: 'As a private company, you have the advantage of longer time horizons for AI investment without quarterly earnings pressure. This should translate into more ambitious, multi-year AI strategies that create durable competitive advantage.',
    financialFraming: 'AI investments should be framed in terms of enterprise value creation, competitive positioning, and operational efficiency: metrics that drive valuation multiples.',
  };
}

// ---------------------------------------------------------------------------
// INDUSTRY-SPECIFIC INTERPRETATION THEMES
// ---------------------------------------------------------------------------

export const INDUSTRY_THEMES: Record<Industry, {
  primaryValueDriver: string;
  competitiveThreat: string;
  regulatoryContext: string;
  keyUseCases: string[];
}> = {
  financial_services: {
    primaryValueDriver: 'Risk modeling, fraud detection, customer personalization, and process automation across operations, compliance, and advisory.',
    competitiveThreat: 'Fintech challengers and Big Tech financial products are AI-native by design. Incumbents that cannot match this capability face structural disadvantage in cost-to-serve and customer experience.',
    regulatoryContext: 'AI in financial services operates under evolving regulatory frameworks including model risk management (SR 11-7), fair lending (ECOA), and emerging AI-specific guidance.',
    keyUseCases: ['fraud detection', 'credit decisioning', 'regulatory compliance', 'customer advisory', 'process automation'],
  },
  insurance: {
    primaryValueDriver: 'Claims processing acceleration, underwriting precision, actuarial modeling, and customer experience automation.',
    competitiveThreat: 'InsurTech competitors and tech-enabled MGAs are redefining customer expectations for speed, transparency, and personalization.',
    regulatoryContext: 'Insurance AI is increasingly scrutinized for fairness in pricing and claims decisions, with state-level regulations evolving rapidly.',
    keyUseCases: ['claims triage', 'underwriting automation', 'fraud detection', 'customer self-service', 'actuarial modeling'],
  },
  healthcare: {
    primaryValueDriver: 'Clinical decision support, operational efficiency, patient experience, and population health management.',
    competitiveThreat: 'Health systems that integrate AI into care delivery and operations will capture value through improved outcomes and lower costs. Those that don\'t will face reimbursement pressure.',
    regulatoryContext: 'Healthcare AI operates under HIPAA, FDA guidance for AI/ML-based devices, and CMS quality measurement frameworks.',
    keyUseCases: ['clinical documentation', 'diagnostic support', 'care coordination', 'revenue cycle', 'population health'],
  },
  manufacturing: {
    primaryValueDriver: 'Predictive maintenance, quality control, supply chain optimization, and production efficiency.',
    competitiveThreat: 'Smart manufacturing and Industry 4.0 leaders are achieving 10 to 20% efficiency advantages that compound annually.',
    regulatoryContext: 'Manufacturing AI faces quality management system requirements and industry-specific safety standards.',
    keyUseCases: ['predictive maintenance', 'quality inspection', 'supply chain optimization', 'demand forecasting', 'process optimization'],
  },
  technology: {
    primaryValueDriver: 'Product intelligence, engineering productivity, customer success prediction, and operational scaling.',
    competitiveThreat: 'AI is redefining product expectations. Technology companies that don\'t embed AI into their products risk rapid obsolescence.',
    regulatoryContext: 'Evolving AI regulation (EU AI Act, US state laws) will increasingly affect product design and deployment.',
    keyUseCases: ['engineering copilots', 'product intelligence', 'customer success', 'content generation', 'security automation'],
  },
  retail_ecommerce: {
    primaryValueDriver: 'Personalization, demand forecasting, pricing optimization, and customer service automation.',
    competitiveThreat: 'E-commerce leaders (Amazon, Shopify) are setting AI-powered standards for personalization and logistics that all retailers are measured against.',
    regulatoryContext: 'Consumer data privacy laws (CCPA, GDPR) affect AI-powered personalization and recommendation engines.',
    keyUseCases: ['demand forecasting', 'price optimization', 'personalization', 'customer service', 'inventory management'],
  },
  professional_services: {
    primaryValueDriver: 'Knowledge worker augmentation, project efficiency, client delivery acceleration, and expertise scaling.',
    competitiveThreat: 'Firms that augment their professionals with AI can deliver faster, with higher quality, at lower cost, fundamentally changing competitive dynamics and pricing models.',
    regulatoryContext: 'Professional liability and client confidentiality obligations shape AI deployment in advisory and consulting contexts.',
    keyUseCases: ['document analysis', 'research automation', 'knowledge management', 'proposal generation', 'client analytics'],
  },
  energy_utilities: {
    primaryValueDriver: 'Grid optimization, predictive maintenance, demand forecasting, and regulatory compliance automation.',
    competitiveThreat: 'Energy transition and grid modernization require AI capabilities that will separate leaders from laggards over the next decade.',
    regulatoryContext: 'Critical infrastructure regulations (NERC CIP) and environmental compliance create both constraints and opportunities for AI.',
    keyUseCases: ['grid optimization', 'predictive maintenance', 'demand forecasting', 'safety monitoring', 'regulatory compliance'],
  },
  government: {
    primaryValueDriver: 'Citizen service improvement, fraud detection, operational efficiency, and program effectiveness.',
    competitiveThreat: 'Rising citizen expectations for digital services, driven by private sector AI, create political pressure for government AI adoption.',
    regulatoryContext: 'Government AI operates under executive orders, OMB guidance, and agency-specific mandates with emphasis on equity and transparency.',
    keyUseCases: ['citizen services', 'fraud detection', 'document processing', 'program analytics', 'workforce optimization'],
  },
  education: {
    primaryValueDriver: 'Personalized learning, administrative efficiency, student success prediction, and research acceleration.',
    competitiveThreat: 'EdTech platforms and AI-enabled institutions are redefining student expectations for personalized, responsive education.',
    regulatoryContext: 'FERPA, academic integrity, and evolving institutional policies shape AI deployment in educational settings.',
    keyUseCases: ['adaptive learning', 'administrative automation', 'student retention', 'research assistance', 'assessment'],
  },
  media_entertainment: {
    primaryValueDriver: 'Content creation, audience intelligence, personalization, and production efficiency.',
    competitiveThreat: 'AI-powered content creation and distribution are lowering barriers to entry while raising audience expectations for relevance.',
    regulatoryContext: 'Copyright, rights management, and emerging AI content regulation affect production and distribution strategies.',
    keyUseCases: ['content generation', 'audience analytics', 'personalization', 'production automation', 'rights management'],
  },
  other: {
    primaryValueDriver: 'Operational efficiency, decision intelligence, customer experience, and competitive differentiation.',
    competitiveThreat: 'AI capability is rapidly becoming table stakes across all industries. Organizations without a clear AI strategy face accelerating competitive disadvantage.',
    regulatoryContext: 'Emerging AI regulation at federal and state levels will affect organizations across all industries.',
    keyUseCases: ['process automation', 'analytics', 'customer service', 'decision support', 'knowledge management'],
  },
};
