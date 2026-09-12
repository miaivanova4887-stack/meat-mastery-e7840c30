UPDATE public.push_campaigns
SET steps = jsonb_set(
  steps,
  '{0,data}',
  jsonb_build_object(
    'path', steps->0->'data'->>'route',
    'route', steps->0->'data'->>'route'
  )
)
WHERE steps->0->'data'->>'route' IS NOT NULL;