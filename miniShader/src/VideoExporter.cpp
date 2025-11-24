#include "al/app/al_App.hpp"
#include "al/graphics/al_Graphics.hpp"
#include "al/graphics/al_FBO.hpp"
#include "al/graphics/al_Texture.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "al/io/al_File.hpp"
#include "shader-env/shaderUtility/shaderToSphere.hpp"

#include <iostream>
#include <vector>
#include <cstdio>

/*
 * 4K Video Exporter for Shader Visualization
 * 
 * Usage:
 * 1. Update paths in USER CONFIGURATION section
 * 2. Run: ./bin/VideoExporter
 * 3. Output: shader_export.mp4 in current directory
 * 
 * Requirements: FFmpeg installed (brew install ffmpeg)
 */

class VideoExporter : public al::App {
public:
  // USER CONFIGURATION //
  std::string fragName = "mistMainFinal.frag";
  std::string mistFolder = "miniShader/mistShaders/";
  std::string outputVideoPath = "shader_export.mp4";
  
  // Video settings
  const int VIDEO_WIDTH = 1280;   // 720p width
  const int VIDEO_HEIGHT = 720;   // 720p height
  const float FPS = 30.0f;        // 30fps
  const float DURATION = 240.0f;  // Full 4 minutes
  const int BITRATE = 5000;       // 5Mbps
  
  // END USER CONFIGURATION //

  // Graphics components
  al::SearchPaths searchPaths;
  ShadedSphere shadedSphere;
  std::string vertPath;
  std::string fragPath;
  al::FBO fbo;
  al::RBO rbo;
  al::Texture tex;
  
  // Export state
  FILE* ffmpegPipe = nullptr;
  std::vector<unsigned char> frameBuffer;
  int currentFrame = 0;
  int totalFrames = 0;
  float currentTime = 0.0f;
  bool exporting = false;

  void onInit() override {
    std::cout << "\n=== 4K Video Exporter ===" << std::endl;
    std::cout << "Resolution: " << VIDEO_WIDTH << "x" << VIDEO_HEIGHT << std::endl;
    std::cout << "FPS: " << FPS << std::endl;
    std::cout << "Duration: " << DURATION << "s" << std::endl;
    
    // Find shader files
    std::string searchPath = al::File::currentPath() + mistFolder;
    std::cout << "Current path: " << al::File::currentPath() << std::endl;
    std::cout << "Search path: " << searchPath << std::endl;
    searchPaths.addSearchPath(searchPath);

    al::FilePath vertPathSource = searchPaths.find("standard.vert");
    if (vertPathSource.valid()) {
      vertPath = vertPathSource.filepath();
      std::cout << "✓ Found vertex shader: " << vertPath << std::endl;
    } else {
      std::cerr << "✗ Could not find vertex shader" << std::endl;
      quit();
      return;
    }

    al::FilePath fragPathSource = searchPaths.find(fragName);
    if (fragPathSource.valid()) {
      fragPath = fragPathSource.filepath();
      std::cout << "✓ Found fragment shader: " << fragPath << std::endl;
    } else {
      std::cerr << "✗ Could not find fragment shader" << std::endl;
      quit();
      return;
    }

    totalFrames = static_cast<int>(DURATION * FPS);
    std::cout << "Total frames to render: " << totalFrames << std::endl;
    
    // Allocate frame buffer (RGB, 3 bytes per pixel)
    frameBuffer.resize(VIDEO_WIDTH * VIDEO_HEIGHT * 3);
  }

  void onCreate() override {
    std::cout << "\n=== Creating Graphics Context ===" << std::endl;
    
    // Configure window for offscreen rendering
    dimensions(VIDEO_WIDTH, VIDEO_HEIGHT);
    
    // Setup navigation with camera at center of sphere
    nav().pos(0, 0, 0);  // Camera at center of sphere
    nav().faceToward(al::Vec3f(0, 0, -1));
    
    // Set lens FOV to control zoom (smaller FOV = more zoomed in)
    lens().fovy(60);  // Default is around 30-45, try 60 for slight zoom out
    
    // Setup sphere with shaders
    shadedSphere.setSphere(15.0, 250);  // Higher subdivision for quality
    if (!shadedSphere.setShaders(vertPath, fragPath)) {
      std::cerr << "✗ Failed to load shaders" << std::endl;
      quit();
      return;
    }
    shadedSphere.update();
    std::cout << "✓ Sphere and shaders initialized" << std::endl;

    // Setup FBO for offscreen rendering
    tex.create2D(VIDEO_WIDTH, VIDEO_HEIGHT);
    rbo.resize(VIDEO_WIDTH, VIDEO_HEIGHT);
    fbo.bind();
    fbo.attachTexture2D(tex);
    fbo.attachRBO(rbo);
    fbo.unbind();
    std::cout << "✓ Framebuffer created: " << VIDEO_WIDTH << "x" << VIDEO_HEIGHT << std::endl;

    // Start FFmpeg pipe
    if (!startFFmpeg()) {
      std::cerr << "✗ Failed to start FFmpeg" << std::endl;
      quit();
      return;
    }

    exporting = true;
    std::cout << "\n=== Starting Export ===" << std::endl;
    std::cout << "Progress: 0%" << std::flush;
  }

