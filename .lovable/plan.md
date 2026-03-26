

## Rework Onboarding Step 4 + CDP-Ready User Attributes

### Overview
Replace the free-text "Health target" field on Step 4 (index 3) with a grouped multi-select of 20 health targets across 6 categories. Save selections as both `health_targets text[]` and a flattened `user_attributes jsonb` column on `profiles`. All labels loaded from `content_blocks`.

---

### 1. Database Migration

```sql
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS health_targets text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS user_attributes jsonb NOT NULL DEFAULT '{}';
```

No new RLS needed — existing "Users can update own profile" policy covers both columns.

### 2. Insert content_blocks (52 rows)

Insert `page='onboarding'`, `section='health_targets'`