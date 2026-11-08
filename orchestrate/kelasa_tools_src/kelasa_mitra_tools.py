"""The three Kelasa Mitra tools for IBM watsonx Orchestrate. Logic lives in kelasa_core.py."""
from ibm_watsonx_orchestrate.agent_builder.tools import tool

from kelasa_core import extract_profile_result, find_matches_result, skill_gap_result


@tool()
def extract_profile(worker_text: str, ui_language: str) -> dict:
    """Call this FIRST for EVERY worker message, before anything else, even greetings or questions.
    Reads the worker's skills, area and languages with fixed rules and says what is still missing.

    Args:
        worker_text (str): Everything the worker has said, exactly as written in the message.
        ui_language (str): The worker's language code from the message: en, kn or hi.

    Returns:
        dict: profile, profile_complete, and follow_up_question. When follow_up_question is not
            null, reply with exactly that text and stop.
    """
    return extract_profile_result(worker_text, ui_language)


@tool()
def find_matches(worker_text: str, ui_language: str) -> dict:
    """Ranks sample jobs near the worker. Call only after extract_profile says profile_complete is true.
    All jobs, places, pay and distances come from fixed sample data, never from the model.

    Args:
        worker_text (str): The same worker_text that was given to extract_profile.
        ui_language (str): The same ui_language that was given to extract_profile.

    Returns:
        dict: matches (sample data) and reply_lines, which are ready-made sentences in the
            worker's language to copy exactly.
    """
    return find_matches_result(worker_text, ui_language)


@tool()
def skill_gap(worker_text: str, ui_language: str) -> dict:
    """Finds the skills that would unlock the most sample jobs near the worker. Call after find_matches.

    Args:
        worker_text (str): The same worker_text that was given to extract_profile.
        ui_language (str): The same ui_language that was given to extract_profile.

    Returns:
        dict: gaps (sample data) and reply_lines, which are ready-made sentences in the
            worker's language to copy exactly.
    """
    return skill_gap_result(worker_text, ui_language)
