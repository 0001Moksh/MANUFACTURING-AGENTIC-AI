import json

path = r"c:\Users\renuk\OneDrive\Desktop\MANUFACTURING AGENTIC AI\Manufacturing-Agentic-Ai-iiiot\jupyter notebooks\readonly_agent_report.ipynb"
with open(path, "r", encoding="utf-8") as f:
    nb = json.load(f)

for cell in nb.get("cells", []):
    if cell.get("cell_type") == "code":
        new_source = []
        for line in cell.get("source", []):
            if "Database Schema:" in line:
                # Add hint to the prompt
                new_source.append(line)
                new_source.append("CRITICAL JOIN RULE: WorkOrder.WorkOrderId is an NVARCHAR (e.g. 'WIP00001'). FinishedGood.RequestId, Rejected.RequestId, and Scrap.RequestId are INTs. DO NOT join on WorkOrderId = RequestId. Instead, join using WorkOrder.WorkOrderNumber = RequestId OR cast them if necessary.\\n\n")
                continue
            new_source.append(line)
        cell["source"] = new_source

with open(path, "w", encoding="utf-8") as f:
    json.dump(nb, f, indent=1)
print("Updated notebook prompt with SQL join hint!")
