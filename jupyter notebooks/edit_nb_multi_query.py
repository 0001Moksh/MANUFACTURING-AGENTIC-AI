import json

path = r"c:\Users\renuk\OneDrive\Desktop\MANUFACTURING AGENTIC AI\Manufacturing-Agentic-Ai-iiiot\jupyter notebooks\readonly_agent_report.ipynb"
with open(path, "r", encoding="utf-8") as f:
    nb = json.load(f)

def code_to_nb_source(code_str):
    """Convert a Python code string to notebook source format (list of lines)."""
    lines = code_str.split("\n")
    result = []
    for i, line in enumerate(lines):
        if i < len(lines) - 1:
            result.append(line + "\n")
        else:
            if line:
                result.append(line)
    return result

# ═══════════════════════════════════════════════════════════════
# CELL 3 (index 2): intent_understanding + schema + sql_generation
# ═══════════════════════════════════════════════════════════════
new_cell3 = r'''# Cell 2: Phase 1 Nodes Implementation
def intent_understanding_node(state: AgentState) -> dict:
    print("-> [Node 1] parsing user request intent...")
    prompt = state["prompt"]
    
    sys_prompt = "Analyze the factory metrics query. Return JSON keys: 'report_type', 'metrics', 'filters'."
    resp = completion(model="gemini/gemini-3.5-flash-lite", messages=[{"role": "system", "content": sys_prompt}, {"role": "user", "content": prompt}])
    try:
        out = json.loads(resp.choices[0].message.content.replace("```json", "").replace("```", "").strip())
    except:
        out = {"report_type": "Production Summary", "metrics": ["Qty"], "filters": {}}
        
    return {"intent_output": out}

def schema_context_retrieval_node(state: AgentState) -> dict:
    print("-> [Node 2] Fetching allowed relational schema metadata...")
    return {"schema_context": {"tables": list(MES_CATALOG.keys()), "columns": MES_CATALOG}}

def sql_generation_node(state: AgentState) -> dict:
    print("-> [Node 3] Generating read-only SQL string...")
    intent = state["intent_output"]
    schema = state["schema_context"]
    err = state.get("error", "")
    
    sys_prompt = f"""You are a SQL query generator for Microsoft SQL Server.
Based on this database schema: {schema}

Generate T-SQL SELECT queries to extract ALL relevant data for the user's request.
RULES:
- Generate SEPARATE queries for EACH table that is relevant to the request
- Use square brackets for [TableName].[ColumnName]
- Use TOP 100 to limit results
- Read-only SELECT only
- Separate each query with exactly: ;;;
- Add a comment line before each query: -- TABLE: TableName
- Do NOT use JOINs between tables
- Generate queries for as MANY relevant tables as possible to cover all aspects of the report

Example format:
-- TABLE: WorkOrder
SELECT TOP 100 [WorkOrderId], [Status], [PlannedQty], [CompletedQty] FROM [WorkOrder]
;;;
-- TABLE: CapacityAnalysis
SELECT TOP 100 [MachineId], [UtilizationPercent] FROM [CapacityAnalysis]"""
    
    user_msg = f"Intent: {intent}."
    if err:
        user_msg += f" Fix this error from your last attempt: {err}"
        
    resp = completion(model="gemini/gemini-3.5-flash-lite", messages=[{"role": "system", "content": sys_prompt}, {"role": "user", "content": user_msg}])
    query = resp.choices[0].message.content.replace("```sql", "").replace("```", "").strip()
    print(f"   [Generated SQL]\n{query[:1200]}")
    
    # Security Block
    if any(hack in query.upper() for hack in ["DROP", "DELETE", "UPDATE", "INSERT", "ALTER"]):
        return {"sql_query": "", "error": "Security Exception: Non-SELECT clause detected."}
        
    return {"sql_query": query, "error": None}'''

