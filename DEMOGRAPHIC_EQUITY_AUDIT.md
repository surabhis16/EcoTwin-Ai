# Demographic Equity & Bias Auditing

The fairness feature is basically an **audit layer** on top of the existing heat and material recommendation system.

The original system could say:

> This ward is hot, so prioritize it.

The new feature asks a second question:

> If two wards are both risky, are we accidentally giving lower priority to wards where more vulnerable or marginalized people live?

## What Data It Uses

It uses the ward demographic fields already stored in Supabase:

- `population`
- `male_population`
- `female_population`
- `sc_population`
- `st_population`
- `assembly_constituency`

It also uses environmental and model-related fields:

- `baseline_lst`
- `baseline_ndvi`
- `aqi`
- material cost, cooling, and carbon data

Since the table has SC/ST data, `SC + ST population share` is used as the marginalized-population proxy.

## What It Calculates

For every ward, the system calculates the following:

### 1. Exposure Score

Based on:

- heat
- low green cover
- AQI

### 2. Demographic Vulnerability Score

Based on:

- SC/ST population share
- gender-balance gap

### 3. Equity Priority Score

A combined score:

```text
exposure + demographic vulnerability
```

### 4. Heat Rank vs Equity Rank

This is the most important part.

Example:

```text
Ward A:
Heat-only rank: 52
Equity rank: 18
Rank gap: +34
```

This means the ward may not look like a top priority if we only sort by temperature, but once demographics are included, it should receive much higher attention.

## What "Bias" Means Here

The system is not saying the ML model is malicious or wrong. It is checking whether model outputs could lead to unfair planning decisions.

For example:

- A ward with high heat and high marginalized population should not be pushed down just because another wealthier ward is slightly hotter.
- Material recommendations should not only suggest expensive high-performance materials for vulnerable wards if affordable high-cooling alternatives exist.
- Assembly constituencies with repeated high-risk wards should be visible to planners.

## Where It Was Added

## Backend

### `equity_audit.py`

Contains the actual scoring logic:

- calculates ward equity metrics
- finds under-prioritized wards
- checks material affordability bias

### `equity.py`

Adds new APIs:

```text
GET /api/equity/audit
GET /api/equity/ward/{ward_id}
```

### `uhi_prediction.py`

Updated so that:

- ward baseline and simulation responses now include `equity_audit`
- hotspot results now include equity priority information

### `material_recommendation.py`

Updated so that:

- material recommendations now include `equity_notes`

## Frontend

### `equity-audit-panel.tsx`

Added as the new interactive UI for the feature.

It is available as a separate **Equity Audit** tab in the dashboard.

## How To Read The UI

In the **Equity Audit** tab:

- **Audited Wards**: number of wards checked
- **Flagged Wards**: wards where the audit found possible fairness concern
- **Avg SC/ST Share**: city-wide demographic baseline
- **Fair Materials**: share of materials that are both affordable and high-cooling

## Dropdowns

### Equity Priority

Shows wards ranked by combined heat and demographic risk.

### Under-Priority Watch

Shows wards that heat-only ranking may under-prioritize.

### Demographic Vulnerability

Focuses on SC/ST share and gender distribution.

### Material Bias

Checks whether material suggestions skew toward expensive options.

## In Simple Terms

This feature makes sure the system is not just optimizing for **maximum cooling**, but also checking whether cooling interventions are distributed fairly across Bengaluru's wards.
