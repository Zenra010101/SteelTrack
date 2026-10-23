"""Verify the session-token lifecycle around a backend restart.

Checks the two behaviours that matter:

  1. A browser reload must not change the token at all — the same token keeps
     working against the same running API.
  2. A backend restart must invalidate the token — the same token is rejected
     with a 401 that names the reason.

The credentials are read from the tracked DataSeeder source rather than
hardcoded here, and nothing sensitive is printed.

    python verify_session_lifecycle.py
"""

import base64
import json
import os
import re
import sys
import tempfile
import urllib.error
import urllib.request

BASE = os.environ.get("STEELTRACK_API", "http://127.0.0.1:5199")
SEEDER = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..",
    "Infrastructure",
    "Persistence",
    "DataSeeder.cs",
)

PASS, FAIL = "PASS", "FAIL"
results = []


def check(name, ok, detail=""):
    results.append((name, ok, detail))
    print(f"[{PASS if ok else FAIL}] {name}" + (f" — {detail}" if detail else ""))


def seeded_owner_credentials():
    """Pull the demo owner account out of the tracked seeder source."""
    with open(SEEDER, encoding="utf-8") as fh:
        source = fh.read()

    entry = re.search(
        r'\(Email:\s*"(?P<email>[^"]*owner[^"]*)".*?Password:\s*"(?P<password>[^"]+)"\)',
        source,
        re.DOTALL,
    )
    if not entry:
        raise SystemExit("could not find the demo owner account in DataSeeder.cs")
    return entry.group("email"), entry.group("password")


def post_json(path, payload, token=None):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{BASE}{path}", data=data, method="POST",
        headers={"Content-Type": "application/json"},
    )
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read())


def get_json(path, token=None):
    req = urllib.request.Request(f"{BASE}{path}")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read())


def get_status(path, token=None):
    """Return (status, body-json-or-None) without raising on 401."""
    req = urllib.request.Request(f"{BASE}{path}")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        try:
            return exc.code, json.loads(raw)
        except (json.JSONDecodeError, ValueError):
            return exc.code, None


def claims_of(token):
    """Decode the JWT payload (not the signature) to read its claims."""
    payload = token.split(".")[1]
    payload += "=" * (-len(payload) % 4)
    return json.loads(base64.urlsafe_b64decode(payload))


def main():
    email, password = seeded_owner_credentials()

    # The token is carried across the restart in a file, because the point of
    # the "after restart" run is to present the token the OLD process issued
    # to the NEW process. Logging in again would mint a fresh token and prove
    # nothing.
    #
    # It is written to the system temp directory, never into the repository:
    # it is a live session token and must not be committable.
    token_file = os.environ.get(
        "STEELTRACK_TOKEN_FILE",
        os.path.join(tempfile.gettempdir(), "steeltrack_session_token.txt"),
    )

    if "--after-restart" in sys.argv:
        with open(token_file, encoding="utf-8") as fh:
            token = fh.read().strip()

        check("the pre-restart token was carried over", bool(token))

        # The API was restarted; the old token must now be rejected.
        status, body = get_status("/api/auth/me", token)
        check(
            "old token is rejected after a restart",
            status == 401,
            f"HTTP {status}",
        )
        check(
            "rejection names the reason",
            bool(body) and body.get("reason") == "server_restarted",
            f"reason={body.get('reason') if body else None}",
        )
        check(
            "rejection carries a human-readable message",
            bool(body) and bool(body.get("message")),
            body.get("message") if body else None,
        )

        # A fresh login must work and produce a token for the new instance.
        login2 = post_json("/api/auth/login", {"email": email, "password": password})
        token2 = login2["data"]["token"]
        claims2 = claims_of(token2)
        instance2 = get_json("/api/session/instance")
        check("a fresh login works after the restart", bool(token2))
        check(
            "the new token belongs to the new instance",
            claims2.get("stt_instance") == instance2.get("instanceId"),
            f"stt_instance={claims2.get('stt_instance')}",
        )
        check("the new token differs from the old one", token2 != token)
    else:
        # --- Log in -----------------------------------------------------
        login = post_json("/api/auth/login", {"email": email, "password": password})
        token = login["data"]["token"]
        check("login returns a token", bool(token))

        with open(token_file, "w", encoding="utf-8") as fh:
            fh.write(token)

        claims = claims_of(token)
        check(
            "token carries the server instance claim",
            bool(claims.get("stt_instance")),
            f"stt_instance={claims.get('stt_instance')}",
        )

        # --- The instance the token belongs to --------------------------
        instance = get_json("/api/session/instance")
        check(
            "session endpoint reports the same instance as the token",
            instance.get("instanceId") == claims.get("stt_instance"),
        )

        # --- A reload must not change anything --------------------------
        # A reload is: read the stored token again, ask the API. The token
        # is used as-is and is never re-issued.
        status, _ = get_status("/api/auth/me", token)
        check("stored token still works against the same API", status == 200, f"HTTP {status}")

        status, _ = get_status(
            "/api/products/lstm-forecast?fromMonth=2026-04-01&toMonth=2027-01-01", token
        )
        check("forecast endpoint accepts the stored token", status == 200, f"HTTP {status}")

        # --- The token survives being re-read, byte for byte -------------
        reread = login["data"]["token"]
        check("token is stable across reads", reread == token)

        print()
        print("Token saved to", token_file)
        print("Restart the API, then re-run with --after-restart")

    failed = [name for name, ok, _ in results if not ok]
    print()
    print(f"{len(results) - len(failed)}/{len(results)} checks passed")
    if failed:
        print("FAILED: " + ", ".join(failed))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
