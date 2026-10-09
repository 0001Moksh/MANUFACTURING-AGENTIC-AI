from app.agents import video_monitoring_agent
from langchain_core.messages import HumanMessage


class FakeTool:
    def __init__(self, result):
        self.result = result
        self.calls = []

    def invoke(self, arguments):
        self.calls.append(arguments)
        return self.result


def test_ml_inference_failure_uses_live_frame_vlm(monkeypatch):
    ml_tool = FakeTool({
        "success": False,
        "data": {"results": [{"error": "Inference failed: CUDA out of memory"}]},
    })
    vlm_tool = FakeTool({"success": True, "data": {"vlm_response": "Three people are visible."}})
    monkeypatch.setattr(video_monitoring_agent, "run_ml_detection", ml_tool)
    monkeypatch.setattr(video_monitoring_agent, "analyze_live_frame_with_vlm", vlm_tool)
    monkeypatch.setattr(video_monitoring_agent, "build_vlm_instruction", lambda *_: "Count visible people.")
    arguments = {"camera_name": "CAM-01 Luxsphere Entrance Gate"}

    result, tool_name, used_arguments = video_monitoring_agent._run_ml_detection_with_vlm_fallback(
        arguments, [], "How many people are visible?", arguments["camera_name"]
    )

    assert result["success"] is True
    assert tool_name == "analyze_live_frame_with_vlm"
    assert used_arguments["user_query"] == "How many people are visible?"
    assert len(ml_tool.calls) == len(vlm_tool.calls) == 1


def test_camera_capture_failure_does_not_use_vlm_fallback(monkeypatch):
    ml_tool = FakeTool({"success": False, "message": "Could not capture a live frame.", "data": None})
    vlm_tool = FakeTool({"success": True, "data": {"vlm_response": "Fallback answer"}})
    monkeypatch.setattr(video_monitoring_agent, "run_ml_detection", ml_tool)
    monkeypatch.setattr(video_monitoring_agent, "analyze_live_frame_with_vlm", vlm_tool)
    arguments = {"camera_name": "CAM-01 Luxsphere Entrance Gate"}

    result, tool_name, _ = video_monitoring_agent._run_ml_detection_with_vlm_fallback(
        arguments, [], "Count people.", arguments["camera_name"]
    )

    assert result["message"] == "Could not capture a live frame."
    assert tool_name == "run_ml_detection"
    assert vlm_tool.calls == []


def test_successful_ml_detection_does_not_use_vlm_fallback(monkeypatch):
    ml_tool = FakeTool({"success": True, "data": {"summary": "One person detected."}})
    vlm_tool = FakeTool({"success": True, "data": {"vlm_response": "Fallback answer"}})
    monkeypatch.setattr(video_monitoring_agent, "run_ml_detection", ml_tool)
    monkeypatch.setattr(video_monitoring_agent, "analyze_live_frame_with_vlm", vlm_tool)
    arguments = {"camera_name": "CAM-01 Luxsphere Entrance Gate"}

    result, tool_name, used_arguments = video_monitoring_agent._run_ml_detection_with_vlm_fallback(
        arguments, [], "Count people.", arguments["camera_name"]
    )

    assert result["success"] is True
    assert tool_name == "run_ml_detection"
    assert used_arguments is arguments
    assert vlm_tool.calls == []


def test_misspelled_people_count_is_normalized_and_skips_agent_llm(monkeypatch):
    captured = {}

    def run_detection(arguments, messages, user_query, camera_name):
        captured["arguments"] = arguments
        captured["query"] = user_query
        captured["camera"] = camera_name
        return (
            {"success": True, "data": {"summary": "Three people detected."}},
            "run_ml_detection",
            arguments,
        )

    class UnavailableLLM:
        def bind_tools(self, _tools):
            raise AssertionError("A direct count query should not call the agent LLM")

    monkeypatch.setattr(video_monitoring_agent, "_run_ml_detection_with_vlm_fallback", run_detection)
    monkeypatch.setattr(video_monitoring_agent, "base_llm", UnavailableLLM())

    result = video_monitoring_agent.video_agent({
        "messages": [HumanMessage(content="count the number of perokple u see in luxsphere camera")]
    })

    assert captured["arguments"]["classes"] == "person"
    assert captured["camera"] == "CAM-01 Luxsphere Entrance Gate"
    assert result["messages"][0].content == "Three people detected."


def test_supervisor_routes_greeting_and_camera_count_without_llm(monkeypatch):
    class UnavailableLLM:
        def invoke(self, _messages):
            raise AssertionError("Deterministic requests should not call the supervisor LLM")

    monkeypatch.setattr(video_monitoring_agent, "base_llm", UnavailableLLM())

    greeting = video_monitoring_agent.supervisor_node({
        "messages": [HumanMessage(content="hi")]
    })
    camera_count = video_monitoring_agent.supervisor_node({
        "messages": [HumanMessage(content="count the number of perokple u see in luxsphere camera")]
    })

    assert greeting["next_agent"] == "general_agent"
    assert camera_count["next_agent"] == "video_agent"


def test_simple_greeting_uses_local_response_without_llm(monkeypatch):
    class UnavailableLLM:
        def bind_tools(self, _tools):
            raise AssertionError("A simple greeting should not call the agent LLM")

    monkeypatch.setattr(video_monitoring_agent, "base_llm", UnavailableLLM())

    result = video_monitoring_agent.general_agent({
        "messages": [HumanMessage(content="hi")]
    })

    assert "Hello!" in result["messages"][0].content
    assert result["next_agent"] == "FINISH"
