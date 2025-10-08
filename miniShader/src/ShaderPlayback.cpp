
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

#include "shader-env/shaderUtility/shaderToSphere.hpp"

struct Common {};
class MyApp : public al::DistributedAppWithState<Common> {
public:
  al::FileSelector selector;
  al::SearchPaths searchPaths;
  ShadedSphere shadedSphere;

  std::string vertPath;
  std::string fragPath;
  std::string fragName = "CanyonC1.frag";
  std::string mistFolder = "/../miniShader/mistShaders/";
  std::string ripeFolder = "/../miniShader/ripeShaders/";
  al::Parameter globalTime{"globalTime", "", 0.0, 0.0, 300.0};

  al::ParameterBool running{"running", "0", true};

  bool printTime = false;

  // set up audio player ***

  void onInit() override {
    // gam::sampleRate(audioIO().framesPerSecond());

    searchPaths.addSearchPath(
        al::File::currentPath() +
        ripeFolder); // replace with relative folder

    al::FilePath vertPathSource = searchPaths.find("standard.vert");
    if (vertPathSource.valid()) {
      vertPath = vertPathSource.filepath();
      std::cout << "Found file at: " << vertPath << std::endl;
    } else {
      std::cout << "couldnt find vert scene 5 in path" << std::endl;
    }
    al::FilePath fragPathSource = searchPaths.find(fragName);
    if (fragPathSource.valid()) {
      fragPath = fragPathSource.filepath();
      std::cout << "Found file at: " << fragPath << std::endl;
    } else {
      std::cout << "couldnt find frag scene 5 in path" << std::endl;
    }
  }

  void onCreate() override {
    shadedSphere.setSphere(15.0, 20); // make higher res for greater detail? or lower for perfomance boost -- relevant for recording settings or realtime
    shadedSphere.setShaders(vertPath, fragPath);
    shadedSphere.update();
  }

  void onAnimate(double dt) override {
    if (running == true) {
      globalTime = globalTime + dt;
      if (printTime) {
      std::cout << globalTime << std::endl;
      }
    }
  }

  void onDraw(al::Graphics &g) override {

    g.clear(0.0);

    g.shader(shadedSphere.shader());
    shadedSphere.setUniformFloat("u_time", globalTime);
    shadedSphere.draw(g);
  };

  bool onKeyDown(const al::Keyboard &k) override {

    if (isPrimary()) {

      if (k.key() == ' ' && running == false) {
        running = true;
        std::cout << "started running" << std::endl;
      } else if (k.key() == ' ' && running == true) {
        running = false;
        std::cout << "stopped running" << std::endl;
      }
    }
  }
};
int main() {
  MyApp app;
  app.start();
  return 0;
}
