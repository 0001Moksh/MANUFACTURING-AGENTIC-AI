export interface UseCase {
  id: number;
  pillar: string;
  title: string;
  tags: string[];
  status: 'live' | 'pilot';
  desc: string;
  impact: string;
}

export const useCases: UseCase[] = [
  {id:1,pillar:"opex",title:"Agentic Daily Operations & Resources Reporting",tags:["AGENTIC","GENAI"],status:"live",
   desc:"The agent prepares daily production and resource reports through a guided conversation, collecting inputs by voice or writing, compiling and publishing them in each recipient's own template.",
   impact:"Time on daily reporting minimized; consistent, on-time submissions from every line."},
  {id:2,pillar:"opex",title:"Voice Interaction Layer",tags:["VOICE","GENAI"],status:"live",
   desc:"A voice layer that works across every interaction, in any local language, converting speech to text into forms or the chat experience, and reading answers aloud for hands-free plant-floor use.",
   impact:"Every form and chat becomes voice-enabled; faster input where keyboards are impractical."},
  {id:3,pillar:"opex",title:"Knowledge Assistant: Manuals & SOPs",tags:["GENAI","VOICE"],status:"live",
   desc:"A generative-AI assistant that lets the workforce ask about equipment, manuals, processes or SOPs in natural language and get an immediate, cited answer without searching documents.",
   impact:"Technical answers in seconds; faster onboarding; fewer errors from outdated procedures."},
  {id:4,pillar:"opex",title:"Platform E-Services Agentic Assistant",tags:["AGENTIC","VOICE"],status:"pilot",
   desc:"An agentic assistant embedded in every plant service journey — understands intent, guides step by step, pre-fills forms, validates documents on upload, and completes routine transactions.",
   impact:"Faster service completion; fewer abandoned requests; lower support workload."},
  {id:5,pillar:"opex",title:"Procedures Compliance Copilot",tags:["GENAI","AGENTIC"],status:"live",
   desc:"An interactive guide for shop-floor and back-office users that validates every entry against official SOPs in real time and warns before a mistake is committed, rather than after.",
   impact:"Rework minimized; procedures executed correctly the first time; faster ramp-up of new staff."},
  {id:6,pillar:"opex",title:"Chat with Data: Executive Insights",tags:["GENAI"],status:"live",
   desc:"A chat experience over enterprise data that lets leadership ask for any report in natural language and receive an instant answer, visualized as charts with a short narrative summary.",
   impact:"Management self-serves insights in seconds; one governed source of truth behind every number."},
  {id:7,pillar:"opex",title:"Intelligent Document Data Extraction",tags:["VISION","GENAI"],status:"live",
   desc:"Reads any document and extracts its data automatically using OCR and generative AI — manuals, certificates, invoices, forms or IDs — flowing straight into the platform as structured, searchable data.",
   impact:"Manual data entry eliminated; fewer typing errors; every document searchable on arrival."},
  {id:8,pillar:"opex",title:"Annual & Corporate Report Studio",tags:["GENAI"],status:"pilot",
   desc:"Generative AI produces annual and sustainability reports following corporate templates exactly — drafting sections, keeping tone and terminology consistent, generating charts and aligning languages.",
   impact:"Report production cut from months to weeks; guaranteed format and terminology consistency."},
  {id:9,pillar:"sustain",title:"Computer Vision Safety & Site Intelligence",tags:["VISION","ML"],status:"live",
   desc:"Utilizes existing cameras across lines, warehouses and yards to automatically detect PPE breaches, falls, unsafe behavior, spills, smoke and other operational anomalies, generating live heat maps of risk.",
   impact:"Real-time prevention instead of after-the-fact review; measurable reduction in incidents."},
  {id:10,pillar:"sustain",title:"Wearables: Workforce Health Monitoring",tags:["IOT","ML"],status:"pilot",
   desc:"Wearable devices continuously monitor vital signs during operations. ML models watch readings around the clock and predict health issues before they become emergencies, such as heat stress on a shift.",
   impact:"Health incidents predicted and prevented rather than responded to; faster emergency response."},
  {id:11,pillar:"sustain",title:"IoT Asset Tracking & Condition Monitoring",tags:["IOT","ML"],status:"live",
   desc:"IoT sensors provide real-time asset location, utilization, temperature and vibration signatures across an increasingly distributed plant footprint, feeding live dashboards and early-warning alerts.",
   impact:"Full visibility over a growing asset base; faults detected before they escalate."},
  {id:12,pillar:"sustain",title:"AI Spill/Leak Detection & Response Orchestration",tags:["VISION","ML"],status:"live",
   desc:"Watches tanks, drains and yards using existing cameras and environmental sensors. The moment a spill or leak is spotted, the system predicts its spread and recommends which response teams to send first.",
   impact:"Spills detected in minutes, not hours; the right response assets sent first time."},
  {id:13,pillar:"growth",title:"Agentic Production Orchestration",tags:["AGENTIC","ML"],status:"pilot",
   desc:"An agentic layer on top of existing production-planning systems that plans line schedules and resolves exceptions across every plant and distribution point, replanning in minutes when disruption hits.",
   impact:"Higher line utilization; disruptions recovered in minutes instead of hours of manual coordination."},
  {id:14,pillar:"growth",title:"AI Resources, Demand & Line Analytics",tags:["ML"],status:"live",
   desc:"Predictive ML that converts operational data from lines, plants and warehouses into forward-looking insight — anticipating maintenance needs and spare-parts demand, keeping stock at optimum levels.",
   impact:"Optimum stock levels without over- or under-stocking; higher crew and asset utilization."},
  {id:15,pillar:"growth",title:"Digital Twin & What-If Scenario Analytics",tags:["ML","GENAI"],status:"pilot",
   desc:"A live digital twin of the operation that aggregates and analyzes operational data. Planners ask what-if questions in natural language and the twin simulates predicted impact before any decision is committed.",
   impact:"Decisions rehearsed before they are taken; planning moves from experience-based to evidence-based."},
  {id:16,pillar:"finance",title:"Supply Chain Domain Awareness & Threat Intelligence",tags:["ML","GENAI"],status:"pilot",
   desc:"Keeps a live watch over every plant, supplier route and logistics lane, combining sensor signals, public news and security alerts into one live risk map, warning early when a route enters a danger zone.",
   impact:"Early warning across the supply network; faster, calmer crisis response."},
  {id:17,pillar:"finance",title:"Social Media & Geopolitical Risk Scanner",tags:["GENAI","ML"],status:"pilot",
   desc:"Continuously scans social media, news and open sources for unrest or rising tension near plants, ports and supplier regions, alerting the right desk with recommended proactive actions.",
   impact:"Proactive mitigation instead of reactive scrambling; one early-warning picture across teams."},
  {id:18,pillar:"finance",title:"OT / ICS Cyber-Anomaly Detection",tags:["ML"],status:"live",
   desc:"Protects the digital systems every plant depends on. The system learns what normal looks like for each machine's control network and raises an alert the moment behavior turns abnormal.",
   impact:"Cyber interference caught early, before it endangers production or safety."},
  {id:19,pillar:"finance",title:"Commercial Forecast & Sales Intelligence",tags:["ML","GENAI"],status:"live",
   desc:"Combines demand, pricing and inventory predictions with commercial execution. A commercial copilot converts forecasts into action: recommending order allocation, pricing, and contract timing.",
   impact:"Better pricing and fixture timing across the plant network; faster, evidence-backed decisions."},
  {id:20,pillar:"horizontal",title:"AI Technical Support Desk",tags:["AGENTIC","VOICE"],status:"live",
   desc:"Voice and chat agents answer technical support calls from plants, lines and offices around the clock, auto-triage the issue, resolve known problems, and dispatch field teams with context already attached.",
   impact:"Support coverage around the clock; faster resolution; lower first-line support burden."},
  {id:21,pillar:"horizontal",title:"HR Candidate Profile Assessment",tags:["ML","GENAI"],status:"pilot",
   desc:"Assesses resumes and candidate profiles against role requirements, skills and structured criteria, producing a ranked shortlist with reasoning attached for recruiter review, for shop-floor and shore roles alike.",
   impact:"Faster shortlist cycles for a large workforce; consistent screening; better candidate quality."},
  {id:22,pillar:"horizontal",title:"Finance Invoice & Budget Control",tags:["GENAI","ML"],status:"live",
   desc:"Reads invoices from purchase orders, maintenance and suppliers together with budget lines and approval chains, flagging exceptions, duplicates and budget impact before processing.",
   impact:"Faster finance review; fewer manual checks; clearer spend visibility across plants."},
  {id:23,pillar:"horizontal",title:"Procurement Sourcing & Vendor Evaluation",tags:["GENAI","ML"],status:"pilot",
   desc:"Supports sourcing requests for spare parts and services: drafting request documents, comparing vendor responses against evaluation criteria side by side, and tracking clarifications through to closure.",
   impact:"Shorter sourcing cycles; more consistent evaluation; stronger procurement governance."},
];

