// =============================================================================
// RLK AI Diagnostic — Proprietary Diagnostic Question Bank
// =============================================================================
// 61 questions across 5 hidden dimensions. Each question diagnoses BEHAVIOR,
// not tools. Answer options map to maturity levels 0–5.
// =============================================================================

import { DiagnosticQuestion } from '@/types/diagnostic';

// ---------------------------------------------------------------------------
// DIMENSION 1: ADOPTION BEHAVIOR (12 questions)
// Measures how AI is actually being used vs. merely purchased/discussed
// ---------------------------------------------------------------------------

const adoptionBehavior: DiagnosticQuestion[] = [
  {
    id: 'AB-01',
    dimension: 'adoption_behavior',
    text: 'When a new AI tool is introduced, how does usage typically evolve over the first 90 days?',
    subtext: 'Think about the most recent AI tool your organization adopted.',
    options: [
      { text: 'Initial enthusiasm followed by near-complete abandonment', score: 0 },
      { text: 'A small group of champions continues use; most revert to prior methods', score: 1 },
      { text: 'Usage stabilizes at 20–40% of intended users with informal workarounds', score: 2 },
      { text: 'Majority of intended users adopt with structured onboarding support', score: 3 },
      { text: 'Usage expands beyond initial scope as teams discover adjacent use cases', score: 5 },
    ],
    weight: 1.2,
    tags: ['adoption', 'retention'],
  },
  {
    id: 'AB-02',
    dimension: 'adoption_behavior',
    text: 'How do frontline employees describe their relationship with AI tools in their daily work?',
    options: [
      { text: 'Most are unaware AI tools are available to them', score: 0 },
      { text: '"Something IT rolled out that doesn\'t really apply to my job"', score: 1 },
      { text: '"I use it occasionally when I remember or have time to figure it out"', score: 2 },
      { text: '"It\'s part of my workflow for specific tasks"', score: 3 },
      { text: '"I can\'t imagine doing my job without it. I\'d push back if it were removed."', score: 5 },
    ],
    weight: 1.3,
    tags: ['adoption', 'sentiment'],
  },
  {
    id: 'AB-03',
    dimension: 'adoption_behavior',
    text: 'What happens when an AI initiative doesn\'t show results in the first quarter?',
    options: [
      { text: 'It is quietly discontinued and rarely discussed', score: 0 },
      { text: 'Blame is assigned and the initiative is shelved', score: 1 },
      { text: 'It continues with reduced resources and lower visibility', score: 2 },
      { text: 'A structured review occurs to diagnose and adjust the approach', score: 4 },
      { text: 'Failure data is captured, shared, and used to inform the next initiative', score: 5 },
    ],
    weight: 1.0,
    tags: ['adoption', 'resilience'],
  },
  {
    id: 'AB-04',
    dimension: 'adoption_behavior',
    text: 'How are AI use cases identified and prioritized in your organization?',
    options: [
      { text: 'Vendors propose solutions and we react to what\'s available', score: 0 },
      { text: 'Individual teams experiment based on personal interest or curiosity', score: 1 },
      { text: 'A central team curates a backlog but prioritization is ad hoc', score: 2 },
      { text: 'Use cases are scored against strategic objectives with clear criteria', score: 4 },
      { text: 'Business units own identification; a governance layer ensures alignment and prevents duplication', score: 5 },
    ],
    weight: 1.1,
    tags: ['adoption', 'strategy'],
  },
  {
    id: 'AB-05',
    dimension: 'adoption_behavior',
    text: 'What percentage of your workforce has modified at least one daily task using AI in the past 30 days?',
    options: [
      { text: 'Less than 5%', score: 0 },
      { text: '5–15%', score: 1 },
      { text: '15–35%', score: 2 },
      { text: '35–60%', score: 3 },
      { text: 'More than 60%', score: 5 },
    ],
    weight: 1.4,
    tags: ['adoption', 'penetration'],
  },
  {
    id: 'AB-06',
    dimension: 'adoption_behavior',
    text: 'How does your organization handle "shadow AI," meaning employees using unauthorized AI tools?',
    options: [
      { text: 'We are not aware this is happening', score: 0 },
      { text: 'We know it happens but haven\'t addressed it', score: 1 },
      { text: 'We\'ve issued policies prohibiting it, but enforcement is inconsistent', score: 2 },
      { text: 'We monitor and channel shadow usage into sanctioned alternatives', score: 4 },
      { text: 'Our sanctioned tools are good enough that shadow AI is minimal', score: 5 },
    ],
    weight: 1.0,
    tags: ['adoption', 'governance', 'security'],
  },
  {
    id: 'AB-07',
    dimension: 'adoption_behavior',
    text: 'When you look at AI adoption across business units, what pattern do you see?',
    options: [
      { text: 'No meaningful adoption in any business unit', score: 0 },
      { text: 'One or two units experimenting; the rest are uninvolved', score: 1 },
      { text: 'Pockets of adoption with no coordination between units', score: 2 },
      { text: 'Multiple units with active programs and some cross-pollination', score: 3 },
      { text: 'Organization-wide deployment with shared infrastructure and best practices', score: 5 },
    ],
    weight: 1.1,
    tags: ['adoption', 'breadth'],
  },
  {
    id: 'AB-08',
    dimension: 'adoption_behavior',
    text: 'How do managers at your organization respond when a direct report proposes using AI to replace part of an existing process?',
    options: [
      { text: 'Proposals are dismissed or seen as a threat to existing roles', score: 0 },
      { text: 'Polite interest but no follow-through or resource allocation', score: 1 },
      { text: 'Managers are open but lack authority or budget to act on proposals', score: 2 },
      { text: 'Proposals are evaluated against clear criteria with a path to pilot', score: 4 },
      { text: 'Bottom-up AI proposals are actively encouraged, resourced, and celebrated when successful', score: 5 },
    ],
    weight: 1.1,
    tags: ['adoption', 'culture', 'management'],
  },
  {
    id: 'AB-09',
    dimension: 'adoption_behavior',
    text: 'What is the typical time between identifying an AI use case and putting a working solution in front of end users?',
    options: [
      { text: 'Over 12 months, if it happens at all', score: 0 },
      { text: '6–12 months due to approval, procurement, and implementation cycles', score: 1 },
      { text: '3–6 months with a dedicated project team', score: 2 },
      { text: '4–12 weeks using pre-approved tools and agile deployment practices', score: 4 },
      { text: 'Under 4 weeks for standard use cases; dedicated fast-track for high-priority needs', score: 5 },
    ],
    weight: 1.2,
    tags: ['adoption', 'speed', 'deployment'],
  },
  {
    id: 'AB-10',
    dimension: 'adoption_behavior',
    text: 'How does your organization approach AI-related upskilling and training?',
    options: [
      { text: 'No formal AI training exists; employees learn on their own or not at all', score: 0 },
      { text: 'Optional webinars or external courses with low completion rates', score: 1 },
      { text: 'Structured training for select roles (data scientists, analysts) but not broadly', score: 2 },
      { text: 'Role-specific AI training programs with completion tracking and practical exercises', score: 4 },
      { text: 'Continuous learning culture with embedded AI coaching, peer learning networks, and skill-based progression', score: 5 },
    ],
    weight: 1.0,
    tags: ['adoption', 'training', 'talent'],
  },
  {
    id: 'AB-11',
    dimension: 'adoption_behavior',
    text: 'When an AI tool produces an output that contradicts an employee\'s judgment, what typically happens?',
    options: [
      { text: 'The AI output is ignored; employees trust their gut over any AI recommendation', score: 0 },
      { text: 'The AI output is quietly overridden without investigation or documentation', score: 1 },
      { text: 'It depends entirely on the individual; no organizational norms exist', score: 2 },
      { text: 'A defined process exists to evaluate discrepancies and escalate when warranted', score: 4 },
      { text: 'AI and human judgment are integrated through calibrated decision frameworks with feedback loops', score: 5 },
    ],
    weight: 1.1,
    tags: ['adoption', 'trust', 'decision_making'],
  },
  {
    id: 'AB-12',
    dimension: 'adoption_behavior',
    text: 'How would you characterize your C-suite\'s personal engagement with AI tools?',
    options: [
      { text: 'None of our executives actively use AI tools themselves', score: 0 },
      { text: 'One or two executives have experimented but it hasn\'t influenced their leadership', score: 1 },
      { text: 'Several executives use AI for personal productivity but haven\'t championed it organizationally', score: 2 },
      { text: 'Executive leadership actively uses AI and references their experience when setting strategy', score: 4 },
      { text: 'The C-suite models AI usage, shares learnings publicly, and holds themselves accountable for AI-driven outcomes', score: 5 },
    ],
    weight: 1.3,
    tags: ['adoption', 'executive', 'leadership'],
  },
];

