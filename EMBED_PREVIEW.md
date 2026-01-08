# Discord Embed Preview

This document shows what the match notification embed will look like in Discord.

## Enhanced Embed Features

### 🎨 Visual Design
The embed uses a professional, game-like design with:
- **Rich Color Scheme**: Blue (#3498db) for victories, Red (#e74c3c) for defeats
- **Champion Icons**: Official League of Legends champion portraits
- **Item Display**: Actual item images from the game
- **Visual Score Bar**: 20-segment progress bar with color coding:
  - 🟩 Green: 80-100 points (Excellent)
  - 🟨 Yellow: 60-79 points (Good)
  - 🟧 Orange: 40-59 points (Average)
  - 🟥 Red: 0-39 points (Poor)

### 📊 Embed Structure

```
┌─────────────────────────────────────────────────┐
│ [Champion Icon] PlayerName#TAG                  │  ← Author with champion icon
│                                                 │
│ 🏆 VICTORY - ⚔️ Ranked Solo/Duo                │  ← Title
│                                        [Champ]  │  ← Thumbnail (large champion icon)
│ Ahri • Level 18 • 32m 15s                      │  ← Description
│                                                 │
│ ━━━━━━━━━━━━━ 📊 PERFORMANCE SCORE ━━━━━━━━━━━│
│ 🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩⬜⬜⬜⬜⬜           │  ← Visual score bar
│ **85/100 Points**                               │
│                                                 │
│ **═══════════ YOUR STATS ═══════════**         │  ← Section header
│                                                 │
│ ⚔️ KDA              🎯 Kill Participation       │
│ ```                 ```                         │
│ 12 / 3 / 18         73.5%                      │
│ Ratio: 10.00        ```                         │
│ ```                                             │
│                                                 │
│ 🗡️ Creep Score      💥 Damage                   │
│ ```                 ```                         │
│ 245 CS              28,450                      │
│ 7.6/min             882/min                     │
│ ```                 ```                         │
│                                                 │
│ 👁️ Vision Score     💰 Gold                     │
│ ```                 ```                         │
│ 45                  14,230                      │
│ 1.4/min             ```                         │
│ ```                                             │
│                                                 │
│ 🎒 Items                                        │
│ [item1] [item2] [item3] [item4] [item5] [item6]│  ← Item images displayed
│                                                 │
│ **═══════════ TEAM COMPOSITIONS ═══════════**  │  ← Section header
│                                                 │
│ 🔵 Allied Team (Victory)    🔴 Enemy Team       │
│ ```                         ```                 │
│ **➤ Ahri: 12/3/18**         Zed: 8/7/5        │  ← Your stats highlighted
│   Garen: 5/4/12             Darius: 3/8/4      │
│   Jinx: 14/2/9              Caitlyn: 6/9/3     │
│   Thresh: 1/5/24            Leona: 2/11/7      │
│   Lee Sin: 3/6/15           Elise: 4/10/6      │
│ ```                         ```                 │
│                                                 │
│ [LoL Icon] Match ID: EUW1_1234567890           │  ← Footer
│ Jan 8, 2026 at 6:30 PM                         │
└─────────────────────────────────────────────────┘
```

## Key Features

### 1. **Player-Centric Design**
Your stats are displayed prominently with:
- Large, clear formatting in code blocks
- Highlighted name in team composition (➤ marker)
- All personal statistics front and center

### 2. **Item Visualization**
Items are displayed as inline images using Discord's markdown image syntax:
- Empty slots are hidden (only shows purchased items)
- Items appear in order (0-6 slots)
- Visual representation matches in-game inventory

### 3. **Team Context**
Both teams are shown side-by-side so you can:
- Compare team performances at a glance
- See who carried or fed
- Understand the overall game flow
- Your row is marked with **➤** and bold formatting

### 4. **Clean Sections**
The embed uses visual separators:
- `━━━━━━━━━━━━━━` for major sections
- `═══════════` for subsections
- Code blocks (```) for stat grouping
- Empty fields (`\u200b`) for spacing

### 5. **Professional Icons**
All images are sourced from official Riot Data Dragon CDN:
- Champion icons (120x120 px)
- Item icons (64x64 px)
- Consistent with League of Legends client

## Performance Score Breakdown

The visual score bar changes color based on performance:

```
🟥🟥🟥🟥🟥⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜  25/100 (Poor - Red)
🟧🟧🟧🟧🟧🟧🟧🟧🟧🟧⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜  50/100 (Average - Orange)
🟨🟨🟨🟨🟨🟨🟨🟨🟨🟨🟨🟨🟨🟨⬜⬜⬜⬜⬜⬜  70/100 (Good - Yellow)
🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩⬜⬜  90/100 (Excellent - Green)
```

## Example Scenarios

### Victory with High Score
- Blue color (#3498db)
- Green score bar (85+ points)
- "🏆 VICTORY" title
- "Allied Team (Victory)" / "Enemy Team (Defeat)"

### Defeat with Low Score
- Red color (#e74c3c)
- Red/Orange score bar (30-50 points)
- "💀 DEFEAT" title
- "Allied Team (Defeat)" / "Enemy Team (Victory)"

## Technical Implementation

The embed uses:
- **Discord.js EmbedBuilder** for structure
- **Data Dragon CDN** for all images
- **Unicode characters** for visual elements
- **Code blocks** for clean stat display
- **Inline fields** for compact layouts
- **Zero-width space** (`\u200b`) for separators

This creates a professional, game-like notification that players will love to receive!
