import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function Asterisk3D() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.3,
      1000
    );
    camera.position.z = 5;

    // Renderer with transparent background
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(
      mountRef.current.clientWidth,
      mountRef.current.clientHeight
    );
    mountRef.current.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0xffffff, 100);
    pointLight1.position.set(5, 5, 5);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x4a90e2, 0.5);
    pointLight2.position.set(-5, -5, 5);
    scene.add(pointLight2);

    // Create asterisk geometry
    const asteriskGroup = new THREE.Group();

    // Material for the asterisk - #737474 with 100% opacity
    const material = new THREE.MeshPhongMaterial({
      color: 0x737474,
      shininess: 100,
      specular: 0x444444,
    });

    // Create 3 rays for the asterisk matching the SVG (vertical and two diagonals)
    const rayGeometry = new THREE.CylinderGeometry(0.1, 0.1, 2.5, 16);

    // Vertical ray (12,6 to 12,18)
    const ray1 = new THREE.Mesh(rayGeometry, material);
    asteriskGroup.add(ray1);

    // Diagonal ray 1 (top-right to bottom-left)
    const ray2 = new THREE.Mesh(rayGeometry, material);
    ray2.rotation.z = Math.PI / 3; // 60 degrees
    asteriskGroup.add(ray2);

    // Diagonal ray 2 (top-left to bottom-right)
    const ray3 = new THREE.Mesh(rayGeometry, material);
    ray3.rotation.z = -Math.PI / 3; // -60 degrees
    asteriskGroup.add(ray3);

    // Center sphere - flattened to match the rays
    const sphereGeometry = new THREE.SphereGeometry(0.15, 32, 32);
    sphereGeometry.scale(1, 1, 0.3);
    const sphere = new THREE.Mesh(sphereGeometry, material);
    asteriskGroup.add(sphere);

    scene.add(asteriskGroup);

    // Mouse interaction
    let mouseX = 0;
    let mouseY = 0;

    const handleMouseMove = (event: MouseEvent) => {
      mouseX = (event.clientX / window.innerWidth) * 2 - 1;
      mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    };

    window.addEventListener("mousemove", handleMouseMove);

    // Animation
    const animate = () => {
      requestAnimationFrame(animate);

      // Auto-rotate
      asteriskGroup.rotation.x += 0.01;
      asteriskGroup.rotation.y += 0.01;

      // Mouse interaction - subtle influence
      asteriskGroup.rotation.x += mouseY * 0.001;
      asteriskGroup.rotation.y += mouseX * 0.001;

      renderer.render(scene, camera);
    };

    animate();

    // Handle window resize
    const handleResize = () => {
      if (!mountRef.current) return;
      camera.aspect =
        mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(
        mountRef.current.clientWidth,
        mountRef.current.clientHeight
      );
    };

    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        width: "100%",
        height: "100%",
      }}
    />
  );
}
