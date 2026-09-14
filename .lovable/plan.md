# Set up Google Search Console for aos.carnivorex.app

Goal: get your site verified in Google Search Console so you can see how people find CarnivoreX in Google search, and make sure Google has your page list.

## Steps

1. Connect your Google account (a card will appear in chat for you to approve). This links the account that will own the Search Console property.
2. Request a verification code from Google for `https://aos.carnivorex.app/`.
3. Add that verification tag to the site's page head, and add a sitemap file listing the public pages if one isn't already valid for this address.
4. Publish the site once so both go live.
5. Ask Google to verify, add the property to your Search Console account, and submit the sitemap.
6. Confirm verification succeeded and report what Google shows.

## Notes

- Only one publish is needed — the verification tag and sitemap ship together.
- Nothing about the mobile apps changes; no rebuild and no Play Store resubmission.
- Existing page titles, descriptions, and indexing rules stay untouched.
- Search Console data starts accumulating after verification; expect a day or two before the first numbers appear.

## Technical details

- Verification method: `META` tag in `index.html` `<head>`, via the Site Verification API through the Google Search Console connector.
- Property type: URL-prefix (`SITE`) at `https://aos.carnivorex.app/`. No DNS record required. A broader domain-level property is optional and not part of this plan.
- Sitemap: `public/sitemap.xml` with the public routes (home, guide, recipes, pricing, coaching, legal pages), referenced from `public/robots.txt`; submitted to the verified property after publish.
