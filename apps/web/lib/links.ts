// Canonical outbound links + identity for renderonce.dev — one source of truth
// so contact/credit links never fragment across pages.
//
// Identity hierarchy (keep the routing straight):
//   Zephyr Pixels      = Matthew's studio / umbrella
//   Sanity Migrations  = his services practice — routes to him (hello@zephyrpixels.dev),
//                        intentionally NOT linked from RenderOnce
//   RenderOnce         = open-source project under Zephyr Pixels, co-promoted with
//                        Fortivex — its inbound routes to Fortivex
//   Fortivex           = separate partner company ("in partnership with", never
//                        "a Fortivex project")

// TODO(confirm): repo may be renamed to a dedicated `renderonce` repository.
export const GITHUB_REPO_URL =
  'https://github.com/mematthew123/sanity-remotion-cloudinary-template';

// TODO(confirm with Greg): public Fortivex site.
export const FORTIVEX_URL = 'https://fortivex.com';

// TODO(confirm with Greg): how RenderOnce inbound should land — form, page, or
// mailto. This is the single "Work with me" / "Contact" destination for this site.
export const FORTIVEX_INTAKE_URL = 'https://fortivex.com/contact';

export const SANITY_MIGRATIONS_URL = 'https://www.sanitymigrations.com';

// TODO(confirm): link only if zephyrpixels.dev resolves to a real page.
export const ZEPHYR_PIXELS_URL = 'https://zephyrpixels.dev';
