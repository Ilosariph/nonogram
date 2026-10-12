# Vibe coded nonogram website because I was tired of the ads in the app I was using.

Static site (HTML/CSS/vanilla JS, no build step); puzzle generation and all validation run client-side.

## Run

```sh
docker compose up -d           # nginx on port 5000 (expects the external `proxy` network)
npm start                      # → http://localhost:8000 (python3 static server)
```

## Test

```sh
npm test                       # generator tests (node --test, no deps)
```

## Layout

| Path | Purpose |
| --- | --- |
| `public/js/nonogram.js` | Seeded PRNG, puzzle generator, clue helpers |
| `public/js/main.js` | Game state, rendering, input, lives mode |
| `public/styles.css` | All styles |
| `Dockerfile`, `nginx.conf`, `docker-compose.yml` | Container serving the static site via nginx |
