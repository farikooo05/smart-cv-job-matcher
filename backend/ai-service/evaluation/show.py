"""Print the headline numbers and the disagreements of a saved analysis report."""
import json
import sys

report = json.load(open(sys.argv[1], encoding="utf-8"))
sys.stdout.reconfigure(encoding="utf-8")
print("model", report["model_versions"], report["generation_config"], "cases", report["cases"], "labels", report["labelled_requirements"])
for key in ("assessment", "extraction"):
    print(key, json.dumps(report[key], ensure_ascii=False))
print("end_to_end", json.dumps({k: v for k, v in report["end_to_end"].items() if k != "scores"}))
print("scores", " ".join(f'{k}:{v["golden"]}/{v["predicted"]}' for k, v in report["end_to_end"]["scores"].items()))
print("calls", json.dumps(report["calls"]))
for item in report["disagreements"]:
    print("-", item["case"], "|", item["requirement"][:48], "| exp", item["expected"], "| assess", item["assessment"], "| e2e", item["end_to_end"],
          "| as", item["extracted_as"], "| ev:", item["evidence"][:60], "| adv:", item["advice"][:80])
print("extra", json.dumps(report["extra_requirements_by_case"], ensure_ascii=False))
