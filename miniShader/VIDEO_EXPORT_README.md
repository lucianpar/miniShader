# 4K Video Exporter

Offline video exporter for shader visualizations using allolib.

## Prerequisites

Install FFmpeg:

```bash
brew install ffmpeg
```

## Configuration

Edit `miniShader/src/VideoExporter.cpp` to configure:

- `fragName`: Fragment shader filename (default: "mistMainFinal.frag")
- `mistFolder`: Shader directory path
- `outputVideoPath`: Output filename (default: "shader_export.mp4")
- `VIDEO_WIDTH`, `VIDEO_HEIGHT`: Resolution (default: 3840x2160)
- `FPS`: Frame rate (default: 60)
- `DURATION`: Video length in seconds (default: 240)
- `BITRATE`: Video bitrate in kbps (default: 50000)

## Build & Run

Build the VideoExporter:

```bash
mkdir -p build/Release
cmake -DCMAKE_BUILD_TYPE=Release -B build/Release -S .
cmake --build build/Release --target VideoExporter --config Release -j 9
```

Run the exporter:

```bash
./bin/VideoExporter
```

The video will be saved to `shader_export.mp4` in the current directory.

## How it Works

1. Loads shader files (mistMainFinal.frag + standard.vert)
2. Renders each frame offline at 4K resolution
3. Uses ShadedSphere to wrap shader onto sphere geometry
4. Pipes RGB frames to FFmpeg for H.264 encoding
5. Outputs high-quality MP4 video with faststart flag

## Performance

Rendering ~14,400 frames (240s @ 60fps) at 4K resolution will take time depending on shader complexity and CPU/GPU. Progress is displayed in the terminal.
