"""PRISM Documents backend.

A local-first FastAPI service that performs PDF operations and (later) document
intelligence on the user's machine. It binds to the loopback interface on an
OS-assigned ephemeral port and authenticates every request with a per-session
token, so it never conflicts with other local apps and is not reachable from
the network.
"""

__version__ = "0.2.1"
