## FRAMEWORK-LOCAL (delivery-os)
This qa-test is specialized for the framework: its implementation surface is `scripts/` + `templates/hooks/` + `templates/githooks/` (see `.claude/.verify-config.json`), not `src/`. The verify-gate enforces independent verification on changes to those paths.
