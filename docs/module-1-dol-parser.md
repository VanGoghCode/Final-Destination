# Module 1: DOL Parser

## Overview

This module processes DOL LCA disclosure data to create a database of H-1B sponsoring companies.

**Branch:** `feature/module-1-dol-parser`

---

## AWS Preprocessing Code

Run this in AWS SageMaker (instance: `ml.m5.2xlarge`):

### Cell 1: Download and Combine All Quarters

```python
import pandas as pd
import boto3

# Config
bucket = 'job-alert-data'  # Your bucket name
s3 = boto3.client('s3')

# Columns to keep
cols = [
    'CASE_NUMBER', 'CASE_STATUS', 'VISA_CLASS', 'JOB_TITLE',
    'SOC_CODE', 'SOC_TITLE', 'EMPLOYER_NAME', 'EMPLOYER_CITY',
    'EMPLOYER_STATE', 'EMPLOYER_COUNTRY', 'WORKSITE_CITY',
    'WORKSITE_STATE', 'WAGE_RATE_OF_PAY_FROM', 'WAGE_RATE_OF_PAY_TO',
    'WAGE_UNIT_OF_PAY', 'EMPLOYER_POC_FIRST_NAME',
    'EMPLOYER_POC_LAST_NAME', 'EMPLOYER_POC_EMAIL', 'EMPLOYER_POC_PHONE'
]

quarters = ['Q1', 'Q2', 'Q3', 'Q4']
all_data = []

for q in quarters:
    filename = f'LCA_Disclosure_Data_FY2025_{q}.xlsx'
    local_file = f'lca_{q}.xlsx'

    print(f"\n📥 Downloading {filename}...")
    try:
        s3.download_file(bucket, filename, local_file)
    except Exception as e:
        print(f"⚠️ Could not download {filename}: {e}")
        continue

    print(f"📖 Reading {q}...")
    df = pd.read_excel(local_file)
    print(f"   Loaded {len(df)} rows")

    # Select columns
    df = df[[c for c in cols if c in df.columns]]

    # Add quarter column
    df['QUARTER'] = q

    # Filter
    df['CASE_STATUS'] = df['CASE_STATUS'].fillna('').astype(str)
    df['VISA_CLASS'] = df['VISA_CLASS'].fillna('').astype(str)
    df['SOC_CODE'] = df['SOC_CODE'].fillna('').astype(str)

    df = df[df['CASE_STATUS'].str.upper().str.contains('CERTIFIED', na=False)]
    df = df[df['VISA_CLASS'].str.upper().str.contains('H-1B|E-3', na=False, regex=True)]
    df = df[df['SOC_CODE'].str.startswith('15-', na=False) | df['SOC_CODE'].str.contains('11-3021', na=False)]

    print(f"   After filtering: {len(df)} rows")
    all_data.append(df)

# Combine all quarters
print("\n🔗 Combining all quarters...")
combined = pd.concat(all_data, ignore_index=True)
print(f"✅ Total rows: {len(combined)}")

# Show quarter breakdown
print("\n📊 Rows per quarter:")
print(combined['QUARTER'].value_counts().sort_index())

# Save and upload
combined.to_csv('lca_filtered_2025.csv', index=False)
s3.upload_file('lca_filtered_2025.csv', bucket, 'lca_filtered_2025.csv')
print(f"\n💾 Uploaded lca_filtered_2025.csv to S3!")
```

### Cell 2: Aggregate by Company

```python
print("📊 Aggregating by company...")

# Group by employer name
company_stats = combined.groupby('EMPLOYER_NAME').agg({
    'CASE_NUMBER': 'count',
    'CASE_STATUS': lambda x: (x.str.upper().str.contains('CERTIFIED')).mean(),
    'EMPLOYER_CITY': 'first',
    'EMPLOYER_STATE': 'first',
    'EMPLOYER_POC_FIRST_NAME': 'first',
    'EMPLOYER_POC_LAST_NAME': 'first',
    'EMPLOYER_POC_EMAIL': 'first',
    'EMPLOYER_POC_PHONE': 'first',
    'QUARTER': lambda x: x.value_counts().to_dict()
}).reset_index()

company_stats.columns = ['name', 'lcaCount', 'approvalRate', 'city', 'state',
                          'pocFirstName', 'pocLastName', 'pocEmail', 'pocPhone', 'quarterCounts']

print(f"✅ Found {len(company_stats)} unique companies")
```