// ---------------------------------------------------------------------------
// DIMENSION 2: AUTHORITY STRUCTURE (7+5=12 questions)
// Measures who controls AI decisions and how permission flows
// ---------------------------------------------------------------------------

const authorityStructure: DiagnosticQuestion[] = [
  {
    id: 'AS-01',
    dimension: 'authority_structure',
    text: 'How many levels of approval are required before an AI pilot can launch?',
    subtext: 'Consider a typical mid-size initiative, not trivial experiments or enterprise-wide programs.',
    options: [
      { text: 'No clear approval process exists; initiatives stall in ambiguity', score: 0 },
      { text: '5+ levels including board or C-suite sign-off for any AI initiative', score: 1 },
      { text: '3–4 levels with IT, legal, and executive review', score: 2 },
      { text: '1–2 levels with pre-approved criteria for standard initiatives', score: 4 },
      { text: 'Teams have pre-authorized budgets and guardrails to launch within defined parameters', score: 5 },
    ],
    weight: 1.3,
    tags: ['authority', 'approval', 'governance'],
  },
  {
    id: 'AS-02',
    dimension: 'authority_structure',
    text: 'Who "owns" AI strategy in your organization?',
    options: [
      { text: 'No one. It\'s not formally owned.', score: 0 },
      { text: 'IT/CTO owns it as a technology initiative', score: 1 },
      { text: 'A cross-functional committee meets periodically', score: 2 },
      { text: 'A designated leader (Chief AI Officer, VP of AI) with budget authority', score: 4 },
      { text: 'Distributed ownership with clear accountability at both enterprise and business-unit levels', score: 5 },
    ],
    weight: 1.2,
    tags: ['authority', 'ownership'],
  },
  {
    id: 'AS-03',
    dimension: 'authority_structure',
    text: 'When an AI initiative requires budget reallocation mid-year, what typically happens?',
    options: [
      { text: 'It waits for the next budget cycle regardless of urgency', score: 0 },
      { text: 'It requires a formal business case that takes 2–3 months to approve', score: 1 },
      { text: 'A sponsor can advocate for reallocation through normal channels (6–8 weeks)', score: 2 },
      { text: 'Expedited process exists for AI investments under a defined threshold', score: 4 },
      { text: 'Dedicated AI investment pool with quarterly rebalancing authority', score: 5 },
    ],
    weight: 1.1,
    tags: ['authority', 'budget', 'velocity'],
  },
  {
    id: 'AS-04',
    dimension: 'authority_structure',
    text: 'How are conflicts between AI initiatives and existing processes resolved?',
    options: [
      { text: 'AI initiatives lose; existing processes are protected', score: 0 },
      { text: 'Escalation to senior leadership with unpredictable outcomes', score: 1 },
      { text: 'Case-by-case negotiation between stakeholders', score: 2 },
      { text: 'Defined escalation path with criteria for when AI should override legacy processes', score: 4 },
      { text: 'Process redesign is expected and resourced as part of AI deployment', score: 5 },
    ],
    weight: 1.0,
    tags: ['authority', 'process_change'],
  },
  {
    id: 'AS-05',
    dimension: 'authority_structure',
    text: 'What role does legal/compliance play in AI deployment decisions?',
    options: [
      { text: 'Legal blocks most AI initiatives citing unquantified risk', score: 0 },
      { text: 'Legal reviews every initiative individually, creating a 3–6 month bottleneck', score: 1 },
      { text: 'Legal has created general guidelines but still reviews each deployment', score: 2 },
      { text: 'Pre-approved frameworks exist for common use cases; legal reviews only novel applications', score: 4 },
      { text: 'Legal is embedded in AI teams and co-designs compliant solutions', score: 5 },
    ],
    weight: 1.2,
    tags: ['authority', 'legal', 'compliance', 'governance'],
  },
  {
    id: 'AS-06',
    dimension: 'authority_structure',
    text: 'How does your board engage with AI strategy?',
    options: [
      { text: 'AI has not been discussed at the board level', score: 0 },
      { text: 'Board receives occasional updates, primarily about risk/compliance', score: 1 },
      { text: 'Board reviews AI strategy annually as part of technology updates', score: 2 },
      { text: 'Board has AI as a standing agenda item with quarterly progress reviews', score: 4 },
      { text: 'Board members include AI expertise; AI is integrated into strategic planning and capital allocation', score: 5 },
    ],
    weight: 1.0,
    tags: ['authority', 'board', 'governance'],
  },
  {
    id: 'AS-07',
    dimension: 'authority_structure',
    text: 'Can a business unit leader deploy an AI solution without centralized IT involvement?',
    options: [
      { text: 'Absolutely not. All technology decisions run through central IT.', score: 1 },
      { text: 'In theory yes, but in practice IT controls all infrastructure and vendor relationships', score: 1 },
      { text: 'Yes, for small experiments, but scaling requires IT partnership', score: 3 },
      { text: 'Yes, within defined guardrails using pre-approved platforms', score: 4 },
      { text: 'Yes, federated model with shared infrastructure and local autonomy', score: 5 },
    ],
    weight: 1.1,
    tags: ['authority', 'decentralization'],
  },
  {
    id: 'AS-08',
    dimension: 'authority_structure',
    text: 'How are AI ethics and responsible AI principles governed in your organization?',
    options: [
      { text: 'No formal AI ethics framework exists', score: 0 },
      { text: 'High-level principles are documented but not operationalized or enforced', score: 1 },
      { text: 'An ethics review is required for customer-facing AI but enforcement varies', score: 2 },
      { text: 'A dedicated ethics review board evaluates AI deployments against defined criteria', score: 4 },
      { text: 'AI ethics is embedded in development workflows with automated checks, audit trails, and regular external review', score: 5 },
    ],
    weight: 1.2,
    tags: ['authority', 'ethics', 'responsible_ai'],
  },
  {
    id: 'AS-09',
    dimension: 'authority_structure',
    text: 'When an AI system produces a biased or incorrect outcome that affects a customer or employee, what happens?',
    options: [
      { text: 'We have no process; incidents are handled reactively if noticed at all', score: 0 },
      { text: 'It\'s escalated as a one-off incident with no systemic response', score: 1 },
      { text: 'An incident report is filed but root cause analysis is inconsistent', score: 2 },
      { text: 'A defined incident response protocol triggers investigation, remediation, and process updates', score: 4 },
      { text: 'Continuous monitoring catches issues proactively; incidents trigger organization-wide learning and model retraining', score: 5 },
    ],
    weight: 1.0,
    tags: ['authority', 'incident_response', 'risk'],
  },
  {
    id: 'AS-10',
    dimension: 'authority_structure',
    text: 'How is AI-related data governance handled across your organization?',
    options: [
      { text: 'No data governance specific to AI exists; teams use whatever data they can access', score: 0 },
      { text: 'Basic data access policies exist but are not enforced or AI-specific', score: 1 },
      { text: 'Data classification exists but AI teams frequently need exceptions or workarounds', score: 2 },
      { text: 'Clear data governance framework with defined access levels, quality standards, and AI-specific policies', score: 4 },
      { text: 'Automated data governance with lineage tracking, quality monitoring, and self-service data access within guardrails', score: 5 },
    ],
    weight: 1.1,
    tags: ['authority', 'data_governance', 'compliance'],
  },
  {
    id: 'AS-11',
    dimension: 'authority_structure',
    text: 'How does your organization manage the risk of AI vendor lock-in?',
    options: [
      { text: 'We haven\'t considered vendor lock-in as a risk', score: 0 },
      { text: 'We\'re aware of the risk but have no formal strategy to mitigate it', score: 1 },
      { text: 'We try to avoid single-vendor dependency but have no formal exit planning', score: 2 },
      { text: 'Vendor contracts include data portability clauses and exit provisions', score: 4 },
      { text: 'Multi-vendor strategy with abstraction layers, regular competitive reviews, and tested migration paths', score: 5 },
    ],
    weight: 1.0,
    tags: ['authority', 'vendor', 'risk'],
  },
  {
    id: 'AS-12',
    dimension: 'authority_structure',
    text: 'How are AI-related intellectual property and competitive moats protected?',
    options: [
      { text: 'We have not considered AI IP implications', score: 0 },
      { text: 'General IP policies exist but nothing specific to AI models, training data, or outputs', score: 1 },
      { text: 'We restrict sharing of proprietary data with AI vendors but lack comprehensive AI IP strategy', score: 2 },
      { text: 'Clear AI IP policies covering model ownership, training data rights, and output attribution', score: 4 },
      { text: 'Strategic AI IP portfolio with proprietary models, data advantages, and competitive moat assessment integrated into AI roadmap', score: 5 },
    ],
    weight: 1.1,
    tags: ['authority', 'ip', 'competitive'],
  },
];

