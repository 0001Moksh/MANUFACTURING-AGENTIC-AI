import json

path = r"c:\Users\renuk\OneDrive\Desktop\MANUFACTURING AGENTIC AI\Manufacturing-Agentic-Ai-iiiot\jupyter notebooks\readonly_agent_report.ipynb"
with open(path, "r", encoding="utf-8") as f:
    nb = json.load(f)

# ── Change 1: Replace MES_CATALOG in Cell 2 (index 1) ──
NEW_MES_CATALOG = r'''# Static Database Catalog Configuration (MES Database System Metadata)
MES_CATALOG = {
    "WorkOrder": ["WorkOrderId","WorkOrderNumber","ProductId","PlannedQty","CompletedQty","Status","MachineId","OperatorId","ShiftId","PlannedStart","PlannedEnd","ActualStart","ActualEnd","PlannedDurationHours","ActualDurationHours","ProgressPercent","DueDate","PriorityId","CustomerId","CreatedDate"],
    "MachineMaster": ["MachineId","MachineCode","MachineName","MachineType","Location","CapacityPerHour","AvailableHoursPerDay","EfficiencyPercent","Status","IsActive","Capacity","MinCapacity","MaxCapacity","Utilization","WorkCenter","Shift"],
    "Machine": ["MachineId","MachineName","MachineCode","MachineType","Status","Capacity"],
    "OperatorMaster": ["OperatorId","OperatorCode","OperatorName","Department","Skill","ShiftId","IsActive","Role","Shift","Skills","Status","Utilization","WorkCenter"],
    "ShiftMaster": ["ShiftId","ShiftCode","ShiftName","StartTime","EndTime","BreakMinutes","IsActive","OperatorCount","Status","WorkCenterCode"],
    "ProductionPlanning": ["Id","RequestId","MachineId","FGQuantity","FGCode","FGName","RMCode","RMName","RMQuantity","Color","PackagingType","Date","InputQuantity","InputDate","Status","MachineCode"],
    "ProductMaster": ["ProductId","ProductCode","ProductName","ProductType","UOM","StandardCost","LeadTimeDays","SafetyStock","IsActive"],
    "Inventory": ["Id","MaterialCode","Category","BlockedQuantity","QuantityInStock","StockUpdatedReason"],
    "FinishedGood": ["FGId","RequestId","MaterialCode","MaterialName","Quantity","FGQuantity","NumberOfBags","Status","IsHold","Color","IsDispatch","IsActive"],
    "Scrap": ["Id","RequestId","MaterialCode","MaterialName","Quantity","ScrapQuantity","UOM","Status","OutputDate"],
    "Rejected": ["Id","RequestId","MaterialCode","MaterialName","Quantity","RejectedQuantity","UOM","Status","OutputDate","ReasonForRepackaging"],
    "WeighingMachine": ["Id","FGQuantity","SFGQuantity","RejectedQuantity","ScrapQuantity","OnlineHoldQuantity","MachineCode","ShiftName","ShiftStartTime","ShiftEndTime"],
    "CapacityAnalysis": ["CapacityId","MachineId","Date","ShiftId","AvailableHours","PlannedHours","ActualHours","UtilizationPercent","OverloadFlag"],
    "AlertMaster": ["AlertId","AlertType","Severity","Title","Message","Source","IsAcknowledged","IsResolved","CreatedDate"],
    "MaintenanceWindow": ["MaintenanceId","MachineId","MaintenanceType","StartDate","EndDate","Description","Status","DurationHours"],
}
'''

cell2 = nb["cells"][1]  # Cell 2 (0-indexed = 1)
source = "".join(cell2["source"])

# Find and replace the MES_CATALOG block
start_marker = "# Static Database Catalog Configuration (MES Database System Metadata)"
end_marker = "}\n\n# Standard mock runtime"  # just after the closing brace

start_idx = source.find(start_marker)
end_idx = source.find(end_marker)

if start_idx != -1 and end_idx != -1:
    # Replace the catalog block (keep the end marker's newlines after })
    new_source = source[:start_idx] + NEW_MES_CATALOG + "\n# Standard mock runtime" + source[end_idx + len(end_marker):]
    # Split back into lines for notebook format
    lines = []
    for line in new_source.split("\n"):
        lines.append(line + "\n")
    # Remove trailing newline from last line
    if lines and lines[-1] == "\n":
        lines = lines[:-1]
    cell2["source"] = lines
    print("[OK] MES_CATALOG updated in Cell 2")
else:
    print(f"[WARN] Could not find MES_CATALOG markers. start={start_idx}, end={end_idx}")

# ── Change 2: Fix SQL generation node in Cell 3 (index 2) ──
cell3 = nb["cells"][2]  # Cell 3 (0-indexed = 2)
new_source3 = []
for line in cell3["source"]:
    if "Write an ANSI SQL query for SQLite" in line:
        line = line.replace(
            "Write an ANSI SQL query for SQLite based on schema: {schema}. Read-only SELECT statements only.",
            "Write a T-SQL SELECT query for Microsoft SQL Server based on schema: {schema}. Use square brackets for table and column names. Read-only SELECT only. Do NOT use LIMIT, use TOP instead."
        )
        print("[OK] SQL generation prompt fixed in Cell 3")
    new_source3.append(line)
cell3["source"] = new_source3

# ── Save ──
with open(path, "w", encoding="utf-8") as f:
    json.dump(nb, f, indent=1)
print("\n[DONE] Notebook updated successfully!")
