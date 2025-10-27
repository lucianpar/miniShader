#include "al/app/al_DistributedApp.hpp"
#include "al/graphics/al_Graphics.hpp"
#include "al/graphics/al_Light.hpp"
#include "al/graphics/al_Mesh.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "al/graphics/al_VAO.hpp"
#include "al/graphics/al_VAOMesh.hpp"
#include "al/io/al_ControlNav.hpp"
#include "al/io/al_File.hpp"
#include "al/math/al_Random.hpp"
#include "al/math/al_Vec.hpp"
#include "al/ui/al_ControlGUI.hpp"
#include "al/ui/al_FileSelector.hpp"
#include "al/ui/al_Parameter.hpp"
#include "al/ui/al_PresetSequencer.hpp"
#include "al_ext/assets3d/al_Asset.hpp"
#include <iostream>
#include <ostream>
#include <string>
#include <type_traits>
#include "al/sound/al_SoundFile.hpp"

#include "shader-env/shaderUtility/shaderToSphere.hpp"

struct Common {};
class MyApp : public al::DistributedAppWithState<Common> {
public:
  // Graphics related
  al::FileSelector selector;
  al::SearchPaths searchPaths;
  ShadedSphere shadedSphere;

  std::string vertPath;
  std::string fragPath;
  std::string fragName = "PointLine.frag";
  std::string mistFolder = "/../miniShader/mistShaders/";
  std::string ripeFolder = "/../miniShader/ripeShaders/";
  al::Parameter globalTime{"globalTime", "", 0.0, 0.0, 300.0};
  al::ParameterBool running{"running", "0", true};
  bool printTime = true;

  // Audio related
  al::SoundFilePlayer player;
 // std::string audioName = "CanyonA4.wav";
  std::string audioPath = "/Users/lucian/Desktop/ripeAudio/Scat.wav";
  float audioGain = 0.5f;

  void onInit() override {
    // Graphics initialization
    searchPaths.addSearchPath(al::File::currentPath() + mistFolder);

    al::FilePath vertPathSource = searchPaths.find("standard.vert");
    if (vertPathSource.valid()) {
      vertPath = vertPathSource.filepath();
      std::cout << "Found vertex shader: " << vertPath << std::endl;
    } else {
      std::cout << "Could not find vertex shader" << std::endl;
    }

    al::FilePath fragPathSource = searchPaths.find(fragName);
    if (fragPathSource.valid()) {
      fragPath = fragPathSource.filepath();
      std::cout << "Found fragment shader: " << fragPath << std::endl;
    } else {
      std::cout << "Could not find fragment shader" << std::endl;
    }

    // Audio initialization
    initializeAudio();
  }

  void initializeAudio() {
    std::cout << "\n=== Audio Initialization ===" << std::endl;
    std::cout << "Loading audio file: " << audioPath << std::endl;
    
    player.soundFile = new al::SoundFile();
    if (player.soundFile->open(audioPath.c_str())) {
      // Configure audio playback
      player.loop = true;
      player.pause = false; // Start playing immediately
      player.frame = 0;
      
      // Print audio file info
      std::cout << "✓ Audio loaded successfully" << std::endl;
      std::cout << "  Channels: " << player.soundFile->channels << std::endl;
      std::cout << "  Sample rate: " << player.soundFile->sampleRate << " Hz" << std::endl;
      std::cout << "  Frame count: " << player.soundFile->frameCount << std::endl;
      std::cout << "  Duration: " << (double)player.soundFile->frameCount / player.soundFile->sampleRate << " seconds" << std::endl;
      
      // Match audio system sample rate to file
      audioIO().framesPerSecond(player.soundFile->sampleRate);
      std::cout << "  Set system sample rate to: " << player.soundFile->sampleRate << " Hz" << std::endl;
    } else {
      std::cout << "✗ Failed to load audio file: " << audioPath << std::endl;
    }

    // Print audio system info
    std::cout << "\n=== Audio System Info ===" << std::endl;
    audioIO().print();
    std::cout << "Audio system ready: " << (audioIO().isOpen() ? "Yes" : "No") << std::endl;
  }

  void onCreate() override {
    // Graphics setup
    shadedSphere.setSphere(15.0, 20);
    shadedSphere.setShaders(vertPath, fragPath);
    shadedSphere.update();
  }

  void onAnimate(double dt) override {
    // Graphics animation
    if (running == true) {
      globalTime = globalTime + dt;
      if (printTime) {
        std::cout << globalTime << std::endl;
      }
    }
  }

  void onDraw(al::Graphics &g) override {
    // Graphics rendering
    g.clear(0.0);
    g.shader(shadedSphere.shader());
    shadedSphere.setUniformFloat("u_time", globalTime);
    shadedSphere.draw(g);
  }

  bool onKeyDown(const al::Keyboard &k) override {
    if (isPrimary()) {
      if (k.key() == ' ') {
        // Toggle both graphics and audio playback
        running = !running;
        player.pause = !running;
        std::cout << (running ? "▶ Started" : "⏸ Paused") << " graphics and audio" << std::endl;
      }
    }
    return true;
  }

  void onSound(al::AudioIOData& io) override {
    // Audio callback - processes audio in real-time
    static bool firstCall = true;
    if (firstCall) {
      std::cout << "Audio callback active" << std::endl;
      firstCall = false;
    }

    int numFrames = io.framesPerBuffer();
    int numChannels = io.channelsOut();
    
    // Check if we have a valid audio file
    if (!player.soundFile) {
      outputSilence(io, numFrames, numChannels);
      return;
    }

    // If paused, output silence
    if (player.pause) {
      outputSilence(io, numFrames, numChannels);
      return;
    }

    // Handle end of file
    if (player.frame >= player.soundFile->frameCount) {
      if (player.loop) {
        player.frame = 0; // Loop back to beginning
      } else {
        player.pause = true; // Stop playback
        outputSilence(io, numFrames, numChannels);
        return;
      }
    }

    // Process and output audio
    processAudioFrames(io, numFrames, numChannels);
  }

private:
  void outputSilence(al::AudioIOData& io, int numFrames, int numChannels) {
    for (int i = 0; i < numFrames; ++i) {
      for (int ch = 0; ch < numChannels; ++ch) {
        io.out(ch, i) = 0.0f;
      }
    }
  }

  void processAudioFrames(al::AudioIOData& io, int numFrames, int numChannels) {
    int fileChannels = player.soundFile->channels;
    
    // Create buffer to hold audio data from file
    std::vector<float> buffer(numFrames * fileChannels);
    
    // Get audio frames from the sound file
    player.getFrames(numFrames, buffer.data(), buffer.size());
    
    // Convert and output audio
    for (int i = 0; i < numFrames; ++i) {
      float sample = 0.0f;
      
      // Make sure we don't read past buffer end
      if (i * fileChannels < buffer.size()) {
        if (fileChannels == 1) {
          // Mono file
          sample = buffer[i] * audioGain;
        } else if (fileChannels >= 2) {
          // Stereo file - mix to mono
          float left = buffer[i * fileChannels];
          float right = buffer[i * fileChannels + 1];
          sample = 0.5f * (left + right) * audioGain;
        }
      }
      
      // Output same sample to all output channels
      for (int ch = 0; ch < numChannels; ++ch) {
        io.out(ch, i) = sample;
      }
    }
  }
};

int main() {
  MyApp app;
  app.start();
  return 0;
}
