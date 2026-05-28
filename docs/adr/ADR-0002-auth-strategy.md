# ADR-0002 — Auth Strategy: Cookie-based JWT

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-05-28 |
| **Deciders** | Nitin |

---

## Context

The frontend (Next.js) and backend (Django) are separate services. Auth tokens must be:
- Secure against XSS attacks
- Automatically sent with every API request (no manual header injection)
- Revocable on logout
- Long-lived enough for a boutique operator working all day

---

## Decision

Use **`djangorestframework-simplejwt`** with a custom `CookieTokenObtainPairView` that sets tokens in **HTTP-only cookies** instead of returning them in the response body.

- `access_token` cookie: 24-hour lifetime
- `refresh_token` cookie: 30-day lifetime, rotated on use
- All API requests use `credentials: 'include'` in the fetch client
- A custom `CookieJWTAuthentication` reads the cookie on every request

---

## Alternatives Considered

| Option | Reason Rejected |
|--------|----------------|
| Token in `Authorization` header (stored in localStorage) | Vulnerable to XSS; any JS on the page can read it |
| Token in `Authorization` header (stored in memory) | Lost on page refresh; poor UX for a daily-use tool |
| Django session auth | Sessions require sticky load balancing; cookie JWT is stateless and scales better |
| NextAuth.js | Adds a 3rd-party auth layer that duplicates Django's auth; increases complexity |

---

## Consequences

**Positive:**
- Tokens are inaccessible to JavaScript — XSS-safe
- Cookies are automatically sent on every request — no frontend token management
- `SameSite: Lax` + `Secure` flags prevent CSRF in practice for this app
- `simplejwt` integrates natively with DRF; minimal custom code

**Negative:**
- Requires `CORS_ALLOW_CREDENTIALS = True` and explicit origin allowlist
- Cookie-based auth is slightly more complex to test in tools like Postman (must handle cookies)
- Token refresh must be handled explicitly when `access_token` expires

---

## Implementation Notes

```python
# Custom auth class reads from cookie instead of Authorization header
class CookieJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        raw_token = request.COOKIES.get(settings.SIMPLE_JWT['AUTH_COOKIE'])
        if raw_token is None:
            return None
        validated_token = self.get_validated_token(raw_token)
        return self.get_user(validated_token), validated_token
```

---

## References

- `03-technical-architecture.md` §6.2, §6.3, §10 — Full auth flow and implementation