# ═══════════════════════════════════════════════════════════════
# CELL 4 (index 3): sql_execution + profiling + insights
# ═══════════════════════════════════════════════════════════════
new_cell4 = r'''from IPython.core import getipython
# Cell 3: Phase 2 Nodes Implementation — Multi-Table Query Pipeline
def sql_execution_node(state: AgentState) -> dict:
    print("-> [Node 4] Executing validated query inside target data source...")
    query_text = state["sql_query"]
    current_retry = state.get("retry_count", 0)
    
    # Split multiple queries by ;;;
    queries = [q.strip() for q in query_text.split(";;;") if q.strip()]
    
    all_results = []
    total_rows = 0
    
    for i, query in enumerate(queries):
        # Extract table name from -- TABLE: comment
        table_name = f"Query_{i+1}"
        for line in query.split("\n"):
            if line.strip().startswith("-- TABLE:"):
                table_name = line.strip().replace("-- TABLE:", "").strip()
                break
        
        # Remove comment lines for execution
        exec_query = "\n".join(l for l in query.split("\n") if not l.strip().startswith("--"))
        exec_query = exec_query.strip()
        if not exec_query:
            continue
        
        try:
            df = pd.read_sql_query(exec_query, engine)
            rows = len(df)
            total_rows += rows
            all_results.append({"table": table_name, "df": df, "rows": rows})
            print(f"   [SQL {i+1}: {table_name}] {rows} records.")
        except Exception as e:
            print(f"   [SQL {i+1}: {table_name}] Failed: {e}")
    
    if all_results:
        print(f"   [SQL Total] {total_rows} records from {len(all_results)} tables.")
        return {"full_df": all_results, "query_results": {"row_count": total_rows, "status": "Success"}, "error": None}
    else:
        return {"error": "All queries failed", "retry_count": current_retry + 1}

def data_profiling_aggregation_node(state: AgentState) -> dict:
    print("-> [Node 5] Executing profiling rules and cleaning values...")
    results = state.get("full_df")
    
    if results is None:
        return {"processed_data": {"cleaned_summary": "{}", "row_count": 0}}
    
    # Handle multi-table results (list of dicts with 'table' and 'df')
    if isinstance(results, list):
        sections = []
        total_rows = 0
        for item in results:
            table_name = item.get("table", "Unknown")
            df = item.get("df")
            if df is not None and not df.empty:
                csv_str = df.head(100).to_csv(index=False)
                sections.append(f"=== TABLE: {table_name} ({len(df)} rows) ===\n{csv_str}")
                total_rows += len(df)
        combined = "\n\n".join(sections) if sections else "{}"
        return {"processed_data": {"cleaned_summary": combined, "row_count": total_rows}}
    
    # Handle single DataFrame (backward compatibility)
    if isinstance(results, pd.DataFrame) and not results.empty:
        return {"processed_data": {"cleaned_summary": results.head(100).to_csv(index=False), "row_count": len(results)}}
    
    return {"processed_data": {"cleaned_summary": "{}", "row_count": 0}}

def analysis_insights_node(state: AgentState) -> dict:
    print("-> [Node 6] Generating detailed JSON for PDF report...")
    proc = state.get("processed_data") or {}
    raw_data = proc.get("cleaned_summary", "")
    prompt = state.get("prompt", "")
    
    sys_prompt = """You are a manufacturing data analyst.
You are given REAL production data from multiple database tables, each labeled with === TABLE: TableName ===.

Based on this REAL data, provide a detailed JSON response for a PDF report.
The JSON MUST follow this exact format with all keys present:
{
  "executive_summary": "3-4 sentence summary using ONLY real numbers from the data provided.",
  "production_analysis": "Analysis of actual work order records from the data.",
  "production_table": [
    {"day": "Work Order or Label", "target": 1000, "actual": 1000, "status": "On Track"}
  ],
  "oee_overview": "Analysis of machine utilization from CapacityAnalysis data.",
  "oee_table": [
    {"line": "Machine ID or Name", "oee": 85.0, "status": "Optimal"}
  ],
  "shift_analysis": "Analysis of shift-wise production from WeighingMachine data.",
  "shift_table": [
    {"shift": "Shift Name", "output": 4700, "rejections": 50, "defect_rate": "1.1%"}
  ],
  "scrap_drivers": "Analysis of scrap causes from Scrap table data.",
  "scrap_distribution": [
    {"cause": "Material or Category", "percentage": 42.0}
  ],
  "corrective_actions": [
    {"action": "Specific action based on real findings", "target": "Area", "owner": "Department", "deadline": "Date"}
  ]
}

CRITICAL RULES:
- Use ONLY the actual numbers from the provided data. Do NOT fabricate, simulate, or extrapolate ANY values.
- For production_table: Map WorkOrder PlannedQty as target, CompletedQty as actual. Use WorkOrderNumber as the day/label.
- For oee_table: Use CapacityAnalysis UtilizationPercent as OEE. Use MachineId as line name. If no CapacityAnalysis data exists, use empty array [].
- For shift_table: Use WeighingMachine data. Sum FGQuantity as output, RejectedQuantity as rejections per ShiftName. Calculate defect_rate from real numbers. If no WeighingMachine data, use [].
- For scrap_distribution: Calculate percentage from actual Scrap quantities. If no Scrap data, use [].
- Mark status as 'Optimal' if utilization >= 85%, 'On Track' if actual >= target, 'Below Target' otherwise.
- corrective_actions should be based on real issues found in the data.
Return ONLY valid JSON without markdown formatting blocks."""
    
    user_content = f"User Request: {prompt}\n\nReal Database Data:\n{raw_data}"
    resp = completion(
        model="gemini/gemini-3.5-flash-lite", 
        messages=[{"role": "system", "content": sys_prompt}, {"role": "user", "content": user_content}]
    )
    
    clean_text = resp.choices[0].message.content.replace("```json", "").replace("```", "").strip()
    try:
        out = json.loads(clean_text)
    except:
        out = {}
        
    return {"insights_output": out}'''

# ═══════════════════════════════════════════════════════════════
# APPLY CHANGES
# ═══════════════════════════════════════════════════════════════
nb["cells"][2]["source"] = code_to_nb_source(new_cell3)
print(f"[OK] Cell 3 updated ({len(nb['cells'][2]['source'])} lines)")

nb["cells"][3]["source"] = code_to_nb_source(new_cell4)
print(f"[OK] Cell 4 updated ({len(nb['cells'][3]['source'])} lines)")

# Save
with open(path, "w", encoding="utf-8") as f:
    json.dump(nb, f, indent=1)

print("\n[DONE] Multi-query pipeline implemented!")
print("  - sql_generation_node: generates ;;; separated queries per table")
print("  - sql_execution_node: executes each query, collects per-table results")
print("  - data_profiling_node: outputs labeled multi-table CSV sections")
print("  - analysis_insights_node: uses ONLY real data, no simulation")
