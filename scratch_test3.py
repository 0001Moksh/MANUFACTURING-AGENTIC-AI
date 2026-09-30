import os
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

# Define output path
out = "SOP-OPS-003_Machine_Line_Downtime_Recording_and_Escalation.pdf"

# Initialize styles
styles = getSampleStyleSheet()

styles.add(
    ParagraphStyle(
        name="DocTitleX",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#17365D"),
        spaceAfter=8,
    )
)
styles.add(
    ParagraphStyle(
        name="SubX",
        parent=styles["Normal"],
        fontSize=9,
        leading=12,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#526579"),
        spaceAfter=12,
    )
)
styles.add(
    ParagraphStyle(
        name="H1X",
        parent=styles["Heading1"],
        fontSize=12,
        leading=15,
        textColor=colors.HexColor("#17365D"),
        spaceBefore=9,
        spaceAfter=4,
    )
)
styles.add(
    ParagraphStyle(
        name="H2X",
        parent=styles["Heading2"],
        fontSize=10,
        leading=12,
        textColor=colors.HexColor("#24527A"),
        spaceBefore=6,
        spaceAfter=3,
    )
)
styles.add(
    ParagraphStyle(
        name="BodyX",
        parent=styles["BodyText"],
        fontSize=8.7,
        leading=11.5,
        spaceAfter=4,
    )
)
styles.add(
    ParagraphStyle(
        name="CellX", parent=styles["BodyText"], fontSize=7.7, leading=9.5
    )
)
styles.add(
    ParagraphStyle(
        name="HeadCellX",
        parent=styles["BodyText"],
        fontName="Helvetica-Bold",
        fontSize=7.7,
        leading=9.5,
        textColor=colors.white,
    )
)
styles.add(
    ParagraphStyle(
        name="SmallX",
        parent=styles["BodyText"],
        fontSize=7.5,
        leading=9,
        textColor=colors.HexColor("#526579"),
    )
)


def P(text, style="BodyX"):
  return Paragraph(text, styles[style])


def make_table(rows, widths, header=True):
  data = []
  for ri, row in enumerate(rows):
    sty = "HeadCellX" if header and ri == 0 else "CellX"
    data.append([P(str(v), sty) for v in row])
  t = Table(
      data, colWidths=widths, repeatRows=1 if header else 0, hAlign="LEFT"
  )
  cmds = [
      ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
      ("VALIGN", (0, 0), (-1, -1), "TOP"),
      ("LEFTPADDING", (0, 0), (-1, -1), 5),
      ("RIGHTPADDING", (0, 0), (-1, -1), 5),
      ("TOPPADDING", (0, 0), (-1, -1), 4),
      ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
  ]
  if header:
    cmds.append(("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#17365D")))
    if len(rows) > 1:
      cmds.append((
          "ROWBACKGROUNDS",
          (0, 1),
          (-1, -1),
          [colors.white, colors.HexColor("#F7F9FC")],
      ))
  t.setStyle(TableStyle(cmds))
  return t


