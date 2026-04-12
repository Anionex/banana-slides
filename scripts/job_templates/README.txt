banana-cli job templates

Templates in this directory:
1) full_generation_idea_single.jsonl
2) full_generation_outline_batch.jsonl
3) export_only_batch.jsonl
4) mixed_batch.jsonl
5) jobs_template.csv

How to use:
1. Copy one template to your own file.
2. Edit required fields:
   - export_only: replace project_id.
   - full_generation: adjust creation_type and prompt fields.
3. Optional fields:
   - template_image_path/reference_files/material_files must be absolute local paths if provided.
   - language: zh/en/ja/auto.
4. Run:
   ./banana-cli run jobs --file /ABS/PATH/jobs.jsonl --report /ABS/PATH/report.json

Notes:
- JSONL format: one JSON object per line.
- CSV format: use options_json for nested fields.
