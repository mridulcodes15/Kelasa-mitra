"""Stage 3a spike 1b: a Python tool that uses pydantic internally but returns a plain dict."""
from ibm_watsonx_orchestrate.agent_builder.tools import tool
from pydantic import BaseModel


class SpikeArea(BaseModel):
    """A Bengaluru area with fixed coordinates, mirroring backend/models/worker.py."""

    id: str
    name: str
    lat: float
    lon: float


@tool()
def spike_pydantic_area(area_name: str) -> dict:
    """Returns a fixed sample area. Used only to test pydantic inside watsonx Orchestrate.

    Args:
        area_name (str): Any area name; it is echoed back as the name.

    Returns:
        dict: The sample area with keys id, name, lat and lon. The coordinates are fixed test values.
    """
    area = SpikeArea(id="spike", name=area_name, lat=12.9352, lon=77.6245)
    return area.model_dump()