// ---------------------------------------------------------------------------
// DIMENSION 3: WORKFLOW INTEGRATION (8+5=13 questions)
// Measures whether AI is embedded in actual work vs. bolted on
// ---------------------------------------------------------------------------

const workflowIntegration: DiagnosticQuestion[] = [
  {
    id: 'WI-01',
    dimension: 'workflow_integration',
    text: 'How are AI tools connected to the systems your employees use daily?',
    options: [
      { text: 'AI tools are standalone. Employees switch between AI and their primary systems.', score: 0 },
      { text: 'Basic API connections exist but require manual data transfer for most tasks', score: 1 },
      { text: 'AI is integrated into 1–2 core workflows but most work is still manual', score: 2 },
      { text: 'AI is embedded in primary workflows with automated data flows', score: 4 },
      { text: 'AI is invisible infrastructure. Employees interact with enhanced versions of their normal tools.', score: 5 },
    ],
    weight: 1.3,
    tags: ['workflow', 'integration', 'systems'],
  },
  {
    id: 'WI-02',
    dimension: 'workflow_integration',
    text: 'When an AI model produces an output (recommendation, draft, analysis), what happens next?',
    options: [
      { text: 'Someone manually reviews and re-enters the output into another system', score: 0 },
      { text: 'Output is copy-pasted into the destination system', score: 1 },
      { text: 'Output feeds into a review queue but requires manual approval for each item', score: 2 },
      { text: 'Output flows automatically with exception-based human review', score: 4 },
      { text: 'Output triggers downstream actions automatically within defined confidence thresholds', score: 5 },
    ],
    weight: 1.2,
    tags: ['workflow', 'automation'],
  },
  {
    id: 'WI-03',
    dimension: 'workflow_integration',
    text: 'How would you describe the data infrastructure supporting your AI initiatives?',
    options: [
      { text: 'Data is siloed in departmental systems with no integration layer', score: 0 },
      { text: 'We have a data warehouse but AI teams spend most time on data preparation', score: 1 },
      { text: 'Centralized data platform exists but real-time access is limited', score: 2 },
      { text: 'Modern data stack with APIs and pipelines that AI applications can consume', score: 4 },
      { text: 'Unified data fabric with real-time streaming, feature stores, and model monitoring', score: 5 },
    ],
    weight: 1.1,
    tags: ['workflow', 'data', 'infrastructure'],
  },
  {
    id: 'WI-04',
    dimension: 'workflow_integration',
    text: 'How are AI-generated insights delivered to decision-makers?',
    options: [
      { text: 'Via email attachments or slide decks prepared by analysts', score: 0 },
      { text: 'Through dashboards that decision-makers access when they remember to check', score: 1 },
      { text: 'Pushed notifications for important insights but no embedded context', score: 2 },
      { text: 'Embedded in the decision-making tools and workflows leaders already use', score: 4 },
      { text: 'AI surfaces insights proactively with recommended actions in the flow of work', score: 5 },
    ],
    weight: 1.0,
    tags: ['workflow', 'decision_support'],
  },
  {
    id: 'WI-05',
    dimension: 'workflow_integration',
    text: 'What percentage of your AI projects have been successfully integrated into production workflows (not just piloted)?',
    options: [
      { text: 'Less than 10%. Most remain experiments or proofs of concept.', score: 0 },
      { text: '10–25%. A few have made it to production.', score: 1 },
      { text: '25–50%. About half transition from pilot to production.', score: 2 },
      { text: '50–75%. Most pilots are designed with production integration in mind.', score: 4 },
      { text: 'More than 75%. Pilot-to-production is a well-oiled process.', score: 5 },
    ],
    weight: 1.4,
    tags: ['workflow', 'production', 'scale'],
  },
  {
    id: 'WI-06',
    dimension: 'workflow_integration',
    text: 'How do employees provide feedback on AI tool performance?',
    options: [
      { text: 'There is no feedback mechanism', score: 0 },
      { text: 'Informal complaints through managers or IT tickets', score: 1 },
      { text: 'Periodic surveys about tool satisfaction', score: 2 },
      { text: 'In-context feedback mechanisms (thumbs up/down, corrections) that feed back into models', score: 4 },
      { text: 'Continuous feedback loops with visible model improvements based on user input', score: 5 },
    ],
    weight: 1.0,
    tags: ['workflow', 'feedback', 'improvement'],
  },
  {
    id: 'WI-07',
    dimension: 'workflow_integration',
    text: 'How do you handle the transition when an AI system replaces or augments a manual process?',
    options: [
      { text: 'We deploy the AI tool and expect people to figure it out', score: 0 },
      { text: 'Training sessions are offered but the old process remains the fallback', score: 1 },
      { text: 'Parallel operation for a defined period, then hard cutover', score: 2 },
      { text: 'Structured change management with process redesign and role redefinition', score: 4 },
      { text: 'Continuous process evolution with AI capabilities expanding incrementally into workflows', score: 5 },
    ],
    weight: 1.1,
    tags: ['workflow', 'change_management'],
  },
  {
    id: 'WI-08',
    dimension: 'workflow_integration',
    text: 'How well do your AI tools work together as a system?',
    options: [
      { text: 'Each AI tool operates independently, with no shared context between them', score: 0 },
      { text: 'Manual effort required to connect outputs from one AI tool to another', score: 1 },
      { text: 'Some tools share data but orchestration is manual', score: 2 },
      { text: 'AI tools are connected through shared platforms or orchestration layers', score: 4 },
      { text: 'Unified AI platform where tools share context, memory, and learn from each other', score: 5 },
    ],
    weight: 1.0,
    tags: ['workflow', 'orchestration', 'platform'],
  },
  {
    id: 'WI-09',
    dimension: 'workflow_integration',
    text: 'How does AI factor into your customer-facing interactions (sales, support, service)?',
    options: [
      { text: 'Customer-facing teams do not use AI in any meaningful way', score: 0 },
      { text: 'Basic chatbots or canned response systems exist but are rarely effective', score: 1 },
      { text: 'AI assists with knowledge retrieval or suggestion during customer interactions', score: 2 },
      { text: 'AI is embedded in customer workflows with real-time guidance, next-best-action, and sentiment analysis', score: 4 },
      { text: 'AI co-pilots customer interactions end-to-end: personalization, resolution prediction, proactive outreach, and continuous learning from outcomes', score: 5 },
    ],
    weight: 1.2,
    tags: ['workflow', 'customer_facing', 'cx'],
  },
  {
    id: 'WI-10',
    dimension: 'workflow_integration',
    text: 'How is AI integrated into your internal knowledge management and documentation?',
    options: [
      { text: 'Knowledge management is entirely manual with no AI involvement', score: 0 },
      { text: 'Basic search exists but employees still spend significant time finding information', score: 1 },
      { text: 'AI-powered search helps locate documents but doesn\'t synthesize or summarize', score: 2 },
      { text: 'AI generates summaries, surfaces relevant context proactively, and keeps documentation updated', score: 4 },
      { text: 'Organizational knowledge is continuously captured, structured, and surfaced by AI at the point of need across all workflows', score: 5 },
    ],
    weight: 1.0,
    tags: ['workflow', 'knowledge_management'],
  },
  {
    id: 'WI-11',
    dimension: 'workflow_integration',
    text: 'To what extent has AI changed the nature of meetings and collaborative decision-making?',
    options: [
      { text: 'Meetings are conducted exactly as they were before AI existed', score: 0 },
      { text: 'Some teams use AI for transcription or note-taking after meetings', score: 1 },
      { text: 'AI pre-generates agendas, summaries, and action items for select meeting types', score: 2 },
      { text: 'AI actively participates in meetings: surfacing data, flagging conflicts, and tracking commitments in real-time', score: 4 },
      { text: 'AI has fundamentally reduced meeting load; most coordination happens asynchronously through AI-mediated workflows', score: 5 },
    ],
    weight: 1.0,
    tags: ['workflow', 'collaboration', 'meetings'],
  },
  {
    id: 'WI-12',
    dimension: 'workflow_integration',
    text: 'How deeply is AI integrated into your financial planning, budgeting, and forecasting processes?',
    options: [
      { text: 'Financial planning is entirely spreadsheet-driven with no AI involvement', score: 0 },
      { text: 'Some AI-generated forecasts exist but planners default to manual models', score: 1 },
      { text: 'AI provides inputs to the planning process but human analysts build the final models', score: 2 },
      { text: 'AI generates baseline forecasts that planners refine; scenario modeling is AI-assisted', score: 4 },
      { text: 'Continuous AI-driven forecasting with real-time variance detection, automated scenario modeling, and direct integration to resource allocation', score: 5 },
    ],
    weight: 1.1,
    tags: ['workflow', 'finance', 'planning'],
  },
  {
    id: 'WI-13',
    dimension: 'workflow_integration',
    text: 'How does AI influence your product development or service design process?',
    options: [
      { text: 'AI plays no role in how we design products or services', score: 0 },
      { text: 'Developers or designers occasionally use AI tools as personal productivity aids', score: 1 },
      { text: 'AI is used in specific stages (testing, code review, user research analysis) but not end-to-end', score: 2 },
      { text: 'AI is embedded across the development lifecycle from ideation through deployment and monitoring', score: 4 },
      { text: 'AI is a co-creator: generating prototypes, predicting market fit, optimizing features, and enabling continuous experimentation at scale', score: 5 },
    ],
    weight: 1.1,
    tags: ['workflow', 'product', 'innovation'],
  },
];

