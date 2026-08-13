import json

path = r"c:\Users\renuk\OneDrive\Desktop\MANUFACTURING AGENTIC AI\Manufacturing-Agentic-Ai-iiiot\jupyter notebooks\readonly_agent_report.ipynb"
with open(path, "r", encoding="utf-8") as f:
    nb = json.load(f)

for cell in nb.get("cells", []):
    if cell.get("cell_type") == "code":
        new_source = []
        for line in cell.get("source", []):
            if "def track_cost_callback" in line and "async" not in line:
                line = line.replace("def track_cost_callback", "async def track_cost_callback")
            new_source.append(line)
        cell["source"] = new_source

with open(path, "w", encoding="utf-8") as f:
    json.dump(nb, f, indent=1)
print("Updated notebook to use async litellm callback!")
