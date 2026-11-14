"""Input and output guardrails that do not depend on the model.

Input side: clean the text, strip contact details, defuse the data delimiters and flag
text that tries to instruct the model. Output side: check that every quote the model
returns really exists in the source document.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field

MAX_DOCUMENT_CHARS = 30_000

_INVISIBLE = re.compile("[­​-‏‪-‮⁠-⁤﻿]")
_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_TRAILING_SPACE = re.compile(r"[ \t]+\n")
_BLANK_LINES = re.compile(r"\n{3,}")
# The prompts wrap documents in these tags; a document must not be able to close one.
_DATA_TAGS = re.compile(r"<\s*(/?)\s*(cv|vacancy|requirements)\s*>", re.IGNORECASE)

_EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
_PHONE = re.compile(r"(?<![\w.])\+?\(?\d(?:[ \-()]{0,2}\d){8,14}(?![\w])")
_YEAR = re.compile(r"(?:19|20)\d{2}")

_INJECTION_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"\b(?:ignore|disregard|forget|override|bypass)\b[^.\n]{0,40}\b(?:instruction|prompt|rule|guideline|direction)s?\b",
        r"\b(?:system|developer)\s+(?:prompt|message|instructions?)\b",
        r"\byou are now\b",
        r"\b(?:mark|rate|score|grade|classify|rank|report)\b[^.\n]{0,60}\b(?:matched|100\s*%|perfect (?:match|fit)|top candidate|best (?:match|candidate))",
        r"\b(?:ai|llm|language model|chatbot|assistant|screening (?:tool|system|software)|ats)\b[^.\n]{0,50}\b(?:must|should|shall|please|has to)\b[^.\n]{0,60}\b(?:candidate|applicant|score|match|recommend|rank|hire|approve)",
        r"\b(?:note|attention|message|instructions?)\s+(?:to|for)\s+(?:the\s+|any\s+)?(?:ai|llm|model|assistant|bot|screening)\b",
        r"(?:игнорируй(?:те)?|забудь(?:те)?|не обращай(?:те)? внимания на)[^.\n]{0,40}(?:инструкци|указани|правил)",
        r"(?:отметь(?:те)?|оцени(?:те)?|поставь(?:те)?)[^.\n]{0,60}(?:соответству|100\s*%|подходящ)",
        r"(?:əvvəlki|bütün)[^.\n]{0,30}(?:təlimat|göstəriş)[^.\n]{0,40}(?:nəzərə alma|unut|məhəl qoyma)",
    )
]

_PUNCTUATION = str.maketrans({
    "“": '"', "”": '"', "„": '"', "«": '"', "»": '"',
    "’": "'", "‘": "'", "–": "-", "—": "-", "‑": "-", " ": " ",
})
_EDGE_PUNCTUATION = " .,;:!?\"'()[]-•*"


def normalize_for_match(text: str) -> str:
    """Canonical form for quote checks: same letters, any spacing, case and quote style."""
    folded = unicodedata.normalize("NFKC", text).translate(_PUNCTUATION).casefold()
    # Azerbaijani and Turkish have dotted and dotless i. Python lowercases "I" to "i" and "İ" to
    # "i" plus a combining dot, so "SATIŞ" and "satış" would not match. Fold all of them to "i".
    return " ".join(folded.replace("ı", "i").replace("̇", "").split())


def sanitize_text(text: str, max_chars: int = MAX_DOCUMENT_CHARS) -> str:
    """Remove invisible and control characters (a common way to hide text in a PDF) and cap the length."""
    text = unicodedata.normalize("NFKC", text).replace("\r\n", "\n").replace("\r", "\n")
    text = _CONTROL.sub("", _INVISIBLE.sub("", text))
    text = _BLANK_LINES.sub("\n\n", _TRAILING_SPACE.sub("\n", text)).strip()
    return text[:max_chars]


def redact_pii(text: str) -> tuple[str, int]:
    """Replace e-mail addresses and phone numbers. Matching never needs them, so the model never sees them."""
    text, emails = _EMAIL.subn("[email]", text)
    phones = 0

    def replace_phone(match: re.Match[str]) -> str:
        nonlocal phones
        candidate = match.group(0)
        digits = sum(character.isdigit() for character in candidate)
        # A run like "2019 - 2023 2021" is a date range, not a phone number.
        if digits < 9 or len(_YEAR.findall(candidate)) >= 2:
            return candidate
        phones += 1
        return "[phone]"

    return _PHONE.sub(replace_phone, text), emails + phones


def neutralize_delimiters(text: str) -> str:
    """Turn "<cv>" or "</vacancy>" inside a document into harmless text."""
    return _DATA_TAGS.sub(lambda match: f"({match.group(1)}{match.group(2)})", text)


def find_injections(text: str) -> list[str]:
    """Return the lines that look like instructions aimed at the model, in normalized form."""
    found: list[str] = []
    for pattern in _INJECTION_PATTERNS:
        for match in pattern.finditer(text):
            start = text.rfind("\n", 0, match.start()) + 1
            end = text.find("\n", match.end())
            line = normalize_for_match(text[start:end if end != -1 else len(text)])
            if line and line not in found:
                found.append(line)
    return found


@dataclass(frozen=True)
class PreparedText:
    """A document after input guardrails: this exact text is what the model sees and what quotes are checked against."""

    text: str
    normalized: str
    injections: list[str] = field(default_factory=list)
    pii_redactions: int = 0

    def contains(self, quote: str) -> bool:
        """True when `quote` is a verbatim excerpt of this document and not part of a flagged instruction."""
        needle = normalize_for_match(quote).strip(_EDGE_PUNCTUATION)
        if len(needle) < 2:
            return False
        if len(needle) <= 3:
            # Short quotes such as "ML" or "C1" must be whole words, not a fragment of "HTML".
            if not re.search(rf"(?<!\w){re.escape(needle)}(?!\w)", self.normalized):
                return False
        elif needle not in self.normalized:
            return False
        return not any(needle in line or line in needle for line in self.injections)


def prepare_text(text: str, max_chars: int = MAX_DOCUMENT_CHARS) -> PreparedText:
    cleaned, redactions = redact_pii(sanitize_text(text, max_chars))
    cleaned = neutralize_delimiters(cleaned)
    return PreparedText(
        text=cleaned,
        normalized=normalize_for_match(cleaned),
        injections=find_injections(cleaned),
        pii_redactions=redactions,
    )