// ---------------------------------------------------------------------------
// DIMENSION 4: DECISION VELOCITY (7+5=12 questions)
// Measures speed from insight to action and from idea to deployment
// ---------------------------------------------------------------------------

const decisionVelocity: DiagnosticQuestion[] = [
  {
    id: 'DV-01',
    dimension: 'decision_velocity',
    text: 'How long does it take from identifying a valuable AI use case to having a funded pilot in progress?',
    options: [
      { text: 'More than 12 months or it never happens', score: 0 },
      { text: '6–12 months', score: 1 },
      { text: '3–6 months', score: 2 },
      { text: '4–12 weeks', score: 4 },
      { text: 'Less than 4 weeks for use cases within pre-approved parameters', score: 5 },
    ],
    weight: 1.3,
    tags: ['velocity', 'pilot', 'approval'],
  },
  {
    id: 'DV-02',
    dimension: 'decision_velocity',
    text: 'When an AI pilot demonstrates clear value, how long does scaling take?',
    options: [
      { text: 'Pilots rarely lead to scaled deployment', score: 0 },
      { text: 'Scaling requires a new business case and takes 6–12+ months', score: 1 },
      { text: '3–6 months with dedicated resources', score: 2 },
      { text: '1–3 months. Scaling path is defined before the pilot begins.', score: 4 },
      { text: 'Pilots are designed to scale. Successful pilots expand automatically.', score: 5 },
    ],
    weight: 1.4,
    tags: ['velocity', 'scale', 'deployment'],
  },
  {
    id: 'DV-03',
    dimension: 'decision_velocity',
    text: 'How often does the same AI initiative require re-approval at different organizational levels?',
    options: [
      { text: 'Constantly. Every stage requires fresh justification to new stakeholders.', score: 0 },
      { text: 'Frequently. 3–4 separate approval processes from pilot to production.', score: 1 },
      { text: 'Occasionally. Key milestones require re-approval but context is preserved.', score: 2 },
      { text: 'Rarely. Initial approval covers the full lifecycle with checkpoint reviews.', score: 4 },
      { text: 'Never. Programs are approved with stage-gate criteria, not repeated justification.', score: 5 },
    ],
    weight: 1.2,
    tags: ['velocity', 'approval', 'redundancy'],
  },
  {
    id: 'DV-04',
    dimension: 'decision_velocity',
    text: 'How quickly can your organization respond when a competitor announces a significant AI capability?',
    options: [
      { text: 'We wouldn\'t know about it for weeks or months', score: 0 },
      { text: 'Discussion happens but no action framework exists', score: 1 },
      { text: 'Assessment occurs within weeks but response takes quarters', score: 2 },
      { text: 'Rapid assessment and response within 30–60 days', score: 4 },
      { text: 'Competitive intelligence is continuous; we\'re typically ahead, not reacting', score: 5 },
    ],
    weight: 1.0,
    tags: ['velocity', 'competitive', 'response'],
  },
  {
    id: 'DV-05',
    dimension: 'decision_velocity',
    text: 'How long does procurement take for a new AI tool or platform?',
    options: [
      { text: '6+ months with extensive vendor evaluation and security review', score: 0 },
      { text: '3–6 months through standard procurement process', score: 1 },
      { text: '1–3 months with expedited review for approved categories', score: 2 },
      { text: '2–4 weeks through pre-approved vendor marketplace', score: 4 },
      { text: 'Days. Pre-approved tools are self-service; new vendors have a fast-track process.', score: 5 },
    ],
    weight: 1.0,
    tags: ['velocity', 'procurement'],
  },
  {
    id: 'DV-06',
    dimension: 'decision_velocity',
    text: 'What is the average tenure of an AI initiative sponsor before they rotate to a new role?',
    options: [
      { text: 'AI initiatives don\'t have consistent sponsors', score: 0 },
      { text: 'Sponsors change before most initiatives complete (< 6 months)', score: 1 },
      { text: 'Sponsors typically stay 6–12 months but continuity is disrupted', score: 2 },
      { text: 'Sponsors are committed through initiative completion with succession planning', score: 4 },
      { text: 'Sponsorship is institutional, tied to roles, not individuals', score: 5 },
    ],
    weight: 0.9,
    tags: ['velocity', 'continuity', 'leadership'],
  },
  {
    id: 'DV-07',
    dimension: 'decision_velocity',
    text: 'How does your organization handle the tension between AI speed-to-market and risk management?',
    options: [
      { text: 'Risk management wins every time. Speed is sacrificed for safety.', score: 0 },
      { text: 'Constant tension with no framework. Outcomes depend on who escalates louder.', score: 1 },
      { text: 'Risk appetite is defined in theory but interpreted inconsistently in practice', score: 2 },
      { text: 'Clear risk tiers with proportionate review processes for each level', score: 4 },
      { text: 'Risk management is embedded in development. Speed and safety are not in conflict.', score: 5 },
    ],
    weight: 1.1,
    tags: ['velocity', 'risk', 'governance'],
  },
  {
    id: 'DV-08',
    dimension: 'decision_velocity',
    text: 'When a competitor announces a significant AI capability, how quickly does your organization respond?',
    options: [
      { text: 'We typically don\'t notice or respond to competitor AI moves', score: 0 },
      { text: 'It triggers discussion but no action for 6+ months', score: 1 },
      { text: 'A competitive analysis is commissioned; response takes 3–6 months', score: 2 },
      { text: 'Standing competitive intelligence process assesses implications within weeks; response plan within 60 days', score: 4 },
      { text: 'Continuous competitive monitoring with pre-approved response playbooks; counter-moves deploy in days to weeks', score: 5 },
    ],
    weight: 1.2,
    tags: ['velocity', 'competitive', 'responsiveness'],
  },
  {
    id: 'DV-09',
    dimension: 'decision_velocity',
    text: 'How quickly can your organization decommission or replace an underperforming AI solution?',
    options: [
      { text: 'Sunken cost fallacy rules; we\'ve never shut down a deployed AI system', score: 0 },
      { text: 'Decommissioning takes 6–12 months due to organizational inertia and vendor contracts', score: 1 },
      { text: 'We can sunset tools in 3–6 months if a business case is made', score: 2 },
      { text: 'Kill criteria are defined upfront; underperformers are flagged and replaced within 8 weeks', score: 4 },
      { text: 'Continuous performance monitoring with automated alerts; replacement and migration are standard operating procedure', score: 5 },
    ],
    weight: 1.0,
    tags: ['velocity', 'agility', 'portfolio'],
  },
  {
    id: 'DV-10',
    dimension: 'decision_velocity',
    text: 'How effectively does your organization capture and share learnings from AI experiments across teams?',
    options: [
      { text: 'Learnings stay trapped in the team that ran the experiment, if captured at all', score: 0 },
      { text: 'Occasional presentations or email updates but no structured process', score: 1 },
      { text: 'Retrospectives happen but findings are documented inconsistently and rarely referenced', score: 2 },
      { text: 'Centralized knowledge repository with structured experiment logs; teams reference prior work before starting new initiatives', score: 4 },
      { text: 'Living institutional memory: AI experiment results feed automated recommendations for future projects; cross-team learning is built into the operating model', score: 5 },
    ],
    weight: 1.0,
    tags: ['velocity', 'learning', 'knowledge'],
  },
  {
    id: 'DV-11',
    dimension: 'decision_velocity',
    text: 'How does your organization decide between building custom AI solutions versus buying or licensing them?',
    options: [
      { text: 'No framework exists; it depends on who\'s making the decision', score: 0 },
      { text: 'Default is to buy/license; build is rarely considered regardless of strategic value', score: 1 },
      { text: 'Build vs. buy analysis happens but criteria are inconsistent and politically influenced', score: 2 },
      { text: 'Clear build-buy-partner decision framework based on strategic value, data sensitivity, and competitive differentiation', score: 4 },
      { text: 'Dynamic portfolio approach: core differentiators are built in-house, commodity capabilities are licensed, with regular rebalancing as the market evolves', score: 5 },
    ],
    weight: 1.1,
    tags: ['velocity', 'strategy', 'build_buy'],
  },
  {
    id: 'DV-12',
    dimension: 'decision_velocity',
    text: 'When new AI regulations or compliance requirements emerge, how quickly does your organization adapt?',
    options: [
      { text: 'We react only when forced; compliance is achieved months after deadlines', score: 0 },
      { text: 'Legal monitors regulations but organizational response is slow and reactive', score: 1 },
      { text: 'A compliance team tracks requirements; adaptation takes 3–6 months', score: 2 },
      { text: 'Proactive regulatory monitoring with pre-planned response protocols; adaptation within weeks', score: 4 },
      { text: 'Regulatory intelligence is embedded in AI governance; we often comply before regulations take effect and participate in shaping industry standards', score: 5 },
    ],
    weight: 1.2,
    tags: ['velocity', 'regulatory', 'compliance'],
  },
];

