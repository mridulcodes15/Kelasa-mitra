"""Stage 3a spike 1: the smallest possible Python tool, no third-party imports."""
from ibm_watsonx_orchestrate.agent_builder.tools import tool


@tool()
def spike_hello(name: str) -> str:
    """Greets a person by name. Used only to test that Python tools import and run.

    Args:
        name (str): The name to greet.

    Returns:
        str: A greeting that includes the name.
    """
    return f"Hello, {name}. The Kelasa Mitra spike tool ran inside watsonx Orchestrate."
