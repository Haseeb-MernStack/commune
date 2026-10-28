# Design system

**Idea: colour belongs to people.** The interface is quiet (chalk, ink, midnight blue, one marigold highlight).
Colour comes from people and places: every name gets one of eight hues (`src/lib/hue.ts`) used for avatars and
community chips.

- Tokens live at the top of `src/styles/theme.css` (light and dark). Change `--accent` or `--gold` there and the
  whole app follows.
- Type: Bricolage Grotesque (variable, self-hosted through `@fontsource-variable/bricolage-grotesque`) for the
  logo, titles and numbers; the system font for reading text.
- Icons: one outline set in `src/components/Icon.tsx` (add a path to extend it). No emoji in the interface.
- Layout: posts form one continuous timeline; desktop has left menu / timeline / right column (search and news);
  phones get a bottom tab bar and edge-to-edge posts.
- Brand mark: `src/components/BrandMark.tsx`. App icons (PWA) were regenerated from the same mark.
