from __future__ import annotations

import asyncio
import json
import re

import structlog
from openai import AsyncOpenAI

from app.config import get_settings

log = structlog.get_logger()

_semaphore = asyncio.Semaphore(5)  # max 5 concurrent LLM calls


def _extract_json_block(text: str) -> dict:
    """Extract the first JSON object from a raw text string."""
    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Look for ```json ... ``` or ``` ... ``` fenced blocks
    fenced = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", text)
    if fenced:
        try:
            return json.loads(fenced.group(1))
        except json.JSONDecodeError:
            pass

    # Find first { ... } span
    start = text.find("{")
    if start != -1:
        depth = 0
        for i, ch in enumerate(text[start:], start):
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(text[start : i + 1])
                    except json.JSONDecodeError:
                        break

    raise ValueError(f"No valid JSON found in LLM response: {text[:200]!r}")


async def chat_json(
    messages: list[dict],
    model: str | None = None,
    timeout: float = 30.0,
    max_retries: int = 3,
) -> dict:
    """Call LLM and return parsed JSON dict. Retries with exponential backoff on 429/5xx."""
    settings = get_settings()
    client = AsyncOpenAI(
        api_key=settings.github_token,
        base_url=settings.llm_base_url,
    )
    model = model or settings.llm_model

    last_exc: Exception | None = None

    for attempt in range(max_retries):
        try:
            async with _semaphore:
                # Try with response_format json_object first
                try:
                    resp = await asyncio.wait_for(
                        client.chat.completions.create(
                            model=model,
                            messages=messages,
                            response_format={"type": "json_object"},
                        ),
                        timeout=timeout,
                    )
                    return json.loads(resp.choices[0].message.content)
                except Exception as inner:
                    inner_msg = str(inner).lower()
                    # If the endpoint doesn't support response_format, fall back
                    if any(
                        kw in inner_msg
                        for kw in (
                            "response_format",
                            "unsupported",
                            "invalid_request",
                            "does not support",
                            "not supported",
                        )
                    ):
                        log.warning(
                            "llm_json_format_unsupported",
                            model=model,
                            fallback="plain_text",
                        )
                        resp = await asyncio.wait_for(
                            client.chat.completions.create(
                                model=model,
                                messages=messages,
                            ),
                            timeout=timeout,
                        )
                        return _extract_json_block(resp.choices[0].message.content)
                    raise

        except Exception as e:
            last_exc = e
            if attempt == max_retries - 1:
                break
            wait = 2**attempt
            log.warning(
                "llm_retry",
                attempt=attempt,
                error=str(e),
                wait=wait,
                model=model,
            )
            await asyncio.sleep(wait)

    raise RuntimeError(f"LLM failed after {max_retries} retries: {last_exc}") from last_exc
