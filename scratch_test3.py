import sys
import os
import json

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "backend")))
from app.agents.video_monitoring_agent import _render_historical_alert_investigation

def test_render():
    res = _render_historical_alert_investigation("What happened on Luxsphere camera on 3rd September?", 120.0)
    print("Messages length:", len(res['messages']))
    print("Content preview:\n", res['messages'][0].content[:250])
    print("\nGenerated outputs count:", len(res.get('generated_outputs', [])))
    if res.get('generated_outputs'):
        gen = res['generated_outputs'][0]
        print("Widget type:", gen.get('type'))
        print("Widget title:", gen.get('title'))
        print("Items count:", len(gen.get('items', [])))
        print("First item sample:\n", json.dumps(gen.get('items', [])[0], indent=2))

if __name__ == "__main__":
    test_render()
