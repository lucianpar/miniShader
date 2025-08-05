// #include
// "/Users/lucian/Desktop/shader-env/allolib-kickstart/allolib/modules/external/Gamma/Gamma/Domain.h"
// #include "Gamma/Envelope.h"
// #include "Gamma/Oscillator.h"
// #include "Gamma/SamplePlayer.h"
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
// #include "al/scene/al_SynthSequencer.hpp"
#include "al/ui/al_ControlGUI.hpp"
#include "al/ui/al_FileSelector.hpp"
#include "al/ui/al_Parameter.hpp"
#include "al/ui/al_PresetSequencer.hpp"
#include "al_ext/assets3d/al_Asset.hpp"
#include <iostream>
#include <ostream>
#include <string>

// MY CUSTOM INCLUDES:
// #include "../eoys-mesh-fx/ripple.hpp"
// #include "../eoys-mesh-fx/scatter.hpp"
// #include "../eoys-mesh-fx/vfxUtility.hpp"
// // #include "../meshMorph.hpp"
// #include "../eoys-mesh-fx/scatter.hpp"
// #include "../eoys-mesh-fx/vfxMain.hpp"
// #include "../utility/loadAudioScene.hpp"
// #include "../utility/parseObj.hpp"
// #include "../utility/soundObject.hpp"
// #include "../imageToMesh.hpp"
// #include "../imageToSphere.hpp"
#include "/Users/lucian/Desktop/shader-env/allolib-kickstart/src/shaderToSphere.hpp"
//"../eoys-shader/shaderToSphere.hpp"
// #include "../utility/attractors.hpp"
// #include "../utility/imageColorToMesh.hpp"

struct Common {};
class MyApp : public al::DistributedAppWithState<Common> {
public:
  al::FileSelector selector;
  al::SearchPaths searchPaths;
  al::Light light;
  al::Material material;
  ShadedSphere shadedSphereScene5;

  // scene 5

  std::string vertPathScene5;
  std::string fragPathScene5;
  al::Parameter sceneTime{"sceneTime", "", 0.0, 0.0, 300.0};

  al::ParameterBool running{"running", "0", false};

  // Global Time
  double globalTime = 0;
  // double sceneTime = 0.0;
  int sceneIndex = 5;

  void onInit() override {
    // gam::sampleRate(audioIO().framesPerSecond());

    // searchPaths.addSearchPath(al::File::currentPath() + "/../../../..");
    searchPaths.addSearchPath(al::File::currentPath() + "/../../");
    parameterServer() << sceneTime;

    // scene 5

    al::FilePath vertPath5 = searchPaths.find("standard.vert");
    if (vertPath5.valid()) {
      vertPathScene5 = vertPath5.filepath();
      std::cout << "Found file at: " << vertPathScene5 << std::endl;
    } else {
      std::cout << "couldnt find vert scene 5 in path" << std::endl;
    }
    al::FilePath fragPath5 = searchPaths.find("CrushedMain.frag");
    if (fragPath5.valid()) {
      fragPathScene5 = fragPath5.filepath();
      std::cout << "Found file at: " << fragPathScene5 << std::endl;
    } else {
      std::cout << "couldnt find frag scene 5 in path" << std::endl;
    }
  }

  void onCreate() override {
    // should be boilerplate
    shadedSphereScene5.setSphere(15.0, 20);
    shadedSphereScene5.setShaders(vertPathScene5, fragPathScene5);
    shadedSphereScene5.update();

    // scene 5 and 4
  }

  void onAnimate(double dt) override {
    globalTime += dt;
    sceneTime = sceneTime + dt;
    std::cout << globalTime << std::endl;
  }

  void onDraw(al::Graphics &g) override {

    // scene 5 DRAW
    if (sceneIndex == 5) {

      g.clear(0.0);

      g.shader(shadedSphereScene5.shader());
      shadedSphereScene5.setUniformFloat("u_time", sceneTime);
      shadedSphereScene5.draw(g);
    }
    // scene end 5 DRAW
  }

  // void onSound(al::AudioIOData &io) override { mSequencer.render(io); }
  // al::SynthSequencer &sequencer() { return mSequencer; }
  // al::SynthSequencer mSequencer;
};

int main() {
  MyApp app;
  app.start();
  return 0;
}