export const pillarMeta: Record<string, { label: string }> = {
  opex:{label:"Operational Excellence"},
  sustain:{label:"Sustainable Operations"},
  growth:{label:"Smart Growth & Expansion"},
  finance:{label:"Financial Resilience"},
  horizontal:{label:"Horizontal Enterprise"},
};

export const adminTemplates: Record<string, string[][]> = {
  AGENTIC:[["Autonomy level","Act with approval"],["Approval chain","Shift Supervisor → Plant Head"],["Exception handling","Auto-escalate after 15 min"]],
  GENAI:[["Grounded data sources","4 connected (SOPs, ERP, EHS, manuals)"],["Response citations","Required, shown inline"],["Language packs","EN, AR, HI"]],
  VOICE:[["Supported languages","EN, AR, HI, local dialects"],["Hands-free mode","Enabled on vessel / shop floor"],["Transcript retention","90 days, audit-logged"]],
  VISION:[["Camera feeds linked","18 of 24 available"],["Detection confidence threshold","87%"],["Privacy masking"," On for non-safety zones"]],
  ML:[["Model retrain cadence","Weekly, auto-validated"],["Forecast horizon","7–30 days"],["Drift monitoring","Active, alerts Digital Head"]],
  IOT:[["Connected sensors","1,240 across site"],["Sampling frequency","Every 30s"],["Processing","Edge-first, cloud sync"]],
};

