# Operations Agent Knowledge Base Index

**Last Updated:** 2026-09-30 12:09:53  
**Purpose:** This index helps the Operations Agent (OKF) accurately discover, retrieve, and cite the correct SOP documents.

---

## How to Use This Index
- Match user questions to the **Primary Topics** and **Keywords** below.
- Always prefer the most specific document.
- Cite Document ID + Section number when answering.
- If multiple documents apply, list them and explain the scope of each.

---

## Document Catalog

### 1. SOP-OPS-001 — Daily Production Operations and Shift Reporting

| Field | Value |
|-------|-------|
| **File** | [SOP-OPS-001_Daily_Production_Operations_and_Shift_Reporting.md](./SOP-OPS-001_Daily_Production_Operations_and_Shift_Reporting.md) |
| **Document ID** | SOP-OPS-001 |
| **Version** | 1.0 — Draft template |
| **Process Owner** | Plant / Operations Manager |
| **Primary Use** | Daily & shift-level production reporting, data validation, exception handling, and shift handover |
| **Pages** | 5 |

**Primary Topics:**
- Daily / Shift production reporting workflow
- Required data sources (MES, approved documents, telemetry)
- Standard report structure
- Metric definitions & calculation rules (Actual output, Good quantity, Rejects, Achievement %, Downtime)
- Exception handling and escalation
- Operations Agent behaviour rules
- Security, audit, and document control
- Pre-release checklist for each site

**Keywords for Retrieval:**  
`production report`, `shift summary`, `daily report`, `throughput`, `downtime`, `rejects`, `achievement percentage`, `planned vs actual`, `shift handover`, `data quality`, `MES production orders`, `exception escalation`, `report structure`

**When to use this document:**
- User asks for production summary, shift report, or daily performance
- Questions about how to calculate KPIs or achievement %
- How the agent should handle missing data or targets
- Shift handover content and open actions

---

### 2. SOP-OPS-002 — Work Order and Work-Step Compliance Verification

| Field | Value |
|-------|-------|
| **File** | [SOP-OPS-002_Work_Order_and_Work_Step_Compliance_Verification.md](./SOP-OPS-002_Work_Order_and_Work_Step_Compliance_Verification.md) |
| **Document ID** | SOP-OPS-002 |
| **Version** | 1.0 — Draft template |
| **Process Owner** | Operations / Quality Manager |
| **Primary Use** | Verify work orders and work-steps against approved SOPs / work instructions |
| **Pages** | 4 |

**Primary Topics:**
- Work order & work-step compliance verification procedure
- Terms and definitions (Work order, Work step, Evidence, Potential deviation)
- Verification steps (sequence, status, timestamps, required evidence)
- Decision rules / Result labels (Evidence present, Evidence missing, Record conflict, Unable to verify, Potential deviation)
- Alert and escalation rules
- Required output format for compliance reviews
- Operations Agent guardrails for compliance questions

**Keywords for Retrieval:**  
`work order`, `work step`, `compliance`, `verification`, `SOP compliance`, `missing step`, `out of sequence`, `sign-off`, `evidence missing`, `potential deviation`, `unable to verify`, `record conflict`, `quality hold`, `step status`

**When to use this document:**
- User asks whether a work order is compliant
- Questions about missing steps, skipped operations, or incomplete sign-offs
- How to check sequence, timestamps, or required evidence
- Compliance review or audit summary requests

---

## Quick Routing Guide for the Agent

| User Intent | Recommended Document | Priority |
|-------------|-----------------------|----------|
| Production / Shift report, KPIs, throughput, downtime summary | SOP-OPS-001 | High |
| How to calculate achievement %, rejects, good quantity | SOP-OPS-001 | High |
| Shift handover content | SOP-OPS-001 | High |
| Work order compliance / verification | SOP-OPS-002 | High |
| Missing work step / out-of-sequence / sign-off check | SOP-OPS-002 | High |
| Potential deviation or “is this compliant?” | SOP-OPS-002 | High |
| Data quality / missing MES records in a report | SOP-OPS-001 | Medium |
| Escalation of safety or quality issue | Both (cite relevant section) | High |

---

## Related Documents (Future)
These documents are referenced but not yet loaded:
- SOP-OPS-003: Machine / Line Downtime Recording and Escalation
- SOP-OPS-004: Quality Defect, Reject, and Hold Handling
- SOP-OPS-005: Shift Handover and Open-Action Tracking
- SOP-OPS-006: MES Data Definitions and Production KPI Calculation Rules
- SOP-OPS-007: Equipment Manuals and Approved Troubleshooting Reference

---

## Agent Retrieval Rules
1. Always cite **Document ID + Section number** when giving procedural guidance.
2. Never invent limits, targets, owners, or deadlines that are not present in the retrieved document or MES data.
3. If evidence is insufficient → reply **“Unable to verify”** (as defined in SOP-OPS-002).
4. Prefer the most specific document. Use SOP-OPS-001 for reporting, SOP-OPS-002 for compliance checks.
5. When both apply, clearly separate “Reporting guidance” vs “Compliance verification guidance”.

---

*End of Knowledge Base Index*
