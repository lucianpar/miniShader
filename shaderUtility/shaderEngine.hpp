#ifndef EOYS_SHADER_ENGINE_HPP
#define EOYS_SHADER_ENGINE_HPP

// al includes
#include "al/scene/al_PositionedVoice.hpp"
#include "al/ui/al_ControlGUI.hpp"
#include "al/ui/al_ParameterBundle.hpp"

// giml includes
// #include "../../../Gimmel/include/filter.hpp"

// eoys includes
#include "audioReactor.hpp"
#include "shaderToSphere.hpp"
// #include "vfxMain.hpp"
// #include "vfxUtility.hpp"

class ShaderEngine : public al::PositionedVoice {
private:
  ShadedSphere shaderSphere;
  SpectralListener specListen;
  DynamicListener dynListen;

  al::Parameter now{"now", "", 0.f, 0.f, std::numeric_limits<float>::max()};
  al::Parameter flux{"flux", "", 0.01f, 0.f, 1.f};
  al::Parameter centroid = {"centroid", "", 1.f, 0.f, 20000.f};
  al::Parameter rms = {"rms", "", 0.f, 0.f, 1.f};
  al::Parameter onsetIncrement = {"onsetIncrement", "", 0.f, 0.f, 100.f};
  al::ParameterInt mChannel = {"mChannel", "", 0, 0, 8};
  al::ParameterBundle mParams{"Uniforms"};
  al::ControlGUI mGUI;

  al::ParameterBool networkedInitFlag{"networkedInitFlag", "", true};
  bool initFlag = true;

  FloatReporter fluxReporter;
  FloatReporter centroidReporter;
  FloatReporter rmsReporter;
  // giml::OnePole<float> mOnePole;
  // giml::OnePole<float> mOnePoleCent;

  al::ParameterString fragPath = {"fragPath", "",
                                  "../src/shaders/fractal1.frag"};

public:
  // make sure al::imguiInit() is called before this
  void init() override {
    dynListen.setSilenceThresh(0.1);
    mGUI << now << flux << centroid << rms << onsetIncrement << mChannel;
    mParams << now << flux << centroid << rms << onsetIncrement << mChannel
            << fragPath << networkedInitFlag;
    // plz tell me there's a better way to do this
    for (auto &param : mParams.parameters()) {
      auto pp = static_cast<al::Parameter *>(param);
      this->registerParameter(*pp);
    }
    shaderSphere.setSphere(
        15.f, 1000); // see VAOMesh::update(), moved to draw function
    // this->shader(); // moved to draw function, triggered by flag.

    networkedInitFlag.registerChangeCallback([this](bool value) {
      this->initFlag = true;
      std::cout << "NetworkedInitFlag changed, setting initFlag to true"
                << std::endl;
    });
  }

  void shaderPath(std::string path) {
    fragPath.set(path);
    networkedInitFlag = true;
  }

  void shader() {
    if (shaderSphere.setShaders("../src/shaders/standard.vert", fragPath)) {
      return;
    } else
      shaderSphere.setShaders("../src/shaders/standard.frag",
                              "../src/shaders/fractal1.frag");
  }

  void update(double dt = 0) override {
    if (!mIsReplica) {

      now = now + float(dt);

      // mOnePoleCent.setCutoff(15000, 60);
      // centroid = mOnePoleCent.lpf(centroidReporter.reportValue());

      // mOnePole.setCutoff(1000, 60);
      // flux = mOnePole.lpf(fluxReporter.reportValue());

      // if (dynListen.detectOnset()) {
      //   std::cout << "NEW ONSET" << std::endl;
      //   onsetIncrement = onsetIncrement + 0.1f;
      // }
    }
  }

  void onProcess(al::AudioIOData &io) override {
    if (!mIsReplica) {
      for (auto sample = 0; sample < io.framesPerBuffer(); sample++) {
        const float in = io.in(mChannel, sample);
        specListen.process(in);
        dynListen.process(in);
        centroidReporter.write(in);
        fluxReporter.write(in);
        rmsReporter.write(in);
      }
    }
  }

  void onProcess(al::Graphics &g) override {

    if (this->initFlag) {
      this->shader();
      this->initFlag = false;
    }

    // activate shader mode
    g.shader(shaderSphere.shader());

    // set unforms
    shaderSphere.setUniformFloat("u_time", now);
    shaderSphere.setUniformFloat("onset", onsetIncrement);
    shaderSphere.setUniformFloat("cent", centroid);
    shaderSphere.setUniformFloat("flux", flux);

    // draw
    shaderSphere.draw(g);

    // draw GUI
    if (!mIsReplica) {
      // mGUI.draw(g);
    }
  }
};

#endif // EOYS_SHADER_ENGINE_HPP