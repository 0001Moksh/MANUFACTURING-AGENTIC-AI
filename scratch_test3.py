import asyncio
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "backend")))
from app.agents.investigator_tools import get_incidents_by_date, resolve_camera_id

async def test():
    c_res = resolve_camera_id.invoke({"camera_name": "what happened on the luxsphere"})
    print("Resolved Camera:", c_res)
    
    incidents = get_incidents_by_date.invoke({
        "start_date": "2026-09-13",
        "camera_name": "what happened on the luxsphere"
    })
    print("Found Incidents:", len(incidents))

if __name__ == "__main__":
    asyncio.run(test())
