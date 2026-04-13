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
  consumer_retail: {
    workflow_integration: 1.2,  // In-store and e-commerce integration critical
    decision_velocity: 1.2,    // Fast-moving consumer trends demand agility
    adoption_behavior: 1.1,
  },
  federal_government: {
    authority_structure: 1.5,   // Strict procurement and authority frameworks
    decision_velocity: 0.7,    // Federal acquisition and ATO processes are slow
    workflow_integration: 1.2,
  },
  state_local_government: {
    authority_structure: 1.3,
    decision_velocity: 0.8,    // Faster than federal but still bureaucratic
    workflow_integration: 1.3,  // Citizen-facing service integration is key
  },
  nonprofit: {
    economic_translation: 1.3,  // Must demonstrate impact per dollar
    adoption_behavior: 1.2,     // Staff buy-in critical with limited resources
    authority_structure: 0.9,   // Typically flatter governance
  },
  aerospace_defense: {
    authority_structure: 1.4,   // ITAR, clearance, and compliance requirements
    workflow_integration: 1.3,  // Complex systems integration across programs
    economic_translation: 1.1,
    decision_velocity: 0.8,    // Deliberate pace due to safety and security
  },
  telecommunications: {
    workflow_integration: 1.3,  // Network operations and OSS/BSS integration
    decision_velocity: 1.1,    // Competitive pressure demands speed
    economic_translation: 1.2, // ARPU and churn economics are paramount
  },
  hospitality_travel: {
    decision_velocity: 1.3,    // Real-time pricing and demand shifts
    adoption_behavior: 1.2,    // Frontline workforce adoption is critical
    workflow_integration: 1.1,
  },
  real_estate: {
    economic_translation: 1.3,  // Deal economics and portfolio NOI drive everything
    workflow_integration: 1.1,
    decision_velocity: 1.1,    // Market timing matters
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
  shipping_logistics: {
    workflow_integration: 1.3,  // Fleet/route/warehouse automation is central
    economic_translation: 1.2, // Thin margins demand rigorous cost tracking
    decision_velocity: 1.1,    // Real-time operational decisions matter
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
  consumer_retail: {
    primaryValueDriver: 'Inventory optimization, hyper-personalized customer experiences, supply chain resilience, and unified commerce across physical and digital channels.',
    competitiveThreat: 'DTC brands and AI-native retailers like Shein and Temu are compressing product cycles and price-matching at machine speed, forcing legacy retailers to match or lose share.',
    regulatoryContext: 'Consumer data privacy laws (CCPA, GDPR, state-level biometric laws) and FTC enforcement on algorithmic pricing and dark patterns constrain personalization strategies.',
    keyUseCases: ['demand forecasting and inventory optimization', 'real-time personalized merchandising', 'supply chain disruption prediction', 'customer lifetime value modeling', 'shelf and assortment analytics'],
  },
  federal_government: {
    primaryValueDriver: 'Citizen service modernization, fraud detection and improper payment prevention, national security intelligence, and operational efficiency across agencies.',
    competitiveThreat: 'Peer nations are investing heavily in AI for defense and intelligence. Domestically, citizen expectations for digital services set by the private sector create political urgency for modernization.',
    regulatoryContext: 'Federal AI deployment is governed by FedRAMP authorization, OMB AI guidance (M-24-10), the Executive Order on AI, NIST AI RMF, and agency-specific ATOs with emphasis on equity and civil liberties.',
    keyUseCases: ['fraud detection and improper payment prevention', 'citizen services chatbots and case management', 'national security intelligence analysis', 'document processing and adjudication', 'regulatory enforcement prioritization'],
  },
  state_local_government: {
    primaryValueDriver: '311 service optimization, permitting and licensing acceleration, public safety analytics, and constituent engagement across municipal operations.',
    competitiveThreat: 'Residents compare government services to private sector digital experiences. Jurisdictions that modernize attract talent and businesses; those that lag face declining tax bases and constituent trust.',
    regulatoryContext: 'State-level AI legislation is proliferating (CO SB 205, NYC Local Law 144), alongside open records laws, ADA accessibility requirements, and emerging municipal AI governance frameworks.',
    keyUseCases: ['311 request routing and resolution prediction', 'permit and license processing automation', 'public safety predictive analytics', 'infrastructure maintenance prioritization', 'code enforcement and inspection scheduling'],
  },
  nonprofit: {
    primaryValueDriver: 'Donor analytics and fundraising optimization, program effectiveness measurement, grant management, and mission-impact amplification with constrained resources.',
    competitiveThreat: 'Donors and foundations increasingly expect data-driven impact evidence. Nonprofits that cannot demonstrate measurable outcomes lose funding to those that can, and AI-enabled peers are setting new efficiency benchmarks.',
    regulatoryContext: 'IRS reporting requirements, grant compliance obligations, donor data stewardship, and state charitable solicitation laws shape AI deployment in the sector.',
    keyUseCases: ['donor propensity modeling and gift optimization', 'program outcome prediction and measurement', 'grant application and compliance automation', 'volunteer matching and engagement optimization', 'beneficiary needs assessment and service routing'],
  },
  aerospace_defense: {
    primaryValueDriver: 'Predictive maintenance for fleet readiness, supply chain resilience across complex multi-tier programs, defense system optimization, and engineering productivity acceleration.',
    competitiveThreat: 'Lockheed Martin, Raytheon, Northrop Grumman, and emerging defense-tech startups (Anduril, Shield AI) are racing to embed AI into platforms and proposals. Primes without AI capability risk losing next-generation program bids.',
    regulatoryContext: 'ITAR export controls, DFARS cybersecurity requirements (CMMC), DoD Responsible AI principles, and classified environment constraints create unique deployment complexity.',
    keyUseCases: ['predictive maintenance and fleet readiness optimization', 'supply chain risk monitoring across sub-tier suppliers', 'engineering design and simulation acceleration', 'test and evaluation automation', 'mission planning and logistics optimization'],
  },
  telecommunications: {
    primaryValueDriver: 'Network optimization and autonomous operations, customer churn prediction and retention, 5G monetization, and service assurance at scale.',
    competitiveThreat: 'T-Mobile, AT&T, and Verizon are investing billions in AI-driven network automation and customer experience. MVNOs and cloud-native operators are using AI to compete on service quality with a fraction of the headcount.',
    regulatoryContext: 'FCC regulations on network reliability, CPNI customer data protections, net neutrality considerations, and emerging state-level AI transparency requirements affect deployment strategies.',
    keyUseCases: ['network anomaly detection and self-healing', 'customer churn prediction and proactive retention', 'dynamic spectrum management and 5G optimization', 'field service dispatch optimization', 'revenue assurance and fraud detection'],
  },
  hospitality_travel: {
    primaryValueDriver: 'Dynamic pricing and revenue management, guest personalization across the journey, operational efficiency in labor-intensive environments, and demand forecasting.',
    competitiveThreat: 'Booking.com, Airbnb, and OTA platforms use AI to capture guest relationships before brands can. Hotel and airline groups that fail to personalize at scale will see direct bookings erode further.',
    regulatoryContext: 'Consumer protection laws around dynamic pricing transparency, ADA accommodation requirements, data privacy (especially cross-border guest data), and labor regulations constrain AI deployment.',
    keyUseCases: ['dynamic pricing and revenue optimization', 'personalized guest experience orchestration', 'demand forecasting and staffing optimization', 'predictive maintenance for property and fleet', 'sentiment analysis and reputation management'],
  },
  real_estate: {
    primaryValueDriver: 'Property valuation and market prediction, tenant experience optimization, portfolio performance analytics, and deal origination intelligence.',
    competitiveThreat: 'PropTech firms like Zillow, Redfin, and CoStar are leveraging AI to disintermediate traditional players. Institutional investors with AI-driven underwriting are executing faster and capturing off-market opportunities.',
    regulatoryContext: 'Fair Housing Act compliance on algorithmic valuations, state real estate licensing laws, CFPB scrutiny of automated lending decisions, and ESG reporting requirements affect AI strategies.',
    keyUseCases: ['automated property valuation and comp analysis', 'market trend prediction and investment signal detection', 'tenant experience and smart building optimization', 'lease abstraction and portfolio analytics', 'construction project monitoring and risk assessment'],
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
  shipping_logistics: {
    primaryValueDriver: 'Route optimization, predictive ETAs, warehouse automation, and end-to-end supply chain visibility.',
    competitiveThreat: 'Amazon and AI-native freight platforms are setting new standards for speed, cost, and transparency that legacy carriers must match or face margin erosion.',
    regulatoryContext: 'Cross-border customs compliance, hazardous materials handling, and evolving emissions reporting requirements create both constraints and high-value automation targets.',
    keyUseCases: ['route optimization', 'demand forecasting', 'warehouse robotics', 'predictive maintenance', 'customs and compliance automation'],
  },
  other: {
    primaryValueDriver: 'Operational efficiency, decision intelligence, customer experience, and competitive differentiation.',
    competitiveThreat: 'AI capability is rapidly becoming table stakes across all industries. Organizations without a clear AI strategy face accelerating competitive disadvantage.',
    regulatoryContext: 'Emerging AI regulation at federal and state levels will affect organizations across all industries.',
    keyUseCases: ['process automation', 'analytics', 'customer service', 'decision support', 'knowledge management'],
  },
};
