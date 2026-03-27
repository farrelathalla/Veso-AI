from slowapi import Limiter
from slowapi.util import get_remote_address

# Rate limit keyed by client IP.
# All expensive endpoints (LLM, file upload) apply per-route limits via @limiter.limit().
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])
