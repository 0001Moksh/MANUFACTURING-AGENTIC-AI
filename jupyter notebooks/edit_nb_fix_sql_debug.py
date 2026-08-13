import json

path = r"c:\Users\renuk\OneDrive\Desktop\MANUFACTURING AGENTIC AI\Manufacturing-Agentic-Ai-iiiot\jupyter notebooks\readonly_agent_report.ipynb"
with open(path, "r", encoding="utf-8") as f:
    nb = json.load(f)

# ── Fix 1: Add SQL query printing in sql_generation_node (Cell 3, index 2) ──
cell3 = nb["cells"][2]
new_source3 = []
for line in cell3["source"]:
    new_source3.append(line)
    # After the line that assigns the query, add a print statement
    if "query = resp.choices[0].message.content" in line and "replace" in line:
        new_source3.append('    print(f"   [Generated SQL] {query[:500]}")\n')
        print("[OK] Added SQL query printing in Cell 3")
cell3["source"] = new_source3

# ── Fix 2: Make the prompt more specific for single-table queries in Cell 6 (index 6) ──
# The issue is the LLM tries to JOIN tables that don't share keys and gets 0 rows
# We need to tell it to query ONE table at a time, using UNION ALL or separate queries
cell3_src = "".join(cell3["source"])
old_sys = "Write a T-SQL SELECT query for Microsoft SQL Server based on schema: {schema}. Use square brackets for table and column names. Read-only SELECT only. Do NOT use LIMIT, use TOP instead."
new_sys = "Write a T-SQL SELECT query for Microsoft SQL Server based on schema: {schema}. Use square brackets [table].[column] syntax. Read-only SELECT only. Use TOP instead of LIMIT. IMPORTANT: Query ONLY ONE table at a time - do NOT attempt JOINs across tables unless the user explicitly requests it. If the user asks for data from multiple tables, pick the MOST relevant single table and query it."

if old_sys in cell3_src:
    cell3_src = cell3_src.replace(old_sys, new_sys)
    # Split back into lines
    lines = []
    for line in cell3_src.split("\n"):
        lines.append(line + "\n")
    if lines and lines[-1] == "\n":
        lines = lines[:-1]
    cell3["source"] = lines
    print("[OK] Updated SQL generation prompt to avoid bad JOINs")
else:
    print("[WARN] Could not find SQL generation prompt to update")

# ── Save ──
with open(path, "w", encoding="utf-8") as f:
    json.dump(nb, f, indent=1)
print("\n[DONE] Notebook updated with debugging and anti-JOIN fix!")
