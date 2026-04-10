# 2025 Festival Windows

Locked festival windows for the Jan–Dec 2025 training dataset.

| Festival | Active window | Stored `festival_name` |
|---|---|---|
| New Year | 2025-01-01 to 2025-01-01 | `New Year` |
| Pongal / Sankranti | 2025-01-12 to 2025-01-14 | `Pongal/Sankranti` |
| Ugadi | 2025-03-28 to 2025-03-30 | `Ugadi` |
| Raksha Bandhan | 2025-08-08 to 2025-08-09 | `Raksha Bandhan` |
| Ganesh Chaturthi | 2025-08-25 to 2025-08-27 | `Ganesh Chaturthi` |
| Navratri / Dussehra | 2025-09-30 to 2025-10-02 | `Navratri/Dussehra` |
| Deepavali | 2025-10-18 to 2025-10-20 | `Deepavali` |
| Christmas | 2025-12-24 to 2025-12-25 | `Christmas` |

## Locked rules

- Every date inside the active window stores that festival name in `festival_name`.
- Dates outside all festival windows store `None`.
- If overlap ever happens, keep the larger festival label instead of stacking festivals.