// ---------------------------------------------------------------------------
// DIMENSION 5: ECONOMIC TRANSLATION (7+5=12 questions)
// Measures ability to quantify and capture financial value from AI
// ---------------------------------------------------------------------------

const economicTranslation: DiagnosticQuestion[] = [
  {
    id: 'ET-01',
    dimension: 'economic_translation',
    text: 'How does your organization measure the financial impact of AI investments?',
    options: [
      { text: 'We don\'t. AI is treated as an R&D/innovation expense.', score: 0 },
      { text: 'Anecdotal stories of value but no systematic measurement', score: 1 },
      { text: 'Basic ROI calculations on some projects, but inconsistent methodology', score: 2 },
      { text: 'Standardized value measurement framework applied across AI initiatives', score: 4 },
      { text: 'Real-time financial tracking with AI value integrated into business unit P&Ls', score: 5 },
    ],
    weight: 1.4,
    tags: ['economic', 'measurement', 'financial'],
  },
  {
    id: 'ET-02',
    dimension: 'economic_translation',
    text: 'When AI saves employee time, what happens to that recovered capacity?',
    options: [
      { text: 'Nothing specific. Saved time is absorbed without tracking.', score: 0 },
      { text: 'Employees fill time with existing work; no reallocation occurs', score: 1 },
      { text: 'Some managers redirect saved time but it\'s inconsistent', score: 2 },
      { text: 'Recovered capacity is tracked and deliberately redirected to higher-value activities', score: 4 },
      { text: 'Workforce planning is updated to reflect AI-augmented capacity with clear reallocation targets', score: 5 },
    ],
    weight: 1.3,
    tags: ['economic', 'productivity', 'capacity'],
  },
  {
    id: 'ET-03',
    dimension: 'economic_translation',
    text: 'How is AI investment justified to the board or executive leadership?',
    options: [
      { text: 'As a competitive necessity: "everyone else is doing it"', score: 0 },
      { text: 'Through vendor-provided ROI projections', score: 1 },
      { text: 'Using internal business cases with estimated cost savings', score: 2 },
      { text: 'Through a portfolio approach with measured returns across multiple dimensions', score: 4 },
      { text: 'AI investments are measured against total economic value creation including revenue, cost, speed, and quality', score: 5 },
    ],
    weight: 1.1,
    tags: ['economic', 'justification', 'board'],
  },
  {
    id: 'ET-04',
    dimension: 'economic_translation',
    text: 'Has your organization been able to translate AI-driven productivity gains into measurable cost reduction or revenue growth?',
    options: [
      { text: 'No. We cannot point to any financial impact from AI.', score: 0 },
      { text: 'Isolated examples but not at material scale', score: 1 },
      { text: 'Measurable impact in 1–2 areas but it\'s a small fraction of AI investment', score: 2 },
      { text: 'Documented impact exceeding AI investment costs in multiple areas', score: 4 },
      { text: 'AI is a primary driver of margin expansion or revenue growth visible in financial statements', score: 5 },
    ],
    weight: 1.4,
    tags: ['economic', 'revenue', 'cost_reduction'],
  },
  {
    id: 'ET-05',
    dimension: 'economic_translation',
    text: 'How does your finance team think about AI-related spending?',
    options: [
      { text: 'As an IT line item with unclear returns', score: 0 },
      { text: 'As a necessary cost of innovation, hard to measure but important', score: 1 },
      { text: 'Finance has basic visibility into AI spending but limited connection to outcomes', score: 2 },
      { text: 'AI spending is tied to specific business outcomes with regular financial reviews', score: 4 },
      { text: 'Finance models AI as a capital investment with measured returns on multiple time horizons', score: 5 },
    ],
    weight: 1.0,
    tags: ['economic', 'finance', 'accounting'],
  },
  {
    id: 'ET-06',
    dimension: 'economic_translation',
    text: 'What is your total AI-related spend as a percentage of revenue, and how does it compare to your industry?',
    options: [
      { text: 'We don\'t know our total AI spend', score: 0 },
      { text: 'We know the number but have no industry benchmark', score: 1 },
      { text: 'Below industry average with plans to increase', score: 2 },
      { text: 'At or above industry average with clear allocation strategy', score: 3 },
      { text: 'Strategically positioned: spending optimized based on value capture, not industry norms', score: 5 },
    ],
    weight: 0.9,
    tags: ['economic', 'spending', 'benchmark'],
  },
  {
    id: 'ET-07',
    dimension: 'economic_translation',
    text: 'If you had to defend your AI program\'s economic contribution to an activist investor, how confident would you be?',
    options: [
      { text: 'Not at all. We couldn\'t make a credible financial case.', score: 0 },
      { text: 'Weak. We have some stories but limited hard numbers.', score: 1 },
      { text: 'Moderate. Some metrics exist but the full picture is incomplete.', score: 2 },
      { text: 'Confident. Clear metrics showing positive ROI across the portfolio.', score: 4 },
      { text: 'Very confident. AI is a demonstrable competitive advantage with financial proof.', score: 5 },
    ],
    weight: 1.2,
    tags: ['economic', 'accountability', 'investor'],
  },
  {
    id: 'ET-08',
    dimension: 'economic_translation',
    text: 'How does your organization account for the "hidden costs" of AI (data preparation, change management, ongoing maintenance)?',
    options: [
      { text: 'Hidden costs are not tracked; only licensing and headcount are budgeted', score: 0 },
      { text: 'We know hidden costs exist but have no framework to quantify them', score: 1 },
      { text: 'Some hidden costs are estimated but systematically underbudgeted', score: 2 },
      { text: 'Total cost of ownership models include data prep, training, maintenance, and change management', score: 4 },
      { text: 'Full lifecycle costing with real-time tracking of all direct and indirect costs, informing continuous portfolio optimization', score: 5 },
    ],
    weight: 1.1,
    tags: ['economic', 'tco', 'hidden_costs'],
  },
  {
    id: 'ET-09',
    dimension: 'economic_translation',
    text: 'How effectively does your organization use AI to generate net-new revenue (new products, services, or markets)?',
    options: [
      { text: 'AI has not been considered as a revenue driver; it\'s viewed purely as a cost-reduction tool', score: 0 },
      { text: 'Some ideas exist for AI-enabled products/services but none have launched', score: 1 },
      { text: 'One or two AI-enabled offerings are in market but revenue contribution is minimal', score: 2 },
      { text: 'AI-enabled products/services contribute measurable revenue with a clear growth trajectory', score: 4 },
      { text: 'AI is a core revenue engine; multiple AI-native products in market with proven customer willingness to pay and expanding addressable market', score: 5 },
    ],
    weight: 1.3,
    tags: ['economic', 'revenue', 'innovation'],
  },
  {
    id: 'ET-10',
    dimension: 'economic_translation',
    text: 'How does your AI investment compare to your industry peers as a percentage of revenue?',
    options: [
      { text: 'We don\'t know what peers are spending and haven\'t benchmarked', score: 0 },
      { text: 'We believe we\'re significantly behind peers but have no precise data', score: 1 },
      { text: 'We track some benchmarks; our spend is at or slightly below industry median', score: 2 },
      { text: 'We actively benchmark against top-quartile peers and invest accordingly', score: 4 },
      { text: 'We are a recognized AI investment leader in our sector with deliberate above-market spending tied to strategic differentiation', score: 5 },
    ],
    weight: 1.0,
    tags: ['economic', 'benchmarking', 'investment'],
  },
  {
    id: 'ET-11',
    dimension: 'economic_translation',
    text: 'How does your organization think about the AI talent premium (cost of hiring and retaining AI-skilled employees)?',
    options: [
      { text: 'We haven\'t adjusted compensation or talent strategy for AI skills', score: 0 },
      { text: 'We\'re losing AI talent to competitors and struggling to compete on compensation', score: 1 },
      { text: 'We pay market rate for dedicated AI roles but haven\'t valued AI skills across the broader workforce', score: 2 },
      { text: 'AI skills are reflected in compensation bands across roles; retention programs target key AI talent', score: 4 },
      { text: 'Strategic talent portfolio: competitive compensation, internal mobility, AI upskilling paths, and brand positioning that attracts top AI talent', score: 5 },
    ],
    weight: 1.0,
    tags: ['economic', 'talent', 'compensation'],
  },
  {
    id: 'ET-12',
    dimension: 'economic_translation',
    text: 'How clearly can you articulate the "cost of doing nothing" with respect to AI transformation?',
    options: [
      { text: 'We haven\'t framed it in those terms; AI is seen as optional', score: 0 },
      { text: 'Leadership senses urgency but can\'t quantify the risk of inaction', score: 1 },
      { text: 'Qualitative arguments exist (competitor moves, talent flight) but no financial modeling', score: 2 },
      { text: 'Financial model quantifies cost of inaction across key value levers (market share, productivity gap, talent cost)', score: 4 },
      { text: 'Dynamic cost-of-inaction model updated quarterly with competitive intelligence, tied to strategic planning and board-level capital allocation decisions', score: 5 },
    ],
    weight: 1.2,
    tags: ['economic', 'inaction', 'strategy'],
  },
];

// ---------------------------------------------------------------------------
// COMPLETE QUESTION BANK
// ---------------------------------------------------------------------------

export const DIAGNOSTIC_QUESTIONS: DiagnosticQuestion[] = [
  ...adoptionBehavior,
  ...authorityStructure,
  ...workflowIntegration,
  ...decisionVelocity,
  ...economicTranslation,
];

export const QUESTIONS_BY_DIMENSION: Record<string, DiagnosticQuestion[]> = {
  adoption_behavior: adoptionBehavior,
  authority_structure: authorityStructure,
  workflow_integration: workflowIntegration,
  decision_velocity: decisionVelocity,
  economic_translation: economicTranslation,
};

export function getQuestionById(id: string): DiagnosticQuestion | undefined {
  return DIAGNOSTIC_QUESTIONS.find((q) => q.id === id);
}

export function getQuestionsByDimension(dimension: string): DiagnosticQuestion[] {
  return DIAGNOSTIC_QUESTIONS.filter((q) => q.dimension === dimension);
}