# Build PDF Story
story = [
    P("STANDARD OPERATING PROCEDURE", "SubX"),
    P("Machine / Line Downtime Recording and Escalation", "DocTitleX"),
    P(
        "Operations Agent Knowledge Base • Draft template for plant-specific"
        " review",
        "SubX",
    ),
    make_table(
        [
            ["Document ID", "Version", "Process owner", "Effective date"],
            [
                "SOP-OPS-003",
                "1.0 (Draft)",
                "Production / Operations (confirm locally)",
                "After approval",
            ],
        ],
        [30 * mm, 27 * mm, 62 * mm, 48 * mm],
    ),
    Spacer(1, 8),
    P("Important document status", "H1X"),
    P(
        "<b>This is a draft template, not an approved plant instruction.</b>"
        " Before operational use, confirm the plant's downtime definitions,"
        " MES fields and event codes, role ownership, escalation contacts,"
        " communication channels, response-time targets, safety procedures,"
        " and approval requirements. Do not infer missing site rules or"
        " thresholds."
    ),
    P("1. Purpose", "H1X"),
    P(
        "Provide a consistent method to detect, record, classify, review, and"
        " escalate machine or production-line downtime. The Operations Agent"
        " supports record review and summarization; it does not replace"
        " operator judgment, maintenance procedures, or safety controls."
    ),
    P("2. Scope", "H1X"),
    P(
        "Applies to downtime events represented in the site's MES or approved"
        " operations records, including planned stops, unplanned stops,"
        " changeovers, material shortages, quality-related stops, equipment"
        " faults, and events with an unknown cause. Use only categories"
        " configured and approved by the plant."
    ),
    P("3. Roles and responsibilities", "H1X"),
    make_table(
        [
            ["Role", "Responsibility"],
            [
                "Operator / line team",
                (
                    "Follow local safety procedures; report the stop and"
                    " provide accurate event details; record restart only as"
                    " permitted by site procedure."
                ),
            ],
            [
                "Shift supervisor",
                (
                    "Review event completeness and classification, coordinate"
                    " escalation using approved rules, and confirm shift-handover"
                    " notes."
                ),
            ],
            [
                "Maintenance / technical support",
                (
                    "Investigate equipment-related events and record findings"
                    " and actions in the approved system."
                ),
            ],
            [
                "Production / operations manager",
                (
                    "Review significant or recurring downtime, assign"
                    " follow-up actions, and approve local workflow changes."
                ),
            ],
            [
                "Operations Agent",
                (
                    "Retrieve records, flag missing/conflicting fields,"
                    " summarize events, and cite sources. Never fabricate"
                    " causes or status."
                ),
            ],
        ],
        [39 * mm, 128 * mm],
    ),
    P("4. Required downtime record fields", "H1X"),
    make_table(
        [
            ["Field", "Recording guidance"],
            [
                "Event identifier",
                "Use the unique MES event ID or approved reference. Do not"
                " invent an ID.",
            ],
            [
                "Machine / line",
                "Use the plant's canonical asset or line identifier.",
            ],
            [
                "Start timestamp",
                (
                    "Use the source timestamp and time zone; preserve source"
                    " precision."
                ),
            ],
            [
                "End / restart timestamp",
                (
                    "Record only when confirmed. Mark an event ongoing only"
                    " when supported by the source."
                ),
            ],
            [
                "Duration",
                (
                    "Prefer the MES-calculated duration. Otherwise calculate"
                    " only from valid start/end timestamps and label it as"
                    " calculated."
                ),
            ],
            [
                "Downtime category / code",
                (
                    "Use approved site codes. If unavailable, mark"
                    " unclassified/not recorded according to local"
                    " configuration."
                ),
            ],
            [
                "Symptom and cause",
                (
                    "Separate observed facts, suspected causes, and confirmed"
                    " causes."
                ),
            ],
            [
                "Impact",
                (
                    "Include affected output, quality, or schedule only when"
                    " supported by source data."
                ),
            ],
            [
                "Action, owner, status",
                (
                    "Use approved event/work-order records; do not infer an"
                    " owner or completion status."
                ),
            ],
            [
                "Evidence / references",
                (
                    "Link the source event, work order, maintenance record, or"
                    " approved note."
                ),
            ],
        ],
        [42 * mm, 125 * mm],
    ),
    P("5. Procedure", "H1X"),
]

steps = [
    (
        "5.1 Detect and confirm",
        (
            "Use the approved MES downtime event, line status, or operator"
            " report. Determine planned/unplanned status only using site"
            " definitions. Preserve and flag disagreements between sources."
        ),
    ),
    (
        "5.2 Create or update the record",
        (
            "Search for an existing event before creating a new one to reduce"
            " duplicates. Enter required fields in the designated system."
        ),
    ),
    (
        "5.3 Validate timestamps and duration",
        (
            "Check for missing timestamps, inconsistent time zones,"
            " end-before-start, negative duration, overlapping events, and"
            " conflicts. Flag anomalies instead of silently correcting them."
        ),
    ),
    (
        "5.4 Classify the event",
        (
            "Select an approved category supported by evidence. Keep symptom,"
            " suspected cause, confirmed cause, and corrective action distinct."
        ),
    ),
    (
        "5.5 Notify and escalate",
        (
            "Follow the approved site escalation matrix. Safety hazards must be"
            " handled immediately through the established emergency/safety"
            " process; never wait for agent analysis."
        ),
    ),
    (
        "5.6 Investigate and document",
        (
            "The responsible team records findings, work-order references,"
            " corrective actions, owner, and status in the approved system. The"
            " agent may summarize but must not invent a diagnosis."
        ),
    ),
    (
        "5.7 Confirm restart and closure",
        (
            "Record restart or closure only when confirmed by an authorized"
            " source or role. Keep unresolved events open/pending according to"
            " local workflow."
        ),
    ),
    (
        "5.8 Shift handover",
        (
            "Include ongoing event, start time, known symptom, confirmed"
            " actions, pending owner/next step if recorded, and source"
            " reference. Mark unknown information clearly."
        ),
    ),
    (
        "5.9 Review recurring events",
        (
            "Use approved reporting windows and categories to identify repeat"
            " stops or high cumulative duration. Patterns are prompts for"
            " investigation, not proof of root cause."
        ),
    ),
]

for h, body in steps:
  story.extend([P(h, "H2X"), P(body)])

story.extend([
    P("6. Escalation rules", "H1X"),
    P(
        "The following is a configuration checklist, not a substitute for local"
        " response-time commitments or emergency procedures."
    ),
    make_table(
        [
            ["Condition", "Required handling"],
            [
                "Safety hazard, injury, or unsafe condition",
                (
                    "Follow the established site emergency and safety reporting"
                    " process immediately."
                ),
            ],
            [
                "Production stop requiring technical support",
                (
                    "Notify the designated supervisor/maintenance contact"
                    " according to the approved matrix."
                ),
            ],
            [
                "Missing, conflicting, or implausible event data",
                (
                    "Flag for human review; retain source values and explain"
                    " the discrepancy."
                ),
            ],
            [
                "Long-duration or repeated downtime",
                (
                    "Apply only site-defined duration/frequency thresholds. If"
                    " none are configured, do not invent one; refer to the"
                    " supervisor."
                ),
            ],
            [
                "Cause unknown or action unresolved",
                (
                    "Keep cause/status unknown or pending; identify an owner"
                    " only if recorded."
                ),
            ],
        ],
        [56 * mm, 111 * mm],
    ),
    P("7. Operations Agent behavior and guardrails", "H1X"),
])

