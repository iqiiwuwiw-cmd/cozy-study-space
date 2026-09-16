# Cozy Space 🐱

A cozy personal study room in your browser to help you focus, listen to lo-fi, and keep track of your study sessions.

I built this room because I wanted a calm, aesthetic place to sit down and study without getting distracted by a dozen open tabs or complicated productivity apps. It has everything I actually use during a study session: ambient soundscapes, a pomodoro timer, a little bookshelf for study links, quick scratchpad notes, and a pixel cat that hangs out on the desk with you.

Zero build steps. Zero frameworks. Just HTML, CSS, and vanilla JavaScript.

---

## Quick Start (Copy & Run)

Grab the repository and jump straight in:

```bash
# clone the repo
git clone https://github.com/iqiiwuwiw-cmd/cozy-study-space.git

# move into the room
cd cozy-study-space

# start a quick local server (recommended for smooth audio & storage)
python3 -m http.server 8000
```

Now open `http://localhost:8000` in your browser!

> **Prefer not to use terminal?** You can also just download the ZIP, extract it, and double-click `index.html`. It works right away! Running a local server is just nicer because browsers handle audio autoplay and IndexedDB storage much better over `http://` than `file://`.

---

## Features

- **Pixel cat companion** 🐾 that reacts to your study timer, wiggles its tail, and purrs when petted
- **Lo-fi radio & soundboard**: built-in lo-fi tracks plus ambient layers for rain, cafe chatter, fireplace, and morning birds
- **Custom track uploads**: drag and drop your own study playlists — tracks get saved right into your browser's IndexedDB so they stay loaded next time you visit
- **Cozy bookshelf**: organize cheat sheets, lecture slides, video links, and PDFs by color and subject
- **Focus mode** ☾: one keystroke hides all the UI buttons so you can just look at your desk and study
- **Daily planner & study goals**: track tasks and study cycles with automatic pomodoro progress sync
- **Level & XP system**: gain XP as you complete sessions, cross off goals, and pet the cat
- **Four room themes**: switch between Cozy Night, Rainy Window, Sakura Morning, and Dark Academia
- **Backup & restore**: export everything to a single `.json` file anytime and restore it on any computer

---

## Keyboard Shortcuts

I use these all the time so I don't have to reach for my mouse while typing notes:

| Key | What it does |
| :--- | :--- |
| <kbd>Space</kbd> | Start or pause your study timer |
| <kbd>F</kbd> | Toggle deep focus mode ☾ |
| <kbd>Escape</kbd> | Close any open modal (books, goals, custom timer) |

---

## Project Tour

Here's how everything is organized under the hood:

```text
cozy-study-space/
├── index.html       # the entire study room, landing page, and modals
├── style.css        # cozy palette, responsive layout, animations, and themes
├── script.js        # room entry, audio player, custom uploads, XP & cat state
├── timer.js         # pomodoro timer, break cycles, and session counting
├── shelf.js         # bookshelf module, modal detail cards, and local storage
├── planner.js       # daily task checklist and category filters
├── goals.js         # study goals tracker with pomodoro session sync
├── notes.js         # quick notepad with auto-saving
├── assets/
│   ├── images/      # pixel cat gifs, theme backgrounds, and previews
│   └── sounds/      # lo-fi audio loop and ambient sound effects
└── server.js        # optional lightweight node server for testing audio ranges
```

Every module communicates through a tiny event bus (`window.cozyBus`), keeping things modular and easy to tinker with.

---

## Customizing Your Room

- **Add your own audio**: Click the folder button in the music player or drag-and-drop any `.mp3`, `.wav`, or `.ogg` file onto the room desk.
- **Mix soundscapes**: You can play a lo-fi track AND an ambient sound (like rain or cafe chatter) at the same time, with separate volume sliders for each.
- **Switch themes**: Pick your favorite vibe from the dropdown — it updates the window view and color tones immediately.

---

## Deploy to GitHub Pages

You can put this live on the web for free in about thirty seconds:

1. Push this repository to your GitHub account.
2. Head to **Settings** → **Pages** on your repo.
3. Under **Branch**, choose `main` (or `master`) and the `/ (root)` folder.
4. Hit **Save**.

Your cozy study room will be live at `https://<your-username>.github.io/<repo-name>/` with no build steps or deployment scripts needed.

---

## Data & Privacy

All your data stays 100% on your machine:
- Tasks, notes, goals, books, and XP live in `localStorage`.
- Uploaded music tracks are stored directly in your browser's `IndexedDB`.
- Zero analytics, zero cookies, zero external trackers, and nothing is ever transmitted over the network.
- You can export a full JSON backup whenever you like, or import an old backup to restore your exact room state.

---

## Known Limitations & Planned Polishing

I'm keeping track of a few little quirks to polish up:

- The cat petting XP is pretty generous right now 😅 (clicking fast gives you XP quick).
- The volume slider uses `0-1` while the helper function accepts `0-100` — works fine via the slider, but could be unified.
- Multi-level XP jumps loop through subtractions one by one instead of calculating big jumps in a single leap.
- Clicking a shelf book fires both the shelf card listener and the page click listener.

---

## License

[MIT](LICENSE) © 2026 19i2qi. Feel free to fork it, make it yours, and build your dream study nook!
