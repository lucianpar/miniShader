#ifndef AUDIO_REACTOR_HPP
#define AUDIO_REACTOR_HPP


#include "Gamma/Analysis.h"
#include "Gamma/DFT.h"
#include "Gamma/FFT.h"
#include "Gamma/tbl.h"
//#include "Gamma/"

#include <cmath>
#include <cstddef>
#include <vector>




/**
 * @brief Creates a spectrum analyzer. Has methods for retrieving centroid and flux. 
 * Need to call process in onSound. 
 * Call retrieval functions in onSound. Not useful to print / send values at audio rate.
 */

class SpectralListener {
public:
  gam::STFT stft;
  // mag spectrum at latest point in buffer
  std::vector<float> magnitudes;
  std::vector<float> prevMagnitudes;

  SpectralListener() : stft(1024, 256, 0, gam::HAMMING) {
    stft.numAux(1); // 1 deals with mag spectrum
  }

/**
 * @brief Call in on sound. Pass in input samples
 */
  void process(float inputSample) {
    if (stft(inputSample)) { // if sample != null basically
      stft.spctToPolar();    // converts complex/ imaginary numbers to mag and
      // phase
      stft.copyBinsToAux(0, 0);  // copy magnitudes to auxilary buffer. there is
                                 // also an inverse function
      float *mags = stft.aux(0); // creates pointer to aux buffer
      if (mags){ //might not need this but seemed to be extra protection from seg fault on init - magnitudes are only assigned if there are values- no null pointer
      magnitudes.assign(mags, mags + stft.numBins());
      }
    }
  }

  const std::vector<float> &getMagnitudes() const {
    return magnitudes;
  } // reference to current magnitudes. might change this, but is currently
    // useful for comparing state in between frames. if process return a vector,

  // decleration and implementation
/** 
* @brief Store in a var or pass into param. Measures difference in freq spectrum magnitude between frames.
*/
  float getFlux() {
    if (prevMagnitudes.empty()) {
      prevMagnitudes = magnitudes;
      return 0.0f;
    }

    float flux = 0.0f;
    for (size_t i = 0; i < magnitudes.size(); ++i) {
      float delta = magnitudes[i] - prevMagnitudes[i];
      flux += std::max(delta, 0.0f); // only outputs positive values
    };
    prevMagnitudes = magnitudes;
    return flux;
  }
  // get spectral centroid
  /** 
* @brief Store in a var or pass into param. Measures center of mass of current freq.
*/
  float getCent() {
    if (magnitudes.empty())
      return 0.0f;

    float weightedSum = 0.0f;
    float magSum = 0.0f;

    float binFreq = stft.binFreq(); // Frequency spacing per bin
    for (size_t i = 0; i < magnitudes.size(); ++i) {
      float freq = i * binFreq;
      weightedSum += freq * magnitudes[i];
      magSum += magnitudes[i];
    }
      


    if (magSum == 0.0f) {
      return 0.0f;
      
    }
    return weightedSum / magSum;
  };

};

/** 
* @brief Creates a dynamics analyzer. IMPORTANT - set silenceDuration (in samples), silence threshold, and onset threshold.
* Methods for getRMS and reset RMS. Methods for detecting new note onsets,  setting thresholds.
* Need to call process in onSound. 
* used .setOnsetThreshold and .setSilenceThresh based on audio input needs
* Call retrieval functions in onSound. Not useful to print / send values at audio rate.
* RMS is reset after 1 second of silence (below silence threshold). Update silence duration based on samplerate. This allows for new onset detection rather than a longterm RMS.
*/

class DynamicListener {
  public:
  //not using yet
  // gam::EnvFollow<float> env{0.1};
  // gam::ZeroCross<float> zrc;

  float currentRMS;
  float sumOfSquares;
  int sampleCounter;
  //float onsetThreshMin;
  float onsetThreshMax;
  bool onsetStateOn;
  gam::SilenceDetect silenceDuration;
  float silenceThreshold; // added to allow proper silence detection
 

  //keeping consistent with how spectral listener is designed, avoiding undefined behavior, 
  DynamicListener () 
    : currentRMS(0.0f), sumOfSquares(0.0f), sampleCounter(0), 
      onsetThreshMax(0.05), onsetStateOn(false), 
      silenceDuration(44100), silenceThreshold(0.01f) {} // 2048 samples of quiet before reset

      /** 
* @brief Set threshold for onset (RMS float value). Tweak according to sound check.
* Currently does not handle different frequency bands
*/
  void setOnsetThresh(float threshold) {
    onsetThreshMax = threshold;
  }
  void setSilenceThresh(float thresh){
    silenceThreshold = thresh;
  }

// defined first so reset works in process
      void resetRMS(){
    currentRMS = 0.0f;
    sampleCounter = 0;
    sumOfSquares = 0.0f;
  }

/** 
* @brief call in onSound. pass in input sample
*/
  void process(float inputSample){
    // env(inputSample);
    // zrc(inputSample); 

    sumOfSquares += inputSample * inputSample; //squaring raw input sample value and summing.
    sampleCounter++;

    // reset RMS if silence is detected using gamma's SilenceDetect
    if (silenceDuration(inputSample, silenceThreshold)) {
      resetRMS();
      onsetStateOn = false;
      
      //std::cout << "Silence detected — RMS reset" << std::endl;
    }
    if (sampleCounter > 0){
       currentRMS = std::sqrt(sumOfSquares / sampleCounter);
    }

  }

/** 
* @brief call in onSound. returns float of up to date rms
*/
  float getRMS(){
    return currentRMS;
  }


/** 
* @brief Returns true if new onset is detected at / above threshold.
*/
  bool detectOnset(){
    if (currentRMS >= onsetThreshMax && onsetStateOn == false){ //if rms is newly above the threshold
      onsetStateOn = true;
      return true;
    }
    else if (currentRMS >= onsetThreshMax && onsetStateOn == true){ // if signal has already been above the threshold
      return false;
    }
    else if (currentRMS < onsetThreshMax){ 
      onsetStateOn = false;
      return false;
    }
  }
};





//!!
//mostly Joel's code, slight modifications
//!!
//* use atomic for thread safety?

class FloatReporter {
private:
float value = 0.f;

public:

// CALL IN AUDIO CALLBACK
void write(float newValue) {
  this->value = newValue;
}

// CALL IN ANIMATION / DRAW CALLBACK

float reportValue(){
  return this->value;
}

};

#endif