export interface Agent {
  n: string;
  status: 'active' | 'watch';
  sig: string;
  desc: string;
  last: string;
  owner: string;
}

export const agents: Agent[] = [
  {n:"Operations Agent",status:"active",sig:"12 live signals",desc:"Monitors throughput, OEE and shift targets in real time; recommends corrective scheduling.",last:"2 min ago",owner:"Plant Digital Head"},
  {n:"Maintenance Agent",status:"watch",sig:"1 critical flag",desc:"LSTM predictive models flag failures up to 2 weeks early; raises work orders automatically.",last:"1 min ago",owner:"Maintenance Lead"},
  {n:"Reporting Agent",status:"active",sig:"2 daily reports",desc:"Automates end-of-shift reporting, aggregates KPIs, and emails PDF summaries to stakeholders.",last:"just now",owner:"Plant Manager"},
  {n:"Safety & Quality Agent",status:"active",sig:"0 incidents",desc:"AI vision for PPE compliance, intrusion detection and quality inspection, 97%+ defect coverage.",last:"just now",owner:"HSE Officer"},
  {n:"Energy Agent",status:"watch",sig:"3 high-draw lines",desc:"Machine-level kWh tracking with AI peak-demand shaving and 2-week energy forecasting.",last:"4 min ago",owner:"Plant Digital Head"},
  {n:"ESG & Compliance Agent",status:"watch",sig:"1 watch item",desc:"Tracks SO₂, CO₂ and permit thresholds; auto-generates regulatory reports before breach.",last:"6 min ago",owner:"HSE Officer"},
  {n:"Finance Agent",status:"active",sig:"On budget",desc:"Real-time P&L, EBITDA and capex-pacing intelligence with instant variance flags.",last:"3 min ago",owner:"Finance Controller"},
  {n:"PPE & Behavior Vision Agent",status:"active",sig:"12 live signals",desc:"Detects PPE compliance and unsafe acts — restricted-zone entry, fatigue, collapse.",last:"just now",owner:"HSE Officer"},
  {n:"Permit-to-Work Agent",status:"watch",sig:"4 expired permits",desc:"Tracks hot work, confined space and work-at-height permits; auto-escalates violations.",last:"1 min ago",owner:"HSE Officer"},
  {n:"Incident & Investigation Agent",status:"active",sig:"0 fatalities",desc:"Tracks TRIR, LTIFR and HIPOs; drives root-cause workflows and Zero Harm Index.",last:"5 min ago",owner:"HSE Officer"},
  {n:"Environmental Compliance Agent",status:"active",sig:"94.1% rollup",desc:"Tracks CO₂, CH₄, NOx, SOx, waste and effluent against regulatory limits.",last:"7 min ago",owner:"Environmental Lead"},
  {n:"Predictive Safety Intelligence Agent",status:"watch",sig:"6 zones flagged",desc:"Forecasts incident probability, heat stress and equipment failure 7–30 days ahead.",last:"2 min ago",owner:"HSE Officer"},
  {n:"Contractor & Asset Risk Agent",status:"active",sig:"4 high-risk",desc:"Aggregates contractor safety scores and asset failure risk into one site ranking.",last:"9 min ago",owner:"Plant Digital Head"},
];

