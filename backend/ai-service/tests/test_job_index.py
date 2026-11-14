from app.job_index import Candidate, collapse_duplicates, content_hash, dedupe_key, job_text
from app.schemas import JobDocument


def candidate(job_id, similarity, key, vector):
    return Candidate(job_id=job_id, similarity=similarity, key=key, vector=vector)


def test_same_title_and_company_is_one_result():
    hits, collapsed = collapse_duplicates(
        [
            candidate("a", 0.90, "python developer|nova", [1.0, 0.0]),
            candidate("b", 0.89, "python developer|nova", [0.0, 1.0]),  # same vacancy on another board
            candidate("c", 0.70, "data analyst|retailco", [0.6, 0.8]),
        ],
        top_k=5, min_similarity=0.0, duplicate_similarity=0.97,
    )
    assert [hit.job_id for hit in hits] == ["a", "c"]
    assert hits[0].duplicate_job_ids == ["b"] and collapsed == 1


def test_near_identical_vectors_are_one_result_even_with_different_titles():
    hits, collapsed = collapse_duplicates(
        [
            candidate("a", 0.90, "data analyst|retailco", [1.0, 0.0]),
            candidate("b", 0.88, "data analyst|retailco llc", [0.999, 0.0447]),
            candidate("c", 0.80, "bi analyst|other", [0.8, 0.6]),
        ],
        top_k=5, min_similarity=0.0, duplicate_similarity=0.97,
    )
    assert [hit.job_id for hit in hits] == ["a", "c"] and collapsed == 1


def test_top_k_counts_distinct_jobs_and_min_similarity_cuts_the_tail():
    candidates = [candidate(str(index), 0.9 - index * 0.1, f"job {index}|co", [1.0 if index == axis else 0.0 for axis in range(6)]) for index in range(6)]
    hits, _ = collapse_duplicates(candidates, top_k=3, min_similarity=0.0, duplicate_similarity=0.97)
    assert [hit.job_id for hit in hits] == ["0", "1", "2"]
    hits, _ = collapse_duplicates(candidates, top_k=10, min_similarity=0.65, duplicate_similarity=0.97)
    assert [hit.job_id for hit in hits] == ["0", "1", "2"]


def test_job_text_and_hash():
    job = JobDocument(job_id="1", title="Satış meneceri", company="Günəş Market", description="")
    assert job_text(job) == "Satış meneceri\nGünəş Market"
    assert dedupe_key(job) == dedupe_key(JobDocument(job_id="2", title="  SATIŞ  meneceri", company="günəş market"))
    # A changed description, model or dimension changes the hash, so the job is re-embedded.
    assert content_hash("m", 768, "a") != content_hash("m", 768, "b")
    assert content_hash("m", 768, "a") != content_hash("m2", 768, "a")
