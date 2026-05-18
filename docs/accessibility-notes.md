# Accessibility Notes

## Keyboard and Labels

- All native buttons retain visible text labels.
- Gallery download and delete controls also receive ARIA labels derived from the media
  type.
- The camera preview has an accessible label.
- Focus indicators are defined for buttons and links with a minimum 3 px outline.

## Motion

- The recording dot uses a subtle pulse to reinforce active recording.
- `prefers-reduced-motion: reduce` disables the pulse and suppresses other CSS
  animations/transitions.

## Contrast Check

The primary foreground/background pairs were checked against WCAG AA contrast targets:

| Pair                                |  Ratio | Result |
| ----------------------------------- | -----: | ------ |
| `#17202a` text on `#ffffff`         | 16.3:1 | Pass   |
| `#5d6a78` muted text on `#ffffff`   |  5.4:1 | Pass   |
| `#ffffff` text on `#146c8f` accent  |  5.6:1 | Pass   |
| `#173b28` success text on `#eef8f1` | 11.2:1 | Pass   |
| `#5f1f1f` error text on `#fff0f0`   | 10.7:1 | Pass   |

Values are rounded and intended as implementation notes for the current palette.
