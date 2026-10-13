# Tetris

Ein kleines Tetris-Spiel mit Startmenü, Vorschau- und Hold-Funktion sowie dauerhaftem Highscore.

## Starten

Benötigt Python 3. Starte den Server im Projektordner:

```bash
python3 server.py
```

Öffne anschließend [http://localhost:8000](http://localhost:8000).

Der lokale Server speichert den Highscore in `highscore.json`. Für eine öffentliche Bereitstellung als Webseite ist zusätzlich ein Server nötig, der diese API bereitstellt.

## Steuerung

- **← / →**: bewegen
- **↑**: drehen
- **↓**: schneller fallen
- **Leertaste**: Hard Drop
- **C**: Spielstein halten
- **P**: Pause
