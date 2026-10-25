# OptiJob evaluation benchmark

Run the same small, human-labeled set of synthetic CV/job-description pairs through Gemini and Ollama. The examples cover explicit evidence, common equivalent terms, unsupported/aspirational mentions, and missing domain experience. No real CV or personal data is included.

From the `backend` directory, with the AI service and Ollama already running:

```powershell
npx tsx evaluation/benchmark.ts
```

The paired run uses all five examples for both providers and allows up to 30 minutes per Ollama request. Explicitly set these values, especially if benchmark variables were set in the current PowerShell window earlier:

```powershell
$env:BENCHMARK_PROVIDER = "both"
$env:BENCHMARK_CASE_LIMIT = "5"
$env:BENCHMARK_OLLAMA_TIMEOUT_SECONDS = "1800"
npx tsx evaluation/benchmark.ts
Remove-Item Env:BENCHMARK_PROVIDER, Env:BENCHMARK_CASE_LIMIT, Env:BENCHMARK_OLLAMA_TIMEOUT_SECONDS
```

To run only Ollama, set `BENCHMARK_PROVIDER` to `ollama`; use `gemini` to run only Gemini. Ollama generation is capped at 400 tokens for the benchmark process, without changing the application's `.env`.

Gemini uses the configured AI service at `AI_SERVICE_URL` (default `http://127.0.0.1:8000`). Ollama uses the configured model and the application's analysis function. The Ollama benchmark supplies each synthetic CV as one retrieved excerpt, so it measures analysis and evidence handling, not pgvector retrieval quality.

By default, the runner uses the same five examples for both providers, allows up to 30 minutes per Ollama request, and limits Ollama output to 400 tokens for this benchmark process only; it does not change the application's `.env`. Set `BENCHMARK_CASE_LIMIT` to change the sample count, `BENCHMARK_PROVIDER=gemini|ollama` to select one provider, or `BENCHMARK_OLLAMA_NUM_PREDICT` to change the benchmark-only Ollama output limit. The runner prints progress for every case.

The recorded paired run completed all five examples on both providers (55 labeled decisions each). Gemini (`configured AI service model`) scored 87.3% accuracy, 82.1% precision, 100% recall, and 90.1% F1 at 2.40 seconds mean latency. Ollama (`qwen3:4b`) scored 54.5% accuracy, 58.5% precision, 75% recall, and 65.8% F1 at 22.16 seconds mean latency. Both had 100% exact-quote validity; requirement coverage was 100% for Gemini and 92.7% for Ollama.

These results are a small synthetic smoke benchmark, not enough to claim general model accuracy on real résumés. Expand and manually review the labeled examples before publishing broad quality claims. The displayed CV-job match percentage is not model accuracy, and R² is not an appropriate metric for this classification task.
