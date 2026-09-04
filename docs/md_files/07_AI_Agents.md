# AI Agents

## Purpose
Document the 12 always-on agents shown in the agent gallery and the broader agent ecosystem implied by the feed and use-case modules.

## Agent Catalog
| Agent | Purpose | Key Signals |
|---|---|---|
| Operations Agent | Throughput and OEE monitoring | 12 live signals |
| Maintenance Agent | Predictive maintenance and work orders | 1 critical flag |
| Safety & Quality Agent | PPE, intrusion, and inspection | 0 incidents |
| Energy Agent | Energy tracking and peak shaving | 3 high-draw lines |
| ESG & Compliance Agent | Emissions and permit thresholds | 1 watch item |
| Finance Agent | P&L, EBITDA, capex pacing | On budget |
| PPE & Behavior Vision Agent | Unsafe acts and compliance | 12 live signals |
| Permit-to-Work Agent | Permit expiry and escalation | 4 expired permits |
| Incident & Investigation Agent | TRIR, LTIFR, root cause | 0 fatalities |
| Environmental Compliance Agent | Emissions, waste, effluent | 94.1% rollup |
| Predictive Safety Intelligence Agent | Incident and heat-stress forecasting | 6 zones flagged |
| Contractor & Asset Risk Agent | Contractor and asset risk ranking | 4 high-risk |

## Dependencies
- Agents consume ERP, MES, CCTV, IoT, and EHS data.
- Agents are governed by [10_Admin_Console](./10_Admin_Console.md) and [12_Settings](./12_Settings.md).

## Notes
The HTML also references specialized AI behaviors inside use cases, including voice, vision, document extraction, and chat-based assistants.

See also:
- [README](./README.md)
- [01_Platform_Architecture](./01_Platform_Architecture.md)
- [07_AI_Agents](./07_AI_Agents.md)
- [09_Use_Case_Library](./09_Use_Case_Library.md)
- [10_Admin_Console](./10_Admin_Console.md)
- [11_Analytics_and_ROI](./11_Analytics_and_ROI.md)
@"

 = @"
# Project Overview

## Purpose
This repository documents the **IIIIoT Manufacturing Agentic AI Platform** simulated in the source HTML walkthrough.

## Description
The platform presents a unified command centre for manufacturing leaders, digital heads, HSE teams, and operations staff. It combines agentic AI, generative AI, vision AI, IoT telemetry, and enterprise integrations to support production, safety, finance, planning, and governance.

## Key Features
- Live command-centre simulation with KPIs, alerts, and executive summaries
- 23 use cases grouped into 5 strategic pillars
- 12 specialized AI agents
- Admin console for roles, sites, integrations, guardrails, rules, and notifications
- ROI and adoption analytics
- Platform settings for branding, SSO, APIs, retention, and environment controls

## Relationships
- The platform architecture is described in [01_Platform_Architecture](./01_Platform_Architecture.md).
- User-facing modules are documented in [03_UI_Navigation](./03_UI_Navigation.md) and [05_Dashboard_Overview](./05_Dashboard_Overview.md).
- Functional coverage lives in [07_AI_Agents](./07_AI_Agents.md) and [09_Use_Case_Library](./09_Use_Case_Library.md).

## Notes
This documentation is derived from the single HTML simulation and includes inferred architecture where the source implied, but did not explicitly state, implementation details.


