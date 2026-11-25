# Explainer

The five-minute technical explainer for Kaiju Pinball. It covers the table and the city as two maps, the seed, the collision math, the 120 Hz step, chains and combos, and the browser rendering budget.

## Watch and download

- [README player](../README.md)
- [1080p master](https://github.com/jimmerioles/kaiju-pinball/releases/download/v0.1.0/kaiju-pinball-explainer.mp4)
- [Captions](../video/kaiju-pinball-explainer.srt)

The master is a release asset, not a repository file. The README embeds a GitHub user attachment. Keep the two files byte-identical.

## Production

- Narration: Kokoro `af_heart`.
- Animation: Manim, using constants from `src/game/config.ts`.
- Master: 1920x1080, 30 fps, H.264 High 4.1, AAC 48 kHz stereo, 296.433 seconds.
- Poster: `docs/screenshots/explainer.webp` (1280x720) scaled to 1920x1080. It holds for 2.5 seconds, then crossfades for 0.5 seconds into the source at 2.5 seconds.
- The first frame is the poster. GitHub strips poster attributes from hand-written video tags, so the poster is baked into the video.
- Captions: `docs/video/kaiju-pinball-explainer.srt` and an embedded `mov_text` track.
- The explainer is documentation, not a runtime asset. The game still ships with no external models, textures, or audio.

## Rebuild

The poster replaces the source opening, so the duration and audio sync stay the same. The source audio starts at zero and the film resumes at 2.5 seconds.

```bash
ffmpeg -y \
  -loop 1 -framerate 30 -t 3.0 -i poster-1080.png \
  -i source-1080p.mp4 \
  -filter_complex "[0:v]scale=1920:1080:flags=lanczos,fps=30,format=yuv420p,setsar=1,settb=AVTB,trim=duration=3.0,setpts=PTS-STARTPTS[poster];[1:v]trim=start=2.5,setpts=PTS-STARTPTS,fps=30,format=yuv420p,setsar=1,settb=AVTB[film];[poster][film]xfade=transition=fade:duration=0.5:offset=2.5[v]" \
  -map "[v]" -map 1:a:0 -map 1:s:0? -map_metadata 1 -map_chapters 1 -dn \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p \
  -profile:v high -level 4.1 \
  -g 60 -keyint_min 60 -sc_threshold 0 \
  -c:a copy -c:s copy -movflags +faststart \
  out.mp4
```

Upload `out.mp4` as the release asset and as a temporary GitHub issue attachment, then update the bare URL in the README. Do not commit the MP4.
