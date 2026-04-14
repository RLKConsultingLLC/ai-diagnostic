// =============================================================================
// RLK AI Diagnostic — Customization Engine
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
  insurance: {
    authority_structure: 1.3,
    workflow_integration: 1.2,  // Claims/underwriting automation is central
    economic_translation: 1.2,
  },
  banking: {
    authority_structure: 1.3,    // Heavily regulated, governance matters more
    economic_translation: 1.2,  // Financial rigor expected
    decision_velocity: 0.9,     // Regulated pace is somewhat expected
  },
  capital_markets: {
    authority_structure: 1.3,    // Regulatory oversight on trading and risk
    economic_translation: 1.2,  // P&L attribution is core
    decision_velocity: 0.9,
  },
  asset_wealth_management: {
    authority_structure: 1.3,    // Fiduciary and compliance obligations
    economic_translation: 1.2,  // AUM growth and fee optimization
    decision_velocity: 0.9,
  },
  investment_banking: {
    economic_translation: 1.4,  // Deal economics and fee revenue drive everything
    decision_velocity: 1.2,     // Speed to close is competitive advantage
    authority_structure: 1.2,   // Regulatory and compliance oversight
  },
  private_equity: {
    economic_translation: 1.4,  // Portfolio value creation is the core metric
    decision_velocity: 1.2,     // Deal speed and portfolio turnaround pace
    workflow_integration: 1.1,  // Portfolio company operational integration
  },
  venture_capital: {
    decision_velocity: 1.3,     // Speed of deal sourcing and evaluation
    economic_translation: 1.2,  // Fund returns and portfolio valuation
    authority_structure: 0.8,   // Lean, flat organizational structures
  },
  hedge_funds: {
    decision_velocity: 1.4,     // Trading speed and signal generation
    economic_translation: 1.3,  // Alpha generation and risk-adjusted returns
    authority_structure: 1.1,   // Risk and compliance frameworks
  },
  healthcare_providers: {
    authority_structure: 1.4,   // Regulatory burden highest
    workflow_integration: 1.1,
    decision_velocity: 0.8,    // Slower pace is acceptable/expected
  },
  healthcare_payers: {
    authority_structure: 1.4,   // CMS and state regulatory oversight
    workflow_integration: 1.1,
    decision_velocity: 0.8,
  },
  healthcare_services: {
    authority_structure: 1.3,   // HIPAA, state licensing, and quality accreditation
    workflow_integration: 1.2,  // Multi-site service coordination
    adoption_behavior: 1.1,    // Clinical and administrative staff enablement
  },
  life_sciences_pharma: {
    authority_structure: 1.4,   // FDA and clinical trial compliance
    workflow_integration: 1.1,
    decision_velocity: 0.8,
  },
  retail: {
    workflow_integration: 1.2,  // In-store and e-commerce integration critical
    decision_velocity: 1.2,    // Fast-moving consumer trends demand agility
    adoption_behavior: 1.1,
  },
  ecommerce_digital: {
    decision_velocity: 1.2,
    workflow_integration: 1.2,
    adoption_behavior: 1.1,
  },
  cpg: {
    workflow_integration: 1.2,  // Supply chain and channel integration
    decision_velocity: 1.2,    // Consumer trends move fast
    adoption_behavior: 1.1,
  },
  dtc: {
    decision_velocity: 1.3,    // Rapid iteration on customer acquisition and retention
    adoption_behavior: 1.2,    // Lean teams must adopt quickly
    economic_translation: 1.2, // Unit economics and CAC/LTV drive decisions
  },
  food_beverage: {
    workflow_integration: 1.2,  // Supply chain, production, and distribution integration
    decision_velocity: 1.2,    // Seasonal demand and trend responsiveness
    economic_translation: 1.1, // Thin margins require precise cost management
  },
  manufacturing_discrete: {
    workflow_integration: 1.3,  // Operational integration is primary value driver
    economic_translation: 1.1,
    adoption_behavior: 1.1,
  },
  manufacturing_process: {
    workflow_integration: 1.3,  // Continuous process optimization
    economic_translation: 1.1,
    adoption_behavior: 1.1,
  },
  automotive: {
    workflow_integration: 1.3,  // Production line and supply chain integration
    economic_translation: 1.1,
    adoption_behavior: 1.1,
  },
  aerospace_defense: {
    authority_structure: 1.4,   // ITAR, clearance, and compliance requirements
    workflow_integration: 1.3,  // Complex systems integration across programs
    economic_translation: 1.1,
    decision_velocity: 0.8,    // Deliberate pace due to safety and security
  },
  energy_oil_gas: {
    authority_structure: 1.2,
    workflow_integration: 1.2,
    decision_velocity: 0.8,
  },
  utilities: {
    authority_structure: 1.2,
    workflow_integration: 1.2,
    decision_velocity: 0.8,
  },
  chemicals_materials: {
    workflow_integration: 1.3,  // Process optimization and supply chain integration
    authority_structure: 1.2,   // EPA, OSHA, and chemical safety regulations
    economic_translation: 1.1,  // Commodity margin optimization
    decision_velocity: 0.9,     // Safety-first culture moderates pace
  },
  industrial_services: {
    workflow_integration: 1.3,  // Field service and project coordination
    adoption_behavior: 1.2,    // Field workforce enablement is critical
    economic_translation: 1.1, // Utilization and project margin focus
  },
  telecommunications: {
    workflow_integration: 1.3,  // Network operations and OSS/BSS integration
    decision_velocity: 1.1,    // Competitive pressure demands speed
    economic_translation: 1.2, // ARPU and churn economics are paramount
  },
  media_entertainment: {
    adoption_behavior: 1.2,
    decision_velocity: 1.3,
    workflow_integration: 1.1,
  },
  software_saas: {
    decision_velocity: 1.3,    // Speed is the differentiator
    adoption_behavior: 1.2,
    authority_structure: 0.8,   // Typically flatter structures
  },
  it_services: {
    adoption_behavior: 1.3,    // Consultant and delivery staff enablement
    economic_translation: 1.2, // Utilization rates and project margins
    workflow_integration: 1.1, // Multi-client delivery platform integration
  },
  hardware_electronics: {
    decision_velocity: 1.3,    // Speed is the differentiator
    adoption_behavior: 1.2,
    authority_structure: 0.8,
  },
  transportation: {
    workflow_integration: 1.3,  // Fleet and route automation
    economic_translation: 1.2, // Thin margins demand rigorous cost tracking
    decision_velocity: 1.1,
  },
  shipping_logistics: {
    workflow_integration: 1.3,  // Fleet/route/warehouse automation is central
    economic_translation: 1.2, // Thin margins demand rigorous cost tracking
    decision_velocity: 1.1,    // Real-time operational decisions matter
  },
  infrastructure_transport: {
    authority_structure: 1.3,   // Government oversight and safety regulations
    workflow_integration: 1.3,  // Complex multi-modal system integration
    decision_velocity: 0.8,    // Public procurement and safety review pace
  },
  real_estate_commercial: {
    economic_translation: 1.3,  // Deal economics and portfolio NOI drive everything
    workflow_integration: 1.1,
    decision_velocity: 1.1,    // Market timing matters
  },
  real_estate_residential: {
    economic_translation: 1.2,  // Transaction volume and pricing accuracy
    decision_velocity: 1.2,     // Market timing and speed to close
    adoption_behavior: 1.1,     // Agent and broker technology adoption
  },
  construction_engineering: {
    workflow_integration: 1.3,  // Project and site integration
    economic_translation: 1.1,
    adoption_behavior: 1.1,
  },
  government_federal: {
    authority_structure: 1.5,   // Strict procurement and authority frameworks
    decision_velocity: 0.7,    // Federal acquisition and ATO processes are slow
    workflow_integration: 1.2,
  },
  government_state_local: {
    authority_structure: 1.3,
    decision_velocity: 0.8,    // Faster than federal but still bureaucratic
    workflow_integration: 1.3,  // Citizen-facing service integration is key
  },
  defense_contractors: {
    authority_structure: 1.4,   // ITAR, CMMC, and classified environment constraints
    workflow_integration: 1.3,  // Complex program and supply chain integration
    economic_translation: 1.1,  // Contract margin and bid competitiveness
    decision_velocity: 0.8,     // Government acquisition timelines dictate pace
  },
  nonprofit_ngo: {
    economic_translation: 1.3,  // Must demonstrate impact per dollar
    adoption_behavior: 1.2,     // Staff buy-in critical with limited resources
    authority_structure: 0.9,   // Typically flatter governance
  },
  consulting_services: {
    adoption_behavior: 1.3,    // People-driven business
    economic_translation: 1.3, // Utilization/billing focus
    workflow_integration: 1.1,
  },
  legal_services: {
    adoption_behavior: 1.3,    // Attorney and paralegal enablement is key
    authority_structure: 1.2,   // Ethics rules, privilege, and malpractice concerns
    economic_translation: 1.2, // Billable hour and matter profitability focus
  },
  accounting_audit: {
    authority_structure: 1.3,   // PCAOB, AICPA standards, and SOX compliance
    economic_translation: 1.2, // Engagement profitability and utilization
    adoption_behavior: 1.2,    // Staff and partner technology adoption
  },
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
  insurance: {
    primaryValueDriver: 'Claims processing acceleration, underwriting precision, actuarial modeling, and customer experience automation.',
    competitiveThreat: 'InsurTech competitors and tech-enabled MGAs are redefining customer expectations for speed, transparency, and personalization.',
    regulatoryContext: 'Insurance AI is increasingly scrutinized for fairness in pricing and claims decisions, with state-level regulations evolving rapidly.',
    keyUseCases: ['claims triage', 'underwriting automation', 'fraud detection', 'customer self-service', 'actuarial modeling'],
  },
  banking: {
    primaryValueDriver: 'Risk modeling, fraud detection, customer personalization, and process automation across retail and commercial banking operations.',
    competitiveThreat: 'Neobanks and Big Tech financial products are AI-native by design. Incumbent banks that cannot match this capability face structural disadvantage in cost-to-serve and customer experience.',
    regulatoryContext: 'Banking AI operates under evolving regulatory frameworks including model risk management (SR 11-7), fair lending (ECOA), BSA/AML, and emerging AI-specific guidance from the OCC and Fed.',
    keyUseCases: ['fraud detection', 'credit decisioning', 'regulatory compliance', 'customer advisory', 'process automation'],
  },
  capital_markets: {
    primaryValueDriver: 'Trade execution optimization, risk analytics, regulatory reporting automation, and alpha generation through alternative data.',
    competitiveThreat: 'Quantitative hedge funds and AI-native trading firms are capturing market share with speed and data advantages that traditional broker-dealers struggle to match.',
    regulatoryContext: 'Capital markets AI operates under SEC and FINRA oversight, including model risk management, best execution obligations, and emerging AI-specific guidance on algorithmic trading.',
    keyUseCases: ['trade surveillance', 'risk analytics', 'regulatory reporting', 'research automation', 'portfolio optimization'],
  },
  asset_wealth_management: {
    primaryValueDriver: 'Portfolio construction, client personalization at scale, compliance automation, and advisor productivity across wealth and asset management.',
    competitiveThreat: 'Robo-advisors and AI-native platforms are driving fee compression and raising client expectations for personalized, always-on advice that traditional firms must match.',
    regulatoryContext: 'Fiduciary obligations, SEC/FINRA suitability rules, and evolving AI guidance on algorithmic recommendations shape deployment in wealth and asset management.',
    keyUseCases: ['portfolio optimization', 'client personalization', 'compliance monitoring', 'advisor copilots', 'alternative data analysis'],
  },
  investment_banking: {
    primaryValueDriver: 'Deal origination intelligence, pitch and memo automation, due diligence acceleration, and financial modeling productivity across M&A and capital raising.',
    competitiveThreat: 'Boutique banks and AI-enabled advisory platforms are compressing deal timelines and offering data-driven insights that challenge incumbent relationship advantages.',
    regulatoryContext: 'SEC disclosure requirements, FINRA supervisory rules, insider trading regulations, and conflict-of-interest policies shape AI deployment in investment banking.',
    keyUseCases: ['deal sourcing and origination', 'pitch book and memo generation', 'due diligence automation', 'financial modeling copilots', 'market and sector intelligence'],
  },
  private_equity: {
    primaryValueDriver: 'Deal sourcing and evaluation, portfolio company value creation, operational improvement identification, and exit timing optimization across PE funds.',
    competitiveThreat: 'AI-enabled PE firms are screening more deals, identifying value creation levers faster, and achieving better portfolio outcomes, raising LP expectations for all GPs.',
    regulatoryContext: 'SEC registration and reporting requirements, LP disclosure obligations, and emerging ESG reporting standards shape AI deployment in private equity.',
    keyUseCases: ['deal pipeline screening', 'due diligence acceleration', 'portfolio company benchmarking', 'operational improvement identification', 'exit readiness assessment'],
  },
  venture_capital: {
    primaryValueDriver: 'Deal flow management, startup evaluation, portfolio monitoring, and market intelligence across venture capital funds.',
    competitiveThreat: 'AI-native VC platforms are processing exponentially more deal flow and identifying patterns in founder and market signals that traditional sourcing methods miss.',
    regulatoryContext: 'SEC fund registration, accredited investor verification, and LP reporting requirements create moderate regulatory overhead for AI deployment in VC.',
    keyUseCases: ['deal flow scoring and prioritization', 'startup due diligence', 'portfolio performance monitoring', 'market trend and signal detection', 'LP reporting automation'],
  },
  hedge_funds: {
    primaryValueDriver: 'Alpha generation through alternative data, risk management, trade execution optimization, and research automation across hedge fund strategies.',
    competitiveThreat: 'Quantitative and systematic funds are using AI to identify signals and execute trades at speeds and scales that discretionary managers cannot match, compressing alpha opportunities.',
    regulatoryContext: 'SEC and CFTC oversight, Form PF reporting, market manipulation rules, and emerging AI-specific guidance on algorithmic trading shape deployment in hedge funds.',
    keyUseCases: ['alternative data signal extraction', 'risk factor modeling', 'trade execution optimization', 'research and thesis generation', 'portfolio construction and rebalancing'],
  },
  healthcare_providers: {
    primaryValueDriver: 'Clinical decision support, operational efficiency, patient experience, and population health management across hospitals and health systems.',
    competitiveThreat: 'Health systems that integrate AI into care delivery and operations will capture value through improved outcomes and lower costs. Those that don\'t will face reimbursement pressure.',
    regulatoryContext: 'Healthcare provider AI operates under HIPAA, FDA guidance for AI/ML-based devices, CMS quality measurement frameworks, and Joint Commission standards.',
    keyUseCases: ['clinical documentation', 'diagnostic support', 'care coordination', 'revenue cycle', 'population health'],
  },
  healthcare_payers: {
    primaryValueDriver: 'Claims adjudication automation, member engagement, care management optimization, and fraud/waste/abuse detection across health plans.',
    competitiveThreat: 'AI-enabled payers are achieving faster claims processing, lower administrative costs, and better member satisfaction. Laggards face regulatory pressure on medical loss ratios.',
    regulatoryContext: 'Healthcare payer AI operates under HIPAA, CMS guidance on prior authorization automation, state insurance regulations, and emerging federal rules on AI-driven coverage decisions.',
    keyUseCases: ['claims adjudication', 'prior authorization automation', 'fraud/waste/abuse detection', 'member engagement', 'care management'],
  },
  healthcare_services: {
    primaryValueDriver: 'Service delivery optimization, patient scheduling and routing, clinical staffing efficiency, and quality measurement across healthcare service organizations.',
    competitiveThreat: 'AI-enabled healthcare service companies are achieving better patient outcomes with lower cost-to-serve, creating competitive pressure on traditional service delivery models.',
    regulatoryContext: 'HIPAA compliance, state licensing requirements, CMS quality reporting, and accreditation standards shape AI deployment in healthcare services.',
    keyUseCases: ['patient scheduling optimization', 'clinical workforce management', 'quality metric tracking', 'referral management', 'patient engagement automation'],
  },
  life_sciences_pharma: {
    primaryValueDriver: 'Drug discovery acceleration, clinical trial optimization, regulatory submission automation, and commercial launch intelligence across pharma and biotech.',
    competitiveThreat: 'AI-native biotech firms are compressing drug discovery timelines from years to months. Traditional pharma companies that fail to adopt AI risk slower pipelines and higher R&D costs.',
    regulatoryContext: 'Life sciences AI operates under FDA guidance for AI/ML in drug development, GxP validation requirements, and evolving EMA and PMDA frameworks for AI-enabled submissions.',
    keyUseCases: ['drug target identification', 'clinical trial optimization', 'regulatory submission automation', 'real-world evidence analysis', 'commercial analytics'],
  },
  retail: {
    primaryValueDriver: 'Inventory optimization, hyper-personalized customer experiences, supply chain resilience, and unified commerce across physical and digital channels.',
    competitiveThreat: 'DTC brands and AI-native retailers are compressing product cycles and price-matching at machine speed, forcing legacy retailers to match or lose share.',
    regulatoryContext: 'Consumer data privacy laws (CCPA, GDPR, state-level biometric laws) and FTC enforcement on algorithmic pricing and dark patterns constrain personalization strategies.',
    keyUseCases: ['demand forecasting and inventory optimization', 'real-time personalized merchandising', 'supply chain disruption prediction', 'customer lifetime value modeling', 'shelf and assortment analytics'],
  },
  ecommerce_digital: {
    primaryValueDriver: 'Personalization at scale, conversion optimization, dynamic pricing, and customer service automation across digital commerce platforms.',
    competitiveThreat: 'E-commerce leaders (Amazon, Shopify) are setting AI-powered standards for personalization and logistics that all digital retailers are measured against.',
    regulatoryContext: 'Consumer data privacy laws (CCPA, GDPR) affect AI-powered personalization, recommendation engines, and cross-border digital commerce.',
    keyUseCases: ['demand forecasting', 'price optimization', 'personalization', 'customer service', 'inventory management'],
  },
  cpg: {
    primaryValueDriver: 'Demand sensing, trade promotion optimization, new product forecasting, and supply chain agility across consumer packaged goods.',
    competitiveThreat: 'DTC brands and AI-native CPG startups are using data-driven insights to capture shelf space and market share faster than legacy brands can respond.',
    regulatoryContext: 'Consumer data privacy laws (CCPA, GDPR), FDA labeling requirements, and FTC advertising enforcement constrain AI-driven marketing and personalization in CPG.',
    keyUseCases: ['demand sensing and forecasting', 'trade promotion optimization', 'supply chain disruption prediction', 'consumer insight mining', 'new product launch analytics'],
  },
  dtc: {
    primaryValueDriver: 'Customer acquisition cost optimization, lifetime value maximization, personalization at scale, and supply chain agility across direct-to-consumer brands.',
    competitiveThreat: 'The DTC landscape is saturated, and AI-native brands are achieving dramatically lower CAC and higher retention through hyper-personalized experiences that legacy brands struggle to replicate.',
    regulatoryContext: 'Consumer data privacy laws (CCPA, GDPR), FTC advertising and endorsement guidelines, and platform-specific policies on data usage and targeting constrain DTC marketing strategies.',
    keyUseCases: ['customer acquisition optimization', 'lifetime value prediction', 'personalized marketing automation', 'inventory and demand planning', 'customer service automation'],
  },
  food_beverage: {
    primaryValueDriver: 'Demand forecasting, supply chain optimization, quality control, and consumer trend identification across food and beverage manufacturers and distributors.',
    competitiveThreat: 'AI-enabled food and beverage companies are responding to consumer trends faster, reducing waste, and optimizing distribution networks, creating margin advantages over slower competitors.',
    regulatoryContext: 'FDA food safety regulations (FSMA), USDA labeling requirements, state health department standards, and emerging sustainability reporting requirements shape AI deployment.',
    keyUseCases: ['demand forecasting and production planning', 'quality control and food safety monitoring', 'supply chain optimization', 'consumer trend analysis', 'waste reduction and sustainability'],
  },
  manufacturing_discrete: {
    primaryValueDriver: 'Predictive maintenance, quality control, supply chain optimization, and production efficiency across discrete manufacturing operations.',
    competitiveThreat: 'Smart manufacturing and Industry 4.0 leaders are achieving 10 to 20% efficiency advantages that compound annually. Manufacturers without AI capability face widening cost gaps.',
    regulatoryContext: 'Manufacturing AI faces quality management system requirements (ISO 9001), OSHA safety standards, and industry-specific certification requirements.',
    keyUseCases: ['predictive maintenance', 'quality inspection', 'supply chain optimization', 'demand forecasting', 'production scheduling'],
  },
  manufacturing_process: {
    primaryValueDriver: 'Process optimization, yield improvement, predictive maintenance, and energy efficiency across continuous and batch process manufacturing.',
    competitiveThreat: 'Smart manufacturing leaders are using AI to optimize chemical, pharmaceutical, and materials processes at speeds human operators cannot match, creating durable margin advantages.',
    regulatoryContext: 'Process manufacturing AI faces EPA environmental compliance, OSHA safety standards, and industry-specific regulations (FDA cGMP for pharma, API standards for oil and gas).',
    keyUseCases: ['process optimization', 'yield improvement', 'predictive maintenance', 'energy optimization', 'quality assurance'],
  },
  automotive: {
    primaryValueDriver: 'Production line optimization, supply chain resilience, quality defect prediction, and connected vehicle intelligence across automotive OEMs and suppliers.',
    competitiveThreat: 'EV-native manufacturers like Tesla and BYD are AI-first in both manufacturing and product, forcing traditional automakers to accelerate digital transformation or lose market position.',
    regulatoryContext: 'Automotive AI faces NHTSA safety standards, EPA emissions requirements, and emerging autonomous vehicle regulations at federal and state levels.',
    keyUseCases: ['production optimization', 'supply chain risk management', 'quality defect prediction', 'connected vehicle analytics', 'warranty cost reduction'],
  },
  aerospace_defense: {
    primaryValueDriver: 'Predictive maintenance for fleet readiness, supply chain resilience across complex multi-tier programs, defense system optimization, and engineering productivity acceleration.',
    competitiveThreat: 'Lockheed Martin, Raytheon, Northrop Grumman, and emerging defense-tech startups (Anduril, Shield AI) are racing to embed AI into platforms and proposals. Primes without AI capability risk losing next-generation program bids.',
    regulatoryContext: 'ITAR export controls, DFARS cybersecurity requirements (CMMC), DoD Responsible AI principles, and classified environment constraints create unique deployment complexity.',
    keyUseCases: ['predictive maintenance and fleet readiness optimization', 'supply chain risk monitoring across sub-tier suppliers', 'engineering design and simulation acceleration', 'test and evaluation automation', 'mission planning and logistics optimization'],
  },
  energy_oil_gas: {
    primaryValueDriver: 'Exploration optimization, production forecasting, predictive maintenance, and safety monitoring across upstream, midstream, and downstream operations.',
    competitiveThreat: 'Energy majors investing in AI-driven exploration and production are finding reserves faster and extracting more efficiently, while competitors relying on traditional methods face rising costs.',
    regulatoryContext: 'Critical infrastructure regulations, EPA environmental compliance, PHMSA pipeline safety, and evolving ESG reporting requirements create both constraints and opportunities for AI.',
    keyUseCases: ['production optimization', 'predictive maintenance', 'safety monitoring', 'reservoir modeling', 'regulatory compliance'],
  },
  utilities: {
    primaryValueDriver: 'Grid optimization, demand forecasting, outage prediction, and regulatory compliance automation across electric, gas, and water utilities.',
    competitiveThreat: 'Energy transition and grid modernization require AI capabilities that will separate leading utilities from laggards over the next decade.',
    regulatoryContext: 'NERC CIP reliability standards, state PUC rate case requirements, and environmental compliance create both constraints and high-value automation targets for utilities.',
    keyUseCases: ['grid optimization', 'demand forecasting', 'outage prediction', 'vegetation management', 'regulatory compliance'],
  },
  chemicals_materials: {
    primaryValueDriver: 'Process yield optimization, safety monitoring, supply chain resilience, and R&D acceleration across chemicals, specialty materials, and advanced materials companies.',
    competitiveThreat: 'AI-enabled chemical and materials companies are achieving better yields, faster R&D cycles, and more resilient supply chains, creating durable cost advantages in commodity and specialty markets.',
    regulatoryContext: 'EPA TSCA compliance, OSHA Process Safety Management, REACH (EU), and hazardous materials transportation regulations create significant constraints and high-value automation targets.',
    keyUseCases: ['process yield optimization', 'predictive maintenance and safety monitoring', 'R&D formulation acceleration', 'supply chain risk management', 'environmental compliance automation'],
  },
  industrial_services: {
    primaryValueDriver: 'Field service optimization, workforce scheduling, equipment utilization, and project delivery efficiency across industrial services and maintenance organizations.',
    competitiveThreat: 'AI-enabled industrial service providers are winning contracts with faster response times, higher first-time fix rates, and predictive maintenance offerings that traditional providers cannot match.',
    regulatoryContext: 'OSHA workplace safety standards, industry-specific certification requirements, environmental compliance, and contract labor regulations shape AI deployment in industrial services.',
    keyUseCases: ['field service scheduling and dispatch', 'predictive maintenance offerings', 'workforce skill matching', 'project estimation and tracking', 'equipment utilization optimization'],
  },
  telecommunications: {
    primaryValueDriver: 'Network optimization and autonomous operations, customer churn prediction and retention, 5G monetization, and service assurance at scale.',
    competitiveThreat: 'T-Mobile, AT&T, and Verizon are investing billions in AI-driven network automation and customer experience. MVNOs and cloud-native operators are using AI to compete on service quality with a fraction of the headcount.',
    regulatoryContext: 'FCC regulations on network reliability, CPNI customer data protections, net neutrality considerations, and emerging state-level AI transparency requirements affect deployment strategies.',
    keyUseCases: ['network anomaly detection and self-healing', 'customer churn prediction and proactive retention', 'dynamic spectrum management and 5G optimization', 'field service dispatch optimization', 'revenue assurance and fraud detection'],
  },
  media_entertainment: {
    primaryValueDriver: 'Content creation, audience intelligence, personalization, and production efficiency.',
    competitiveThreat: 'AI-powered content creation and distribution are lowering barriers to entry while raising audience expectations for relevance.',
    regulatoryContext: 'Copyright, rights management, and emerging AI content regulation affect production and distribution strategies.',
    keyUseCases: ['content generation', 'audience analytics', 'personalization', 'production automation', 'rights management'],
  },
  software_saas: {
    primaryValueDriver: 'Product intelligence, engineering productivity, customer success prediction, and operational scaling across software and SaaS companies.',
    competitiveThreat: 'AI is redefining product expectations. Software companies that don\'t embed AI into their products risk rapid obsolescence as competitors ship AI-native alternatives.',
    regulatoryContext: 'Evolving AI regulation (EU AI Act, US state laws) will increasingly affect software product design, deployment, and liability.',
    keyUseCases: ['engineering copilots', 'product intelligence', 'customer success', 'content generation', 'security automation'],
  },
  it_services: {
    primaryValueDriver: 'Service delivery automation, consultant productivity, knowledge management, and client outcome optimization across IT consulting and managed services.',
    competitiveThreat: 'AI is fundamentally reshaping IT services economics. Firms that augment consultants with AI can deliver faster at lower cost, while competitors face margin pressure from commoditization of routine work.',
    regulatoryContext: 'Client data protection obligations, SOC 2 compliance requirements, industry-specific regulations inherited from clients, and emerging AI liability frameworks shape deployment in IT services.',
    keyUseCases: ['service desk automation', 'code generation and review', 'knowledge base and documentation', 'project estimation and resource planning', 'client environment monitoring'],
  },
  hardware_electronics: {
    primaryValueDriver: 'Design optimization, manufacturing quality, supply chain intelligence, and product lifecycle management across hardware and semiconductor companies.',
    competitiveThreat: 'AI-driven design and manufacturing are compressing hardware development cycles. Companies that cannot leverage AI in their design and production processes face longer time-to-market.',
    regulatoryContext: 'Export controls (CHIPS Act, EAR), product safety certifications, and evolving AI regulation affect hardware product development and deployment.',
    keyUseCases: ['design optimization', 'manufacturing quality', 'supply chain intelligence', 'product testing automation', 'customer support'],
  },
  transportation: {
    primaryValueDriver: 'Fleet optimization, route planning, predictive maintenance, and real-time operational decision-making across transportation and mobility.',
    competitiveThreat: 'AI-native logistics platforms and autonomous vehicle companies are setting new standards for efficiency and cost that traditional carriers must match or face margin erosion.',
    regulatoryContext: 'DOT safety regulations, FMCSA hours-of-service rules, and evolving autonomous vehicle regulations create both constraints and high-value automation targets.',
    keyUseCases: ['route optimization', 'fleet management', 'predictive maintenance', 'demand forecasting', 'safety analytics'],
  },
  shipping_logistics: {
    primaryValueDriver: 'Route optimization, predictive ETAs, warehouse automation, and end-to-end supply chain visibility.',
    competitiveThreat: 'Amazon and AI-native freight platforms are setting new standards for speed, cost, and transparency that legacy carriers must match or face margin erosion.',
    regulatoryContext: 'Cross-border customs compliance, hazardous materials handling, and evolving emissions reporting requirements create both constraints and high-value automation targets.',
    keyUseCases: ['route optimization', 'demand forecasting', 'warehouse robotics', 'predictive maintenance', 'customs and compliance automation'],
  },
  infrastructure_transport: {
    primaryValueDriver: 'Asset lifecycle management, capacity planning, safety monitoring, and capital project optimization across transportation infrastructure operators and authorities.',
    competitiveThreat: 'Smart infrastructure and digital twin technologies are enabling better asset utilization and safety outcomes, raising expectations from regulators, riders, and taxpayers.',
    regulatoryContext: 'FTA and FRA safety requirements, NEPA environmental review, federal grant compliance, and state transportation authority governance create complex regulatory environments.',
    keyUseCases: ['asset condition monitoring and predictive maintenance', 'capacity planning and demand modeling', 'safety incident prediction', 'capital project estimation and tracking', 'passenger experience optimization'],
  },
  real_estate_commercial: {
    primaryValueDriver: 'Property valuation and market prediction, tenant experience optimization, portfolio performance analytics, and deal origination intelligence.',
    competitiveThreat: 'PropTech firms like Zillow, Redfin, and CoStar are leveraging AI to disintermediate traditional players. Institutional investors with AI-driven underwriting are executing faster and capturing off-market opportunities.',
    regulatoryContext: 'Fair Housing Act compliance on algorithmic valuations, state real estate licensing laws, CFPB scrutiny of automated lending decisions, and ESG reporting requirements affect AI strategies.',
    keyUseCases: ['automated property valuation and comp analysis', 'market trend prediction and investment signal detection', 'tenant experience and smart building optimization', 'lease abstraction and portfolio analytics', 'construction project monitoring and risk assessment'],
  },
  real_estate_residential: {
    primaryValueDriver: 'Lead generation and conversion, property valuation accuracy, transaction workflow automation, and market intelligence across residential brokerages and platforms.',
    competitiveThreat: 'Zillow, Redfin, Opendoor, and AI-native platforms are disintermediating traditional agents with instant valuations, automated matching, and streamlined transactions.',
    regulatoryContext: 'Fair Housing Act compliance on algorithmic recommendations, state real estate licensing laws, RESPA settlement procedures, and MLS data sharing rules shape AI deployment.',
    keyUseCases: ['automated valuation models', 'lead scoring and nurturing', 'listing description generation', 'transaction coordination automation', 'market trend analysis and pricing'],
  },
  construction_engineering: {
    primaryValueDriver: 'Project estimation accuracy, site safety monitoring, schedule optimization, and material waste reduction across construction and engineering firms.',
    competitiveThreat: 'AI-enabled general contractors and engineering firms are winning bids with more accurate estimates and delivering projects faster, forcing traditional firms to modernize or lose market position.',
    regulatoryContext: 'OSHA safety standards, building code compliance, environmental impact requirements, and prevailing wage regulations create both constraints and high-value automation targets.',
    keyUseCases: ['project estimation', 'site safety monitoring', 'schedule optimization', 'material waste reduction', 'BIM and design automation'],
  },
  government_federal: {
    primaryValueDriver: 'Citizen service modernization, fraud detection and improper payment prevention, national security intelligence, and operational efficiency across agencies.',
    competitiveThreat: 'Peer nations are investing heavily in AI for defense and intelligence. Domestically, citizen expectations for digital services set by the private sector create political urgency for modernization.',
    regulatoryContext: 'Federal AI deployment is governed by FedRAMP authorization, OMB AI guidance (M-24-10), the Executive Order on AI, NIST AI RMF, and agency-specific ATOs with emphasis on equity and civil liberties.',
    keyUseCases: ['fraud detection and improper payment prevention', 'citizen services chatbots and case management', 'national security intelligence analysis', 'document processing and adjudication', 'regulatory enforcement prioritization'],
  },
  government_state_local: {
    primaryValueDriver: '311 service optimization, permitting and licensing acceleration, public safety analytics, and constituent engagement across municipal operations.',
    competitiveThreat: 'Residents compare government services to private sector digital experiences. Jurisdictions that modernize attract talent and businesses; those that lag face declining tax bases and constituent trust.',
    regulatoryContext: 'State-level AI legislation is proliferating (CO SB 205, NYC Local Law 144), alongside open records laws, ADA accessibility requirements, and emerging municipal AI governance frameworks.',
    keyUseCases: ['311 request routing and resolution prediction', 'permit and license processing automation', 'public safety predictive analytics', 'infrastructure maintenance prioritization', 'code enforcement and inspection scheduling'],
  },
  defense_contractors: {
    primaryValueDriver: 'Proposal competitiveness, program execution efficiency, supply chain resilience, and engineering productivity across defense primes and sub-tier contractors.',
    competitiveThreat: 'Defense-tech startups (Anduril, Shield AI, Palantir) are winning contracts with AI-native platforms and faster development cycles, challenging incumbent primes on next-generation programs.',
    regulatoryContext: 'ITAR export controls, CMMC cybersecurity certification, DFARS compliance, DoD Responsible AI principles, and classified environment constraints create unique deployment complexity.',
    keyUseCases: ['proposal generation and pricing', 'program schedule and cost optimization', 'supply chain risk monitoring', 'engineering design acceleration', 'test and evaluation automation'],
  },
  nonprofit_ngo: {
    primaryValueDriver: 'Donor analytics and fundraising optimization, program effectiveness measurement, grant management, and mission-impact amplification with constrained resources.',
    competitiveThreat: 'Donors and foundations increasingly expect data-driven impact evidence. Nonprofits that cannot demonstrate measurable outcomes lose funding to those that can, and AI-enabled peers are setting new efficiency benchmarks.',
    regulatoryContext: 'IRS reporting requirements, grant compliance obligations, donor data stewardship, and state charitable solicitation laws shape AI deployment in the nonprofit sector.',
    keyUseCases: ['donor propensity modeling and gift optimization', 'program outcome prediction and measurement', 'grant application and compliance automation', 'volunteer matching and engagement optimization', 'beneficiary needs assessment and service routing'],
  },
  consulting_services: {
    primaryValueDriver: 'Knowledge worker augmentation, project efficiency, client delivery acceleration, and expertise scaling.',
    competitiveThreat: 'Firms that augment their professionals with AI can deliver faster, with higher quality, at lower cost, fundamentally changing competitive dynamics and pricing models.',
    regulatoryContext: 'Professional liability and client confidentiality obligations shape AI deployment in advisory and consulting contexts.',
    keyUseCases: ['document analysis', 'research automation', 'knowledge management', 'proposal generation', 'client analytics'],
  },
  legal_services: {
    primaryValueDriver: 'Document review acceleration, legal research automation, contract analysis, and matter management efficiency across law firms and legal departments.',
    competitiveThreat: 'AI-enabled law firms and legal technology platforms are delivering faster, more consistent legal work at lower cost, pressuring traditional billing models and creating competitive advantage for early adopters.',
    regulatoryContext: 'Attorney-client privilege, ABA Model Rules of Professional Conduct, state bar ethics opinions on AI use, malpractice liability, and client data confidentiality shape AI deployment in legal services.',
    keyUseCases: ['document review and e-discovery', 'legal research and case law analysis', 'contract drafting and review', 'matter management and billing', 'regulatory compliance monitoring'],
  },
  accounting_audit: {
    primaryValueDriver: 'Audit efficiency, anomaly detection, tax compliance automation, and advisory service scalability across accounting firms and audit practices.',
    competitiveThreat: 'Big Four and AI-native accounting platforms are automating routine audit and tax work, forcing mid-market and regional firms to adopt AI or face margin compression and talent attrition.',
    regulatoryContext: 'PCAOB auditing standards, AICPA professional standards, SOX compliance requirements, IRS e-filing mandates, and state board of accountancy rules shape AI deployment in accounting.',
    keyUseCases: ['audit sampling and anomaly detection', 'tax return preparation and review', 'financial statement analysis', 'workpaper automation', 'advisory analytics and benchmarking'],
  },
};
