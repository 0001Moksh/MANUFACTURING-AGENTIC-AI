import asyncio
import os
import sys

# Add backend dir to sys path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "backend")))

from app.agents.investigator_tools import get_incidents_by_date, get_available_alert_dates

async def test_investigator():
    print("Testing get_available_alert_dates...")
    dates = get_available_alert_dates.invoke({"camera_name": "Luxsphere"})
    print("Available dates:", dates)

    print("\nTesting get_incidents_by_date for Luxsphere on 3rd September...")
    incidents = get_incidents_by_date.invoke({"start_date": "2026-09-03", "camera_name": "Luxsphere"})
    print(f"Found {len(incidents)} incidents.")
    if incidents:
        print("Sample:", incidents[0])

if __name__ == "__main__":
    asyncio.run(test_investigator())
