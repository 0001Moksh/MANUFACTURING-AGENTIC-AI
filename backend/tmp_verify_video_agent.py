import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.agents.video_monitoring_agent import video_agent

state = {"messages": [{"type": "human", "content": "Run Fire Detection on CAM-02"}]}
result = video_agent(state)
print(type(result).__name__)
print(result.get("next_agent"))
print((result["messages"][0].content or "")[:220])
