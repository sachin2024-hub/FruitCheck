"""Minimal Supabase REST client acting *as the signed-in user*.

Only the public publishable/anon key is used. The user's own access token is
forwarded, so Postgres Row Level Security decides what may be written.

Writes to the `classifications` table defined in
supabase/migrations/20261022000000_fruitcheck_schema.sql.
"""
import logging

import httpx

logger = logging.getLogger("fruitcheck.supabase")


class SupabaseClient:
    def __init__(self, url: str, key: str, table: str, timeout: float = 8.0):
        self.base = url.rstrip("/")
        self.key = key
        self.table = table
        self.timeout = timeout
        self._fruit_ids: dict[str, int] | None = None

    def _headers(self, token: str) -> dict[str, str]:
        return {"apikey": self.key, "Authorization": f"Bearer {token}"}

    async def get_user_id(self, token: str) -> str | None:
        """Ask Supabase Auth to validate the token; returns the verified user id."""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                r = await client.get(f"{self.base}/auth/v1/user", headers=self._headers(token))
        except httpx.HTTPError as exc:
            logger.warning("Supabase auth unreachable: %s", type(exc).__name__)
            return None
        if r.status_code != 200:
            logger.info("Supabase rejected access token: HTTP %s", r.status_code)
            return None
        return r.json().get("id")

    async def _lookup(self, client: httpx.AsyncClient, token: str) -> tuple[dict[str, int], str | None]:
        if not self._fruit_ids:  # an empty result is not cached, so seeding the table later works
            r = await client.get(f"{self.base}/rest/v1/fruit_types?select=id,slug", headers=self._headers(token))
            r.raise_for_status()
            self._fruit_ids = {row["slug"]: row["id"] for row in r.json()}
        r = await client.get(
            f"{self.base}/rest/v1/model_versions?select=id&is_active=eq.true&limit=1", headers=self._headers(token)
        )
        model_id = r.json()[0]["id"] if r.status_code == 200 and r.json() else None
        return self._fruit_ids, model_id

    async def insert_scan(
        self,
        token: str,
        user_id: str,
        label: str,
        fruit: str,
        ripeness: str,
        confidence: float,
        image_source: str,
        image_path: str | None = None,
    ) -> tuple[str | None, str | None]:
        """Returns (scan id, None) on success or (None, short reason) on failure."""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                fruit_ids, model_id = await self._lookup(client, token)
                if fruit not in fruit_ids:
                    logger.warning("Fruit '%s' is not in public.fruit_types (found %s); scan not saved", fruit, list(fruit_ids))
                    return None, f"fruit type '{fruit}' is missing from the fruit_types table"
                payload = {
                    "user_id": user_id,
                    "fruit_type_id": fruit_ids[fruit],
                    "ripeness": ripeness,
                    "predicted_label": label,
                    "confidence": round(confidence, 6),
                    "image_source": image_source,
                    "model_version_id": model_id,
                    "image_path": image_path,
                }
                r = await client.post(
                    f"{self.base}/rest/v1/{self.table}",
                    headers={**self._headers(token), "Prefer": "return=representation"},
                    json=payload,
                )
        except httpx.HTTPStatusError as exc:
            logger.warning("Supabase lookup rejected: HTTP %s %s", exc.response.status_code, exc.response.text[:200])
            return None, f"database lookup rejected (HTTP {exc.response.status_code})"
        except httpx.HTTPError as exc:
            logger.warning("Supabase insert failed: %s", type(exc).__name__)
            return None, "could not reach the database"
        if r.status_code not in (200, 201):
            logger.warning("Supabase insert rejected: HTTP %s %s", r.status_code, r.text[:200])
            try:
                detail = r.json().get("message", "")
            except ValueError:
                detail = ""
            return None, f"database rejected the record (HTTP {r.status_code}{': ' + detail[:120] if detail else ''})"
        rows = r.json()
        return (rows[0]["id"], None) if rows else (None, "database returned no row")
