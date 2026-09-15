import asyncio
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "backend")))
from app.agents.investigator_tools import resolve_relative_date

async def test():
    res = resolve_relative_date.invoke({"value": "13thSeptember"})
    print("Result for '13thSeptember':", res)
    
    res2 = resolve_relative_date.invoke({"value": "13th September"})
    print("Result for '13th September':", res2)

if __name__ == "__main__":
    asyncio.run(test())
