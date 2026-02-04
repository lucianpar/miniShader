#pragma once
#include "al/graphics/al_Shapes.hpp"
#include "shadedMesh.hpp"

/*
uses shadedMesh to wrap a shader to a sphere -- EXAMPLE USAGE AT BOTTOM OF THIS
FILE. ALSO IN sphereShaderExample.cpp

  M1 issue / warning
  - We MUST send a dynamic uniform every frame (typically a Mat4)
    to prevent Metal driver from freezing uniform updates.
*/

class ShadedSphere : public ShadedMesh {
private:
  float radius = 1.0f;
  int subdivisions = 100; // smoothness of sphere
  float pointSize = 10.0f;

public:
  /// Initialize shaders
  /// @param vertPath Path to vertex shader
  /// @param fragPath Path to fragment shader

  /// sphere vertices
  /// @param r sphere radius
  /// @param subdiv number of subdivisions
  int addTexSphere(Mesh &m, double radius, int bands, bool isSkybox) {
    m.primitive(Mesh::TRIANGLES);

    double &r = radius;

    // calculate vertex data with closing duplicate vertices for texturing
    for (int lat = 0; lat <= bands; lat++) {
      double theta = lat * M_PI / bands;
      double sinTheta = sin(theta);
      double cosTheta = cos(theta);

      for (int lon = 0; lon <= bands; lon++) {
        double phi = lon * M_2PI / bands;
        double sinPhi = sin(phi);
        double cosPhi = cos(phi);

        double x = sinPhi * sinTheta;
        double y = cosTheta;
        double z = cosPhi * sinTheta;

        double u = (double)lon / bands;
        if (isSkybox)
          u = 1.0 - u;
        double v = (double)lat / bands;

        m.vertex(r * x, r * y, r * z);
        m.texCoord(u, v);

        // inversed normal if skybox
        if (isSkybox)
          m.normal(-x, -y, -z);
        else
          m.normal(x, y, z);
      }
    }

    // add indices
    for (int lat = 0; lat < bands; ++lat) {
      for (int lon = 0; lon < bands; ++lon) {
        int first = (lat * (bands + 1)) + lon;
        int second = first + bands + 1;

        if (!isSkybox) {
          m.index(first);
          m.index(second);
          m.index((first + 1));

          m.index(second);
          m.index((second + 1));
          m.index((first + 1));
        } else {
          m.index(first);
          m.index((first + 1));
          m.index(second);

          m.index(second);
          m.index((first + 1));
          m.index((second + 1));
        }
      }
    }

    return m.vertices().size();
  }
  void setSphere(float r, int subdiv = 100) {
    radius = r;
    subdivisions = subdiv;
    this->reset();
    this->primitive(al::Mesh::TRIANGLE_FAN);
    addTexSphere(*this, 15, 250, true);
    // this->update(); // 🔥 Push to GPU // seg faults, move to draw
  }

  /// Update view/projection matrices - should leave
  void setMatrices(const al::Mat4f &view, const al::Mat4f &proj) {
    ShadedMesh::setMatrices(view, proj);
  }

  /// Draw the sphere
  void draw(al::Graphics &g) {
    this->update();
    this->mShader.use();
    g.pointSize(pointSize);
    // g.depthTesting(true);
    g.draw(*this);
    // g.depthTesting(false);
  }
};