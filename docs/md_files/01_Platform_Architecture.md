# Platform Architecture

## Purpose
Describe the inferred technical architecture behind the simulation.

## Description
The HTML implies a modular platform with a web frontend, live dashboard widgets, a data-driven agent layer, and integrations to enterprise systems. The architecture below separates what is explicit in the source from inferred operational layers.

## Architecture Layers
| Layer | Evidence from HTML | Notes |
|---|---|---|
| Frontend | Single-page HTML simulation with sidebar, topbar, widgets, modals | Explicit |
| UI Navigation | View switching for overview, use cases, agents, admin, analytics, settings | Explicit |
| Agent Layer | 12 named AI agents and 23 use cases | Explicit |
| Vision Layer | CCTV / NVR integration, PPE and spill detection, OCR extraction | Explicit and inferred |
| LLM Layer | Knowledge assistant, executive insights, report studio, chat with data | Explicit |
| IoT Layer | MQTT gateway, sensors, wearables, asset tracking | Explicit |
| ERP Layer | SAP ERP BAPI / REST, work orders, invoices, budget control | Explicit |
| MES / SCADA Layer | MES / SCADA / PLC telemetry and plant controls | Explicit |
| Notifications | Email, SMS, MS Teams, WhatsApp Business, push, SAP Inbox | Explicit |
| Analytics Layer | ROI, adoption, uptime, time-to-value, alert-to-action | Explicit |
| Security / Governance | SSO, SAML, RBAC, audit trails, approval workflows | Explicit |
| Deployment Layer | Edge-first with cloud sync, offline-capable sites | Explicit and inferred |

## Important UI and Data Elements
- KPI tiles for production, OEE, Zero Harm Index, and revenue
- Live feed of agent activity
- Executive summary with action, decision, and positive-signal buckets
- Admin tables for users, sites, integrations, and policies

## Dependencies
- [04_User_Roles](./04_User_Roles.md)
- [10_Admin_Console](./10_Admin_Console.md)
- [16_Data_Flow](./16_Data_Flow.md)

## Notes
The architecture is intentionally marked as inferred where the HTML only showed product behavior, not code or infrastructure.

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


