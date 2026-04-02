

## Upload App Icon to Cloud Storage

### What
Upload the generated `public/icon-1024.png` (and optionally the 512px variant) to a cloud storage bucket so it can be served via a public URL.

### Steps

**1. Create a storage bucket** via migration

Create a public `app-assets` bucket for storing brand assets like icons.

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('app-assets', 'app-assets', true);
```

Add an RLS policy so anyone can read (public bucket) and only admins can upload:

```sql
CREATE POLICY "Public read access" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'app-assets');

CREATE POLICY "Admins can upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'app-assets' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'app-assets' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'app-assets' AND public.has_role(auth.uid(), 'admin'));
```

**2. Upload icons via script**

Use a one-time script to upload `public/icon-1024.png` and `public/app-icon-512.png` to the `app-assets` bucket under paths like `icons/icon-1024.png` and `icons/app-icon-512.png`.

**3. Result**

The icons will be publicly accessible at:
```
https://gueosugzlebbaijzcxgh.supabase.co/storage/v1/object/public/app-assets/icons/icon-1024.png
```

### Files changed

| Item | Action |
|------|--------|
| Migration | Create `app-assets` bucket + RLS policies |
| Script (one-time) | Upload 2 icon PNGs to storage |