### Cell 3: Create Companies with 5-Tier Classification

```python
companies = []

# Tier thresholds
TIER_TOP = 1000       # >= 1000
TIER_MIDDLE = 500     # 500 < x < 1000
TIER_LOWER = 100      # 100 < x <= 500
TIER_LOWEST = 50      # 50 < x <= 100
                      # <= 50 = below50

for _, row in company_stats.iterrows():
    lca_count = int(row['lcaCount'])
    approval = float(row['approvalRate'])
    priority = lca_count * 0.5 + approval * 100 * 0.5

    q_counts = row['quarterCounts'] if isinstance(row['quarterCounts'], dict) else {}

    # Determine tier
    if lca_count >= TIER_TOP:
        tier = 'top'
    elif lca_count > TIER_MIDDLE:
        tier = 'middle'
    elif lca_count > TIER_LOWER:
        tier = 'lower'
    elif lca_count > TIER_LOWEST:
        tier = 'lowest'
    else:
        tier = 'below50'

    company = {
        'id': row['name'].upper().replace(' ', '_')[:50],
        'name': row['name'],
        'city': row['city'] if pd.notna(row['city']) else '',
        'state': row['state'] if pd.notna(row['state']) else '',
        'lcaCount': lca_count,
        'lcaQ1': q_counts.get('Q1', 0),
        'lcaQ2': q_counts.get('Q2', 0),
        'lcaQ3': q_counts.get('Q3', 0),
        'lcaQ4': q_counts.get('Q4', 0),
        'approvalRate': round(approval, 2),
        'priorityScore': round(priority, 2),
        'tier': tier,
        'pocFirstName': row['pocFirstName'] if pd.notna(row['pocFirstName']) else '',
        'pocLastName': row['pocLastName'] if pd.notna(row['pocLastName']) else '',
        'pocEmail': row['pocEmail'] if pd.notna(row['pocEmail']) else '',
        'pocPhone': str(row['pocPhone']) if pd.notna(row['pocPhone']) else '',
    }
    companies.append(company)
```

### Cell 4: Save and Upload

```python
import json

# Sort by priority
companies.sort(key=lambda x: x['priorityScore'], reverse=True)

# Count by tier
tier_counts = {}
for c in companies:
    tier_counts[c['tier']] = tier_counts.get(c['tier'], 0) + 1

# Create output
output = {
    'generatedAt': pd.Timestamp.now().isoformat(),
    'totalCompanies': len(companies),
    'tierCounts': {
        'top': tier_counts.get('top', 0),
        'middle': tier_counts.get('middle', 0),
        'lower': tier_counts.get('lower', 0),
        'lowest': tier_counts.get('lowest', 0),
        'below50': tier_counts.get('below50', 0),
    },
    'companies': companies
}

# Save locally
with open('companies.json', 'w') as f:
    json.dump(output, f, indent=2)

# Upload to S3
s3.upload_file('companies.json', bucket, 'companies.json')

print("📊 Tier breakdown:")
print(f"   Top (≥1000):      {tier_counts.get('top', 0)}")
print(f"   Middle (501-999): {tier_counts.get('middle', 0)}")
print(f"   Lower (101-500):  {tier_counts.get('lower', 0)}")
print(f"   Lowest (51-100):  {tier_counts.get('lowest', 0)}")
print(f"   Below 50 (≤50):   {tier_counts.get('below50', 0)}")
print(f"\n💾 Uploaded companies.json to S3!")
```

---

## Output

| File                    | Location           | Description              |
| ----------------------- | ------------------ | ------------------------ |
| `lca_filtered_2025.csv` | S3 + local `data/` | Filtered LCA data (91MB) |
| `companies.json`        | S3 + local `data/` | 33,682 companies (15MB)  |

---

## Tier Classification

| Tier      | LCA Range | Description               |
| --------- | --------- | ------------------------- |
| `top`     | ≥1000     | Highest priority scraping |
| `middle`  | 501-999   | High priority             |
| `lower`   | 101-500   | Medium priority           |
| `lowest`  | 51-100    | Low priority              |
| `below50` | ≤50       | Occasional scraping       |

---

## Priority Score Formula

```
priorityScore = (LCA Count × 50%) + (Approval Rate × 50%)
```
