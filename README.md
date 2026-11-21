Northland Nomads — Player Profile Banner Refinement

Install on GitHub (main branch root):
Replace index.html, roster.js, roster-redesign.css, and service-worker.js.
Keep the existing player-photos directory and all other app files unchanged.

Changes:
- Simplified profile headers: first-team label, player name, position, birthdate, preferred foot, club, hometown.
- Matt Sattler hometown: Kansas City. Unknown hometowns display a dash.
- Removed repeated club text and the local-season-data paragraph from the red card.
- Portraits anchored precisely to the banner's lower edge (zero CSS bottom gap).
- Season overview remains full-width.
- Player Comparison and rating/storage calculations are unchanged.

Cache-bust asset refs and updated service worker cache name are included.