guardrails = [
    (
        "Cite the source system, event/record ID, timestamp, and relevant"
        " field or document section where available."
    ),
    (
        "Distinguish observed facts, recorded causes, suspected causes, and"
        " agent-generated hypotheses."
    ),
    (
        "Do not create or alter MES records, close work orders, change machine"
        " settings, or issue control commands unless a separately approved"
        " integration explicitly authorizes that action."
    ),
    (
        "Never infer that a machine is safe to restart; follow local safety and"
        " restart procedures."
    ),
    (
        "Do not fabricate thresholds, event codes, contacts, duration,"
        " production loss, ownership, or resolution status."
    ),
    (
        "If evidence is missing or contradictory, say: <b>“Unable to verify"
        " from available records”</b> and explain what needs review."
    ),
    (
        "Restrict output to the user's authorized plant, line, asset, and"
        " record scope."
    ),
]

for item in guardrails:
  story.append(P("• " + item))

story.extend([
    P("8. Suggested downtime summary format", "H1X"),
    make_table(
        [
            ["Item", "Expected content"],
            ["Reporting window", "Start/end date-time and time zone."],
            ["Scope", "Plant, line, machine, and shift."],
            [
                "Downtime events",
                "Count of source-backed events and their IDs/links.",
            ],
            [
                "Total downtime",
                (
                    "Value and source/calculation method; identify incomplete"
                    " events separately."
                ),
            ],
            [
                "Categories",
                "Counts/duration by approved code, with source references.",
            ],
            [
                "Ongoing events",
                (
                    "Machine, start time, known symptom, status, and recorded"
                    " owner/next action."
                ),
            ],
            [
                "Data-quality notes",
                (
                    "Missing timestamps, duplicates, overlaps, conflicts, and"
                    " unclassified events."
                ),
            ],
            [
                "Follow-up",
                (
                    "Open actions, responsible role, and due date only where"
                    " recorded."
                ),
            ],
        ],
        [42 * mm, 125 * mm],
    ),
    P("9. Site-specific approval checklist", "H1X"),
])

checklist = [
    (
        "Confirm scope, official downtime definitions, and planned/unplanned"
        " rules."
    ),
    (
        "Map required fields to actual MES tables, columns, event codes, and"
        " timestamp conventions."
    ),
    "Approve duration calculation and duplicate-event handling rules.",
    "Add roles, escalation contacts, channels, and response-time targets.",
    "Define thresholds for prolonged/repeated downtime and the approving owner.",
    "Link the approved safety and restart procedures.",
    "Validate access control, audit trail, retention, and privacy requirements.",
    (
        "Test: ongoing event, missing end time, duplicate, conflicting cause,"
        " invalid duration, and recurring downtime."
    ),
    "Obtain process-owner and document-control approval before operational release.",
]

for item in checklist:
  story.append(P("☐ " + item))

story.extend([
    P("10. Revision and approval record", "H1X"),
    make_table(
        [
            [
                "Version",
                "Date",
                "Change summary",
                "Prepared / reviewed / approved by",
            ],
            [
                "1.0 Draft",
                "2026-09-30",
                "Initial template for Operations Agent knowledge base.",
                "Complete locally",
            ],
        ],
        [22 * mm, 26 * mm, 68 * mm, 51 * mm],
    ),
    Spacer(1, 8),
    P(
        "End of SOP-OPS-003 • Draft template • Use only after site-specific"
        " validation and approval.",
        "SmallX",
    ),
])


def footer(canvas, doc):
  canvas.saveState()
  w, h = A4
  canvas.setStrokeColor(colors.HexColor("#D7E0EA"))
  canvas.line(18 * mm, 13 * mm, w - 18 * mm, 13 * mm)
  canvas.setFont("Helvetica", 7)
  canvas.setFillColor(colors.HexColor("#64748B"))
  canvas.drawString(
      18 * mm, 8 * mm, "SOP-OPS-003 | Machine / Line Downtime | Draft"
  )
  canvas.drawRightString(w - 18 * mm, 8 * mm, f"Page {doc.page}")
  canvas.restoreState()


pdf = SimpleDocTemplate(
    out,
    pagesize=A4,
    rightMargin=18 * mm,
    leftMargin=18 * mm,
    topMargin=16 * mm,
    bottomMargin=18 * mm,
    title=(
        "SOP-OPS-003 Machine / Line Downtime Recording and Escalation"
    ),
)

pdf.build(story, onFirstPage=footer, onLaterPages=footer)

print(f"Created: {out}")
print(
    f"Exists: {os.path.isfile(out)} | Size: {os.path.getsize(out) if os.path.isfile(out) else 0} bytes"
)