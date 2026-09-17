import { MeshBasicMaterial, MeshStandardMaterial } from "three";

const monitor_bar_light = new MeshBasicMaterial({
  color: "purple",
  allowOverride: false,
});
const keyboard_key = new MeshBasicMaterial({
  color: "purple",
  allowOverride: false,
});
const monitor_bar_light_light = new MeshStandardMaterial({
  emissive: "white",
  emissiveIntensity: 20,
  allowOverride: false,
});

export const Materials = {
  monitor_bar_light,
  monitor_bar_light_light,
  keyboard_key
};

export const ExcludeNormalMaterials = {
  monitor_bar_light,
  monitor_bar_light_light,
  bloc:monitor_bar_light
};