  bool startFFmpeg() {
    // FFmpeg command for 4K H.264 export with high quality settings
    std::string cmd = "ffmpeg -y "
                      "-f rawvideo "
                      "-pixel_format rgb24 "
                      "-video_size " + std::to_string(VIDEO_WIDTH) + "x" + std::to_string(VIDEO_HEIGHT) + " "
                      "-framerate " + std::to_string(static_cast<int>(FPS)) + " "
                      "-i pipe:0 "
                      "-c:v libx264 "
                      "-preset slow "
                      "-crf 18 "
                      "-pix_fmt yuv420p "
                      "-b:v " + std::to_string(BITRATE) + "k "
                      "-movflags +faststart "
                      "\"" + outputVideoPath + "\"";

    std::cout << "\nFFmpeg command: " << cmd << std::endl;
    
    ffmpegPipe = popen(cmd.c_str(), "w");
    if (!ffmpegPipe) {
      std::cerr << "Failed to open FFmpeg pipe" << std::endl;
      return false;
    }
    
    std::cout << "✓ FFmpeg pipe opened" << std::endl;
    return true;
  }

  void onAnimate(double dt) override {
    if (!exporting) return;

    // Calculate current time based on frame number for precise timing
    currentTime = currentFrame / FPS;

    // Check if export is complete
    if (currentFrame >= totalFrames) {
      finishExport();
      return;
    }
  }

  void onDraw(al::Graphics &g) override {
    if (!exporting) return;

    // Render to FBO
    fbo.bind();
    g.clear(0.0);
    g.viewport(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
    
    // Use default camera matrices (like ShaderPlayback)
    g.camera(nav());

    // Draw shader sphere
    g.shader(shadedSphere.shader());
    shadedSphere.setUniformFloat("u_time", currentTime);
    shadedSphere.draw(g);
    
    fbo.unbind();

    // Read pixels from FBO
    fbo.bind();
    glReadPixels(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT, GL_RGB, GL_UNSIGNED_BYTE, frameBuffer.data());
    fbo.unbind();

    // Flip vertically (OpenGL reads bottom-to-top)
    flipVertical();

    // Write frame to FFmpeg
    if (ffmpegPipe) {
      fwrite(frameBuffer.data(), 1, frameBuffer.size(), ffmpegPipe);
    }

    // Progress reporting
    currentFrame++;
    if (currentFrame % 60 == 0 || currentFrame == totalFrames) {
      float progress = (currentFrame / (float)totalFrames) * 100.0f;
      std::cout << "\rProgress: " << static_cast<int>(progress) << "% "
                << "(" << currentFrame << "/" << totalFrames << " frames) "
                << "Time: " << currentTime << "s" << std::flush;
    }
  }

  void flipVertical() {
    int rowSize = VIDEO_WIDTH * 3;
    std::vector<unsigned char> tempRow(rowSize);
    
    for (int y = 0; y < VIDEO_HEIGHT / 2; y++) {
      int topOffset = y * rowSize;
      int bottomOffset = (VIDEO_HEIGHT - 1 - y) * rowSize;
      
      // Swap rows
      std::copy(frameBuffer.begin() + topOffset, 
                frameBuffer.begin() + topOffset + rowSize, 
                tempRow.begin());
      std::copy(frameBuffer.begin() + bottomOffset, 
                frameBuffer.begin() + bottomOffset + rowSize, 
                frameBuffer.begin() + topOffset);
      std::copy(tempRow.begin(), 
                tempRow.end(), 
                frameBuffer.begin() + bottomOffset);
    }
  }

  void finishExport() {
    exporting = false;
    
    std::cout << "\n\n=== Export Complete ===" << std::endl;
    
    if (ffmpegPipe) {
      pclose(ffmpegPipe);
      ffmpegPipe = nullptr;
      std::cout << "✓ FFmpeg pipe closed" << std::endl;
    }

    std::cout << "✓ Video exported to: " << outputVideoPath << std::endl;
    std::cout << "  Total frames: " << currentFrame << std::endl;
    std::cout << "  Duration: " << currentTime << "s" << std::endl;
    
    quit();
  }

  void onExit() override {
    if (ffmpegPipe) {
      pclose(ffmpegPipe);
    }
  }
};

int main() {
  VideoExporter app;
  app.dimensions(0, 0, 3840, 2160);  // 4K resolution
  app.decorated(false);  // No window decorations needed
  app.start();
  return 0;
}
