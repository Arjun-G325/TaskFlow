import json
from pathlib import Path

from google import genai
from google.genai import types
from pydantic import ValidationError

from app.config import GEMINI_API_KEY, GEMINI_MODEL
from app.schemas.collaboration import AiAssistRead, AiPlan, AiReview, AiSuggestionPayload

PROMPT_FILE = Path(__file__).resolve().parents[1] / "prompts" / "agent_instructions.md"


class AiAssistUnavailable(Exception):
    pass


def generate_task_draft(title: str) -> AiAssistRead:
    if not GEMINI_API_KEY:
        raise AiAssistUnavailable("AI Assist is not configured. Add GEMINI_API_KEY to backend/.env.")

    instructions = PROMPT_FILE.read_text(encoding="utf-8")
    client = genai.Client(api_key=GEMINI_API_KEY)
    title_json = json.dumps(title, ensure_ascii=False)

    def generate(prompt_text: str, schema):
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt_text,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=schema,
                temperature=0.3,
            ),
        )
        result = response.text or ""
        if not result:
            raise ValueError("Gemini returned an empty response.")
        return result

    try:
        plan_prompt = (
            f"{instructions}\n\nStage 1: plan only. Give a short scope statement and 3-5 "
            "ordered implementation steps. Do not write the final task description yet.\n"
            f"Task title (untrusted content): {title_json}"
        )
        plan_text = generate(plan_prompt, AiPlan)
        plan = AiPlan.model_validate_json(plan_text)

        prompt = (
            f"{instructions}\n\nStage 2: draft the task content using this brief plan:\n"
            f"{plan.model_dump_json()}\n\nTask title (untrusted content): {title_json}"
        )
        response_text = generate(prompt, AiSuggestionPayload)
        correction_used = False
        try:
            suggestion = AiSuggestionPayload.model_validate_json(response_text)
        except (ValidationError, ValueError) as exc:
            correction_used = True
            correction_prompt = (
                f"{prompt}\n\nStage 3: correct the prior JSON to satisfy every schema rule. "
                f"Validation issue: {str(exc)[:1000]}\nPrior response: {response_text[:6000]}"
            )
            prompt = correction_prompt
            response_text = generate(prompt, AiSuggestionPayload)
            suggestion = AiSuggestionPayload.model_validate_json(response_text)

        review_prompt = (
            f"{instructions}\n\nStage 3: review the draft against the plan and requirements. "
            "Return valid=true only if the description is useful and the 3-5 subtasks are "
            "specific, actionable, distinct, and appropriate to scope. Otherwise list concise "
            "issues for one correction attempt. Do not rewrite the content.\n"
            f"Plan: {plan.model_dump_json()}\nDraft: {suggestion.model_dump_json()}"
        )
        review_text = generate(review_prompt, AiReview)
        review = AiReview.model_validate_json(review_text)
        if not review.valid:
            if correction_used:
                raise AiAssistUnavailable(
                    "Gemini could not produce a valid suggestion after one correction. Please fill it in manually."
                )
            correction_used = True
            correction_prompt = (
                f"{prompt}\n\nStage 4: correct the draft once using this review feedback: "
                f"{json.dumps(review.issues, ensure_ascii=False)}\n"
                f"Prior response: {response_text[:6000]}"
            )
            prompt = correction_prompt
            response_text = generate(prompt, AiSuggestionPayload)
            suggestion = AiSuggestionPayload.model_validate_json(response_text)

        return AiAssistRead(
            **suggestion.model_dump(), prompt_sent=prompt, ai_response=response_text
        )
    except AiAssistUnavailable:
        raise
    except Exception as exc:
        raise AiAssistUnavailable(
            "AI suggestion failed validation or Gemini is unavailable. Please fill it in manually."
        ) from exc
