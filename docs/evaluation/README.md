# OptiJob evaluation

How the AI pipeline is tested, what the datasets contain, and how to reproduce the numbers in the main README.

All files are in [backend/ai-service/evaluation](../../backend/ai-service/evaluation).

## Datasets

### Analysis: `golden/analysis.json`

26 CV and vacancy pairs with 185 labelled requirements.

| Group | Cases | What it checks |
| --- | ---: | --- |
| Real pair | 2 | One real CV (contact details removed) against one real vacancy, in English and in the original Azerbaijani |
| Technical roles | 9 | Direct evidence, equivalent terms, seniority and degree levels |
| Non-technical roles | 8 | Accounting, marketing, sales, teaching, engineering, support |
| Other languages | 4 | Russian and Azerbaijani CVs and vacancies, including a CV and a vacancy in different languages |
| Prompt injection | 2 | Instructions to the model hidden in a CV and in a vacancy |
| Edge cases | 3 | Contact details in the CV, a vacancy with no requirements, many nice-to-have items |

Each requirement has:

- `expected`: `matched` or `missing`
- `importance` and `category`: used for the weighted score
- `jobEvidence`: the vacancy phrase that states it
- `cvEvidence`: for matched items, the CV phrase that proves it
- `pattern`: a regular expression that recognises this requirement in the model's own list

A unit test ([tests/test_golden_dataset.py](../../backend/ai-service/tests/test_golden_dataset.py)) checks that every labelled quote really exists in its source text, so a typo in a label cannot silently change the metrics.

**Labelling rules**

- Matched: the CV states the skill, or states something that directly implies it (a product for its category, a library for its language, an equal or higher level).
- Missing: no evidence, only a wish or plan, an explicit negation, a level below the requirement, or an amount of experience the CV does not let you work out.
- Compound requirements are separate items. "X or Y" alternatives stay one item.
- Soft skills are matched only when the CV names them.

**Dev and test split.** Prompts were tuned only on the 8 cases listed under `dev_cases`. The other 18 cases are the held-out test set: they were run only to report results. The report gives both.

**Who wrote the labels.** The synthetic cases and all labels were drafted with an AI assistant and follow the rules above. They should be reviewed by a person before the numbers are quoted as ground truth.

### Retrieval: `golden/retrieval.json`

31 job postings in English, Azerbaijani and Russian, including 3 re-posted duplicates, and 12 candidate profiles with the jobs that are relevant to each.

## What is measured

| Suite | Question | Metrics |
| --- | --- | --- |
| `analysis`: evidence check | Given the correct requirement list, does the model decide matched or missing correctly? | Accuracy, precision, recall, F1; share of quotes that are verbatim CV text |
| `analysis`: extraction | Does the model find the requirements in the vacancy? | Coverage of labelled requirements, agreement on required or nice-to-have, share of verbatim vacancy quotes |
| `analysis`: end to end | With the model's own requirement list, is the final result right? | Requirement-level accuracy; mean absolute error of the 0-100 score |
| `retrieval` | Does vector search find the right jobs for a profile? | Recall@k, MRR, duplicate results in the top 5 before and after collapsing |
| `sampling` | What do temperature and top-k change? | Accuracy and the share of verdicts that stay the same across repeated runs |

"Matched" is the positive class: precision falls when the model claims a match that is not there, recall falls when it misses a real match.

## Run it

From `backend/ai-service`, with `GEMINI_API_KEY` set in `backend/.env`:

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt -r requirements-dev.txt

.venv\Scripts\python -m pytest                             # unit tests, no network
.venv\Scripts\python -m evaluation.run_eval analysis       # about 80 model calls
.venv\Scripts\python -m evaluation.run_eval retrieval      # 3 embedding calls
.venv\Scripts\python -m evaluation.run_eval sampling --limit 12
```

Useful options:

- `--model gemini-3.8-flash`: evaluate another model; the report is saved as `results/analysis-<model>.json`
- `--split dev` or `--split test`: one part of the dataset
- `--rpm 15`: request budget per minute
- `--no-cache`: ignore the on-disk response cache

Reports are written to `evaluation/results/`. Each report records the model version, the sampling settings and the prompt versions, and lists every disagreement with the labels for error analysis.

Responses are cached in `evaluation/.cache/` (not committed), so an interrupted run continues where it stopped. Latency in a report comes only from calls that really went to the API.

## Limits of these results

- The dataset is small and mostly synthetic. One real CV is not enough to claim accuracy on real CVs in general.
- Synthetic CVs are short and clean. Real CVs are longer and messier, and PDF text extraction adds its own errors.
- The retrieval set has 31 jobs. Finding the right job among 31 is much easier than among thousands.
- The score shown to users (CV and vacancy match) is not model accuracy. They are different numbers.
