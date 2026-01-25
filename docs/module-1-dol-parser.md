# Module 1: DOL Parser

## Overview

This module processes DOL LCA disclosure data to create a database of H-1B sponsoring companies.

**Branch:** `feature/module-1-dol-parser`

---

## AWS Preprocessing Code

Run this in AWS SageMaker (instance: `ml.m5.2xlarge`):

### Complete Code (Single Cell)

```python
import pandas as pd
import boto3
import json

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

    df = df[[c for c in cols if c in df.columns]]
    df['QUARTER'] = q

    # Clean columns for filtering
    df['VISA_CLASS'] = df['VISA_CLASS'].fillna('').astype(str)
    df['SOC_CODE'] = df['SOC_CODE'].fillna('').astype(str)

    # Filter ONLY by visa and SOC code - NOT by CASE_STATUS!
    # This allows us to calculate real approval rates
    df = df[df['VISA_CLASS'].str.upper().str.contains('H-1B|E-3', na=False, regex=True)]
    df = df[df['SOC_CODE'].str.startswith('15-', na=False) | df['SOC_CODE'].str.contains('11-3021', na=False)]

    print(f"   After filtering: {len(df)} rows")
    all_data.append(df)

# Combine
print("\n🔗 Combining all quarters...")
combined = pd.concat(all_data, ignore_index=True)
print(f"✅ Total rows: {len(combined)}")

# Save filtered CSV
combined.to_csv('lca_filtered_2025.csv', index=False)
s3.upload_file('lca_filtered_2025.csv', bucket, 'lca_filtered_2025.csv')

# Show status breakdown
print("\n📊 Case Status breakdown:")
print(combined['CASE_STATUS'].value_counts())

# Aggregate by company with REAL approval rate
print("\n📊 Aggregating by company...")

def calc_approval(statuses):
    total = len(statuses)
    if total == 0:
        return 0.0
    certified = statuses.str.upper().str.contains('CERTIFIED').sum()
    return certified / total

company_stats = combined.groupby('EMPLOYER_NAME').agg({
    'CASE_NUMBER': 'count',
    'CASE_STATUS': calc_approval,
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
print(f"\n📊 Approval rate: Min={company_stats['approvalRate'].min():.1%}, Max={company_stats['approvalRate'].max():.1%}")

# Build companies list
companies = []
TIER_TOP, TIER_MIDDLE, TIER_LOWER, TIER_LOWEST = 1000, 500, 100, 50

for _, row in company_stats.iterrows():
    lca_count = int(row['lcaCount'])
    approval = float(row['approvalRate'])
    priority = lca_count * 0.5 + approval * 100 * 0.5
    q_counts = row['quarterCounts'] if isinstance(row['quarterCounts'], dict) else {}

    if lca_count >= TIER_TOP: tier = 'top'
    elif lca_count > TIER_MIDDLE: tier = 'middle'
    elif lca_count > TIER_LOWER: tier = 'lower'
    elif lca_count > TIER_LOWEST: tier = 'lowest'
    else: tier = 'below50'

    # Unique ID using name + state
    unique_id = f"{row['name']}_{row['state'] or 'NA'}".upper().replace(' ', '_')[:60]

    companies.append({
        'id': unique_id,
        'name': row['name'],
        'city': row['city'] if pd.notna(row['city']) else '',
        'state': row['state'] if pd.notna(row['state']) else '',
        'lcaCount': lca_count,
        'lcaQ1': q_counts.get('Q1', 0),
        'lcaQ2': q_counts.get('Q2', 0),
        'lcaQ3': q_counts.get('Q3', 0),
        'lcaQ4': q_counts.get('Q4', 0),
        'approvalRate': round(approval, 4),
        'priorityScore': round(priority, 2),
        'tier': tier,
        'pocFirstName': row['pocFirstName'] if pd.notna(row['pocFirstName']) else '',
        'pocLastName': row['pocLastName'] if pd.notna(row['pocLastName']) else '',
        'pocEmail': row['pocEmail'] if pd.notna(row['pocEmail']) else '',
        'pocPhone': str(row['pocPhone']) if pd.notna(row['pocPhone']) else '',
    })

# Sort and save
companies.sort(key=lambda x: x['priorityScore'], reverse=True)
tier_counts = {}
for c in companies:
    tier_counts[c['tier']] = tier_counts.get(c['tier'], 0) + 1

output = {
    'generatedAt': pd.Timestamp.now().isoformat(),
    'totalCompanies': len(companies),
    'tierCounts': tier_counts,
    'companies': companies
}

with open('companies.json', 'w') as f:
    json.dump(output, f, indent=2)

s3.upload_file('companies.json', bucket, 'companies.json')

print("\n📊 Tier breakdown:", tier_counts)
print("\n🏆 Top 5:")
for c in companies[:5]:
    print(f"   {c['name'][:40]} | LCAs: {c['lcaCount']} | Approval: {c['approvalRate']:.1%}")

print(f"\n💾 Uploaded companies.json to S3!")
```

---

## Key Points

1. **No CASE_STATUS filter** - All applications included for real approval rates
2. **Unique IDs** - Uses `name_state` to avoid duplicates
3. **5-tier classification** - top/middle/lower/lowest/below50

## Priority Score Formula

```
priorityScore = (LCA Count × 50%) + (Approval Rate × 100 × 50%)
```
