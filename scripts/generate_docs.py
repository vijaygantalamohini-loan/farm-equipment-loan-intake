#!/usr/bin/env python3
"""
Update auto-generated sections in /docs based on the current codebase.
"""

from __future__ import annotations

import ast
import re
from collections import defaultdict
from pathlib import Path
from typing import Dict, Iterable, List, Sequence, Tuple


ROOT = Path(__file__).resolve().parents[1]
DOCS_DIR = ROOT / "docs"

ROUTE_RE = re.compile(r"@router\.(get|post|put|patch|delete|options|head)\(\s*['\"]([^'\"]*)['\"]")
APP_RE = re.compile(r"@app\.(get|post|put|patch|delete|options|head)\(\s*['\"]([^'\"]*)['\"]")
PREFIX_RE = re.compile(r"APIRouter\(\s*prefix\s*=\s*['\"]([^'\"]*)['\"]")


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")


def _write(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8", newline="\n")


def _replace_block(text: str, start: str, end: str, new_lines: Sequence[str]) -> str:
    pattern = re.compile(re.escape(start) + r".*?" + re.escape(end), re.S)
    replacement = "\n".join([start, *new_lines, end])
    if not pattern.search(text):
        raise ValueError(f"Missing markers: {start} ... {end}")
    return pattern.sub(lambda _: replacement, text)


def _join_prefix(prefix: str, path: str) -> str:
    base = prefix.rstrip("/") if prefix else ""
    if path in ("", "/"):
        return base or "/"
    if not path.startswith("/"):
        path = "/" + path
    return f"{base}{path}" if base else path


def _collect_routes() -> List[Tuple[str, str]]:
    routes: List[Tuple[str, str]] = []
    router_dir = ROOT / "loan-intake-backend" / "routers"
    router_files = sorted(p for p in router_dir.glob("*.py") if p.name != "__init__.py")
    extra_files = [
        ROOT / "loan-intake-backend" / "ai_prequalification" / "routes.py",
        ROOT / "loan-intake-backend" / "equipment_intelligence" / "api" / "routes.py",
    ]
    for path in [*router_files, *extra_files]:
        if not path.exists():
            continue
        text = _read(path)
        prefix_match = PREFIX_RE.search(text)
        prefix = prefix_match.group(1) if prefix_match else ""
        for method, route in ROUTE_RE.findall(text):
            routes.append((method.upper(), _join_prefix(prefix, route)))

    main_path = ROOT / "loan-intake-backend" / "main.py"
    if main_path.exists():
        text = _read(main_path)
        for method, route in APP_RE.findall(text):
            routes.append((method.upper(), route))

    seen = set()
    unique = []
    for method, path in routes:
        if (method, path) in seen:
            continue
        seen.add((method, path))
        unique.append((method, path))
    return unique


def _group_routes(routes: Sequence[Tuple[str, str]]) -> Dict[str, List[Tuple[str, str]]]:
    grouped: Dict[str, List[Tuple[str, str]]] = defaultdict(list)
    for method, path in routes:
        if path == "/" or path.count("/") == 1:
            prefix = "/"
        else:
            prefix = "/" + path.strip("/").split("/")[0]
        grouped[prefix].append((method, path))
    for prefix in grouped:
        grouped[prefix].sort(key=lambda item: (item[0], item[1]))
    return dict(grouped)


def _format_routes_block() -> List[str]:
    order = [
        "/ocr",
        "/lookup",
        "/address",
        "/dealers",
        "/auth",
        "/loans",
        "/lenders",
        "/equipment",
        "/prequalify",
        "/admin",
        "/health",
        "/",
    ]
    grouped = _group_routes(_collect_routes())
    prefixes = [p for p in order if p in grouped]
    prefixes.extend(sorted(p for p in grouped if p not in prefixes))

    lines: List[str] = []
    for prefix in prefixes:
        lines.append(f"- `{prefix}`")
        for method, path in grouped[prefix]:
            lines.append(f"  - `{method} {path}`")
    return lines


def _parse_database_models(path: Path) -> List[Dict[str, object]]:
    tree = ast.parse(_read(path))
    models = []
    for node in tree.body:
        if not isinstance(node, ast.ClassDef):
            continue
        if not any(isinstance(base, ast.Name) and base.id == "Base" for base in node.bases):
            continue
        table = None
        columns: List[Dict[str, object]] = []
        for stmt in node.body:
            if isinstance(stmt, ast.Assign) and len(stmt.targets) == 1:
                target = stmt.targets[0]
                if isinstance(target, ast.Name) and target.id == "__tablename__":
                    if isinstance(stmt.value, ast.Constant) and isinstance(stmt.value.value, str):
                        table = stmt.value.value
                if isinstance(target, ast.Name) and isinstance(stmt.value, ast.Call):
                    if isinstance(stmt.value.func, ast.Name) and stmt.value.func.id == "Column":
                        columns.append(_parse_column(target.id, stmt.value))
        if table:
            models.append({"table": table, "columns": columns})
    return models


def _parse_column(name: str, call: ast.Call) -> Dict[str, object]:
    type_name = None
    fk_target = None
    for arg in call.args:
        if isinstance(arg, ast.Call) and isinstance(arg.func, ast.Name) and arg.func.id == "ForeignKey":
            if arg.args and isinstance(arg.args[0], ast.Constant) and isinstance(arg.args[0].value, str):
                fk_target = arg.args[0].value
        elif isinstance(arg, ast.Name):
            type_name = arg.id
        elif isinstance(arg, ast.Call) and isinstance(arg.func, ast.Name):
            type_name = arg.func.id

    type_map = {
        "Integer": "int",
        "String": "string",
        "DateTime": "datetime",
        "Boolean": "boolean",
        "JSON": "json",
        "Text": "text",
        "Float": "float",
    }
    type_label = type_map.get(type_name or "", (type_name or "string").lower())

    primary_key = False
    for keyword in call.keywords:
        if keyword.arg == "primary_key" and isinstance(keyword.value, ast.Constant):
            primary_key = bool(keyword.value.value)

    return {
        "name": name,
        "type": type_label,
        "primary_key": primary_key,
        "foreign_key": fk_target,
    }


def _format_erd_block() -> List[str]:
    db_path = ROOT / "loan-intake-backend" / "database.py"
    if not db_path.exists():
        return []
    models = _parse_database_models(db_path)

    rel_labels = {
        ("VENDORS", "LOCATIONS"): "has",
        ("LOCATIONS", "SALESPEOPLE"): "employs",
        ("LOCATIONS", "LOAN_APPLICATIONS"): "submits",
        ("SALESPEOPLE", "LOAN_APPLICATIONS"): "submits",
        ("LENDERS", "LENDER_PREFERENCES"): "has",
        ("LENDERS", "LENDER_MATCHES"): "receives",
        ("LOAN_APPLICATIONS", "LENDER_MATCHES"): "matched",
    }

    relationships = []
    for model in models:
        source = str(model["table"]).upper()
        for col in model["columns"]:
            fk_target = col.get("foreign_key")
            if not fk_target:
                continue
            target = fk_target.split(".")[0].upper()
            relationships.append((target, source))
    unique_relationships = []
    seen = set()
    for pair in relationships:
        if pair in seen:
            continue
        seen.add(pair)
        unique_relationships.append(pair)

    lines: List[str] = []
    lines.append("```mermaid")
    lines.append("erDiagram")
    for model in models:
        table = str(model["table"]).upper()
        lines.append(f"    {table} {{")
        for col in model["columns"]:
            label = f"{col['type']} {col['name']}"
            if col.get("primary_key"):
                label += " PK"
            if col.get("foreign_key"):
                label += " FK"
            lines.append(f"        {label}")
        lines.append("    }")
        lines.append("")
    for target, source in unique_relationships:
        label = rel_labels.get((target, source), "has")
        lines.append(f"    {target} ||--o{{ {source} : {label}")
    lines.append("```")
    return lines


def _find_todos() -> List[Tuple[str, int, str]]:
    results = []
    for base in [ROOT / "loan-intake-backend", ROOT / "loan-intake-frontend"]:
        for path in base.rglob("*"):
            if "node_modules" in path.parts or ".venv" in path.parts or ".git" in path.parts:
                continue
            if not path.is_file():
                continue
            if path.suffix not in {".py", ".js", ".md"}:
                continue
            for idx, line in enumerate(_read(path).splitlines(), start=1):
                if "TODO" in line:
                    results.append((str(path.relative_to(ROOT)), idx, line.strip()))
    return results


def _format_roadmap_planned() -> List[str]:
    todos = _find_todos()
    lines = []
    if any("ARCHITECTURE_AZURE_AD.md" in path and "Rate Limiting" in text for path, _, text in todos):
        lines.append("- Add API rate limiting middleware (noted as TODO in `loan-intake-backend/ARCHITECTURE_AZURE_AD.md`).")
    if any("LenderPreferences.js" in path and "TODO" in text for path, _, text in todos):
        lines.append("- Wire lender preference UI to the backend (TODO in `loan-intake-frontend/src/components/LenderPreferences.js`):")
        lines.append("  - Persist preferences via `POST /lenders/{id}/preferences`.")
        lines.append("  - Load existing preferences via `GET /lenders/{id}/preferences`.")
    if not lines:
        lines.append("- No explicit TODO items detected.")
    return lines


def _format_roadmap_placeholders() -> List[str]:
    pref_path = ROOT / "loan-intake-frontend" / "src" / "components" / "LenderPreferences.js"
    if pref_path.exists() and "SAMPLE_LENDERS" in _read(pref_path):
        return [
            "- Replace `SAMPLE_LENDERS` in `loan-intake-frontend/src/components/LenderPreferences.js` with real lender data from `/lenders`.",
        ]
    return ["- None detected."]


def _format_async_clients() -> List[str]:
    lines = []
    for path in sorted((ROOT / "loan-intake-backend").rglob("*.py")):
        if "httpx.AsyncClient" in _read(path):
            lines.append(f"  - `{path.relative_to(ROOT)}`")
    return lines


def main() -> None:
    arch_path = DOCS_DIR / "ARCHITECTURE.md"
    erd_path = DOCS_DIR / "DATA_MODEL_ERD.md"
    roadmap_path = DOCS_DIR / "ROADMAP.md"
    scaling_path = DOCS_DIR / "SCALING.md"

    arch = _read(arch_path)
    arch = _replace_block(
        arch,
        "<!-- AUTO-GENERATED: API_ROUTES_START -->",
        "<!-- AUTO-GENERATED: API_ROUTES_END -->",
        _format_routes_block(),
    )
    _write(arch_path, arch)

    erd = _read(erd_path)
    erd = _replace_block(
        erd,
        "<!-- AUTO-GENERATED: ERD_START -->",
        "<!-- AUTO-GENERATED: ERD_END -->",
        _format_erd_block(),
    )
    _write(erd_path, erd)

    roadmap = _read(roadmap_path)
    roadmap = _replace_block(
        roadmap,
        "<!-- AUTO-GENERATED: ROADMAP_PLANNED_START -->",
        "<!-- AUTO-GENERATED: ROADMAP_PLANNED_END -->",
        _format_roadmap_planned(),
    )
    roadmap = _replace_block(
        roadmap,
        "<!-- AUTO-GENERATED: ROADMAP_PLACEHOLDERS_START -->",
        "<!-- AUTO-GENERATED: ROADMAP_PLACEHOLDERS_END -->",
        _format_roadmap_placeholders(),
    )
    _write(roadmap_path, roadmap)

    scaling = _read(scaling_path)
    scaling = _replace_block(
        scaling,
        "<!-- AUTO-GENERATED: ASYNC_CLIENTS_START -->",
        "<!-- AUTO-GENERATED: ASYNC_CLIENTS_END -->",
        _format_async_clients(),
    )
    _write(scaling_path, scaling)


if __name__ == "__main__":
    main()
