#!/usr/bin/env python3
"""
Warm up and check the Kelasa Mitra agent in IBM watsonx Orchestrate.

The first call to a Python tool after import can take well over a minute while its
environment starts, which is longer than the app's 20-second budget. Run this once
after importing the tools and agent, and again before a demo.

It sends one complete worker message (so all three tools run), waits up to 150 s,
and prints what happened: which settings are present (names only), the HTTP status,
the response's top-level keys, the thread ID, the time taken and the reply. It never
prints the API key or the access token.

Usage (from the repo root):
    python backend/scripts/agent_warmup.py
    python backend/scripts/agent_warmup.py --text "ನಾನು ಕೋರಮಂಗಲದಲ್ಲಿ ಅಡುಗೆ ಮಾಡುತ್ತೇನೆ" --lang kn
"""
from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(BACKEND / ".env")

from urllib.parse import urlparse  # noqa: E402

from tools.orchestrate_client import (  # noqa: E402
    AgentUnavailable, OrchestrateClient, auth_plan, load_settings, token_url,
)

REQUIRED = ("ORCHESTRATE_INSTANCE_URL", "ORCHESTRATE_API_KEY", "ORCHESTRATE_AGENT_ID")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    parser.add_argument("--text", default="I am a cook with 3 years experience in Koramangala")
    parser.add_argument("--lang", default="en", choices=["en", "kn", "hi"])
    parser.add_argument("--timeout", type=float, default=150.0)
    args = parser.parse_args()

    for name in REQUIRED:
        print(f"{name:26} {'set' if os.getenv(name, '').strip() else 'MISSING'}")
    settings = load_settings()
    if settings is None:
        print("\nNot configured: add the missing values to backend/.env. The app will use the rules.")
        return 2

    print(f"{'ORCHESTRATE_AUTH_TYPE':26} {settings.auth_type or '(inferred)'}")
    for method in auth_plan(settings):
        print(f"Token method {method:13} -> {urlparse(token_url(settings, method)).hostname}")
    client = OrchestrateClient(settings)
    started = time.monotonic()
    print(f"\nAsking agent {settings.agent_id} (timeout {args.timeout:.0f} s)...")
    try:
        answer = client.chat(args.text, args.lang, timeout=args.timeout)
    except AgentUnavailable as exc:
        print(f"FAILED after {time.monotonic() - started:.1f} s: reason={exc.reason} status={exc.status}")
        if exc.detail:
            print(f"Server said (first 300 chars, key removed): {exc.detail}")
        if exc.status == 404:
            print("If the agent ID is right, the chat API may need a deployed agent: "
                  "orchestrate agents deploy --name kelasa_mitra_agent")
        return 1

    print(f"OK after {time.monotonic() - started:.1f} s")
    print(f"HTTP status     : {answer.status}")
    print(f"Response keys   : {', '.join(answer.response_keys)}")
    print(f"Thread ID       : {answer.thread_id}")
    print("Reply:")
    print(answer.reply)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
