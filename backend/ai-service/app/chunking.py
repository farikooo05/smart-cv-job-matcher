import re
from dataclasses import dataclass


MAX_WORDS = 220
OVERLAP_WORDS = 30

SECTION_ALIASES = {
    "summary": {"summary", "profile", "about me", "professional summary", "haqqımda", "о себе"},
    "experience": {"experience", "work experience", "employment", "iş təcrübəsi", "iş təcrübəm", "опыт работы"},
    "education": {"education", "təhsil", "образование"},
    "projects": {"projects", "project experience", "layihələr", "layihələrim", "проекты"},
    "skills": {"skills", "technical skills", "competencies", "bacarıqlar", "навыки"},
    "certifications": {"certifications", "certificates", "sertifikatlar", "сертификаты"},
    "languages": {"languages", "dillər", "языки"},
}

ALIAS_TO_SECTION = {
    re.sub(r"[^\w ]", "", alias.casefold()).strip(): section
    for section, aliases in SECTION_ALIASES.items()
    for alias in aliases
}


@dataclass(frozen=True)
class ResumeChunk:
    chunk_index: int
    section: str
    start_word: int
    end_word: int
    content: str


def _section_for_heading(line: str) -> str | None:
    normalized = re.sub(r"[^\w ]", "", line.casefold()).strip()
    return ALIAS_TO_SECTION.get(normalized)


def _split_long_paragraph(words: list[str], start_word: int, section: str) -> list[ResumeChunk]:
    chunks: list[ResumeChunk] = []
    cursor = 0
    while cursor < len(words):
        end = min(cursor + MAX_WORDS, len(words))
        chunks.append(ResumeChunk(
            chunk_index=0,
            section=section,
            start_word=start_word + cursor,
            end_word=start_word + end,
            content=" ".join(words[cursor:end]),
        ))
        if end == len(words):
            break
        cursor = end - OVERLAP_WORDS
    return chunks


def chunk_resume(text: str) -> list[ResumeChunk]:
    """Split CV text by recognized section headings and paragraph-sized word windows."""
    sections: list[tuple[str, list[str]]] = []
    current_name = "general"
    current_lines: list[str] = []

    for line in text.splitlines():
        heading = _section_for_heading(line.strip().rstrip(":"))
        if heading:
            if current_lines:
                sections.append((current_name, current_lines))
            current_name = heading
            current_lines = []
        elif line.strip():
            current_lines.append(line.strip())

    if current_lines:
        sections.append((current_name, current_lines))

    if not sections and text.strip():
        sections = [("general", [text.strip()])]

    raw_chunks: list[ResumeChunk] = []
    global_word_offset = 0
    for section, lines in sections:
        paragraphs = [part.strip() for line in lines for part in re.split(r"\n\s*\n", line) if part.strip()]
        pending_words: list[str] = []
        pending_start = global_word_offset

        for paragraph in paragraphs:
            words = paragraph.split()
            if len(words) > MAX_WORDS:
                if pending_words:
                    raw_chunks.append(ResumeChunk(0, section, pending_start, pending_start + len(pending_words), " ".join(pending_words)))
                    pending_start += len(pending_words)
                    pending_words = []
                raw_chunks.extend(_split_long_paragraph(words, global_word_offset, section))
                global_word_offset += len(words)
                pending_start = global_word_offset
                continue

            if pending_words and len(pending_words) + len(words) > MAX_WORDS:
                raw_chunks.append(ResumeChunk(0, section, pending_start, pending_start + len(pending_words), " ".join(pending_words)))
                pending_start += max(1, len(pending_words) - OVERLAP_WORDS)
                pending_words = pending_words[-OVERLAP_WORDS:]
            if not pending_words:
                pending_start = global_word_offset
            pending_words.extend(words)
            global_word_offset += len(words)

        if pending_words:
            raw_chunks.append(ResumeChunk(0, section, pending_start, pending_start + len(pending_words), " ".join(pending_words)))

    return [
        ResumeChunk(index, chunk.section, chunk.start_word, chunk.end_word, chunk.content)
        for index, chunk in enumerate(raw_chunks)
        if chunk.content.strip()
    ]
