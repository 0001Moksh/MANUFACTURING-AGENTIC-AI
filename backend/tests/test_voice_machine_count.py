from app.agents import maintenance_agent
from app.voice_agent_graph import _heuristic_decision


def test_hindi_machine_question_routes_to_maintenance():
    decision = _heuristic_decision("मशीनस कितनी है अपने पास", ["maintenance", "general"])

    assert decision["plan"] == [
        {"agent": "maintenance", "task": "मशीनस कितनी है अपने पास"}
    ]


def test_machine_count_queries_total_and_active_machines(monkeypatch):
    captured = {}

    def fake_execute_query(query, params=None):
        captured["query"] = query
        captured["params"] = params
        return '[{"TotalMachineCount":20,"ActiveMachineCount":17}]'

    monkeypatch.setattr(maintenance_agent, "_execute_query", fake_execute_query)

    result = maintenance_agent.get_machine_count.invoke({})

    assert "COUNT(*) AS TotalMachineCount" in captured["query"]
    assert "SUM(CASE WHEN IsActive = 1 THEN 1 ELSE 0 END)" in captured["query"]
    assert "FROM dbo.MachineMaster" in captured["query"]
    assert "WHERE IsActive = 1" not in captured["query"]
    assert captured["params"] is None
    assert result == '[{"TotalMachineCount":20,"ActiveMachineCount":17}]'
