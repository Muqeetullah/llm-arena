# LLM Arena design system

## Product context

LLM Arena lets a person send one prompt to as many as three free AI models, watch their answers stream independently, compare real latency and token metrics, and vote for the best response. The main job is comparative reading and judgment. The interface must never visually favor one model before a vote.

Primary pages are the Arena workspace, a global/personal leaderboard, and a model catalog. This first design targets the Arena workspace while establishing the shared shell.

## Visual direction: Coffeehouse scorecard

The product is warm and editorial enough to feel human, but structured and precise enough to make model comparisons trustworthy. It should resemble a focused evaluation workspace or publication scorecard—not a generic SaaS dashboard and not a neon AI demo.

Use flat color, fine rules, compact data, generous reading space, and restrained emphasis. Do not use gradients, glows, glass effects, decorative illustrations, oversized pills, purple, indigo, or blue accents.

## Color tokens

The application has one light theme. Do not introduce dark-mode tokens, a theme toggle, or system-dependent color behavior.

| Role    | Value     | Usage                                                   |
| ------- | --------- | ------------------------------------------------------- |
| Page    | `#F7F0E8` | App background                                          |
| Surface | `#FFF9F4` | Sidebar, cards, composer                                |
| Raised  | `#F1E5DA` | Hover and selected-neutral surfaces                     |
| Border  | `#D8C3B4` | Dividers and component outlines                         |
| Text    | `#2C1A13` | Primary copy                                            |
| Muted   | `#725C50` | Secondary copy                                          |
| Rust    | `#B44318` | Interactions only: buttons, links, focus, win-rate bars |
| Winner  | `#287446` | Winner state only                                       |
| Error   | `#B43A32` | Error state only                                        |

Rust is never decorative. Green is never used before a winner is selected. Red is never used outside errors. Model identity is neutral—no provider colors.

## Typography

- Use Geist Sans for the wordmark, navigation, headings, response content, and controls.
- Use Geist Mono only for latency, throughput, tokens, rank, win records, compact identifiers, and timestamps.
- Page title: 28–32px, 650–700 weight, tight tracking.
- Section title: 18–20px, 600–650 weight.
- Body/model response: 15–16px, 1.65–1.75 line-height.
- UI labels: 12–14px, 500–600 weight.
- Metrics: 11–13px Geist Mono.

## Shape, spacing, and depth

- Use an 8px spacing base with 4px for fine internal adjustments.
- Controls use 12px corners; panels use 16px corners.
- Use borders, spacing, and weight for hierarchy.
- Shadows are rare and shallow. Do not create floating glass cards.
- Use a consistent outline icon style at 16–20px. Primary navigation keeps visible text labels.

## Arena layout

- Desktop is a full-height workspace with a fixed 232–248px sidebar, a compact 64px top bar, a scrollable conversation body, and a bottom composer.
- The arena is the visual centerpiece. Keep navigation quiet.
- A thread header names the comparison and shows neutral per-model win records.
- The prompt appears as a compact right-aligned message above the responses.
- On wide screens, model answers appear in equal-width columns. Align their headers and metric footers so differences are easy to scan.
- Each response header contains a neutral initial avatar, model name, status, and a vote action that is unavailable until at least two responses finish.
- Metrics are collapsed by default and reveal time-to-first-token, tokens per second, and total tokens.
- The bottom composer includes selected-model chips, an Add model control, multiline prompt input, keyboard hint, and a rust send button.
- On narrow screens, the sidebar becomes a drawer, response columns stack at readable width, and the composer stays in normal document flow or sticky without covering content.

## States and accessibility

- Before voting, all model cards are visually equal.
- Streaming, complete, failed, and winner states use labels and icons in addition to permissible color.
- After a vote, add a clear Winner label and a restrained green border to the selected response; keep every losing answer fully legible.
- Use visible rust focus rings outside controls and preserve at least WCAG AA contrast for body copy and controls.
- Touch targets are at least 44px where space permits.
- Motion is functional and 120–180ms. A streaming caret may pulse subtly. Respect reduced-motion preferences.

## Content for the first screen

Use realistic comparison content rather than placeholders:

- Thread: “Explain quantum entanglement simply”
- Models: Llama 3.3 70B, Gemma 3 27B, Mistral Small 3.1
- User prompt: “Explain quantum entanglement like I’m a curious high-school student. Use one analogy and avoid equations.”
- Show three distinct completed sample answers of moderate length.
- Surface realistic metrics beneath each answer.
- Sidebar includes Arena, Leaderboard, Models, New comparison, and three recent threads.

The initial implementation is a polished UI demonstration. Interactions may use local client state, but it must not fabricate persistence or claim that live model calls are already wired into this screen.
