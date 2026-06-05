INSERT INTO public.content_blocks (page, section, key, type, locale, value) VALUES
  ('coaching', 'reminder', 'title', 'text', 'en', 'Coaching call reminder'),
  ('coaching', 'reminder', 'body',  'text', 'en', 'Your call starts at {time}.'),
  ('coaching', 'reminder', 'title', 'text', 'fr', 'Rappel : appel de coaching'),
  ('coaching', 'reminder', 'body',  'text', 'fr', 'Votre appel commence à {time}.')
ON CONFLICT ON CONSTRAINT content_blocks_page_section_key_locale_unique DO NOTHING;