export const feedPool = [
  ["Maintenance Agent","predicts Train-3 regenerator failure within 72h — work order WO-88213 raised in SAP.","red"],
  ["PPE & Behavior Vision Agent","flagged a missing hard-hat in Zone 4, Camera 12 — supervisor notified.","amber"],
  ["Permit-to-Work Agent","auto-escalated permit PTW-3391 (confined space) — 6h past expiry.","red"],
  ["Environmental Compliance Agent","logged SO₂ within limits — Unit 5, last 30 min average 42 mg/Nm³.","green"],
  ["Finance Agent","flagged a 14% cost variance on Plant Gamma consumables budget.","amber"],
  ["Predictive Safety Intelligence Agent","raised heat-stress risk for the 14:00–18:00 shift, Zone 7.","amber"],
  ["Operations Agent","closed the gap on Line 3 — output back to 98% of plan.","green"],
  ["Contractor & Asset Risk Agent","updated risk ranking — Contractor #CN-114 moved to high-risk.","amber"],
  ["Incident & Investigation Agent","closed root-cause on near-miss NM-2026-081.","green"],
  ["AI Spill/Leak Detection Agent","cleared a false-positive alert at Tank Farm 2 after review.","green"],
];

export const connectors = [
  ["🧾","SAP ERP (BAPI / REST)","Production, finance and materials data — CO11N / MB31 / QM01 native.","Connected"],
  ["🏭","MES / SCADA / PLC","Line-level throughput, machine status and control-system telemetry.","Connected"],
  ["📋","EHS / Permit-to-Work System","Permits, incidents and compliance records synced in real time.","Connected"],
  ["📡","IoT Gateway (MQTT)","Sensor ingestion from vibration, temperature and gas monitors.","Connected"],
  ["🎥","CCTV / NVR (Vision AI)","Existing camera infrastructure — no new hardware required.","Connected"],
  ["⌚","Wearables / Health IoT","Vital-sign and fatigue monitoring devices.","Pilot"],
  ["💬","MS Teams / Email / SMS","Notification and escalation delivery channels.","Connected"],
  ["🧩","Custom ERP / Navision","API-first connector for non-SAP environments.","Available"],
  ["🔑","Identity Provider (SSO)","Azure AD / Okta / SAML 2.0 federation.","Connected"],
];

export const guardrails = [
  ["Human-in-the-loop approval for high-risk actions","Required before any agent commits a production, safety or financial action above threshold","On"],
  ["Explainability logging","Every AI decision is traceable — inputs, model version and reasoning summary retained","On"],
  ["Model change approval workflow","Two-person review before any model or prompt update reaches production","On"],
  ["Data residency","Edge-first processing; on-prem or regional cloud, configurable per site","Configurable"],
  ["Red-team & safety evaluation schedule","Independent adversarial testing of every agent","Quarterly"],
  ["PII / privacy masking on vision feeds","Faces and license plates blurred by default outside safety review","On"],
];

export const rules = [
  ["IF","permit expires within 2h AND is not renewed","notify Permit Holder + Shift Supervisor (SMS + App) within 5 min; escalate to HSE Head if unacknowledged in 15 min."],
  ["IF","predicted equipment failure probability exceeds 80%","raise a work order in SAP and notify the Maintenance Lead automatically."],
  ["IF","a PPE violation is detected twice in the same zone within 1 hour","notify the Site Safety Officer and log a formal incident."],
  ["IF","SO₂ reading exceeds the regulatory limit for 10 minutes","notify the Environmental Compliance Agent owner and auto-generate a report."],
];

export const channels = [["📧","Email"],["📱","SMS"],["💬","MS Teams"],["🟢","WhatsApp Business"],["🔔","Mobile Push"],["📥","SAP Inbox"]];

export const adoption = [["Alpha",100],["Beta",67],["Gamma",83],["Delta",100],["Epsilon",50],["Zeta",33]];
