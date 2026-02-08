import type { Action } from "./types";
import type { SimController } from "../controls/SimController";
import type { Annotation } from "../models/Annotation";

function getRegionById(annotations: Annotation[], id?: string) {
  if (!id) return null;
  const a = annotations.find(x => x.id === id);
  if (!a || a.type !== "region") return null;
  return a;
}

export function executeActions(controller: SimController, actions: Action[]) {
  const executed: Action[] = [];

  // Snapshot annotations at execution time (to resolve regionAnnotationId)
  const annotations = controller.getAnnotations();

  for (const a of actions) {
    switch (a.type) {
      case "set_param": {
        if (a.key === "gravityY") controller.setGravity({ x: 0, y: a.value });
        if (a.key === "airFriction") controller.setAirFriction(a.value);
        if (a.key === "restitution") controller.setRestitution(a.value);
        executed.push(a);
        break;
      }

      case "spawn_balls":
        controller.spawnBalls(a.count);
        executed.push(a);
        break;

      case "clear_forces":
        controller.clearForces();
        executed.push(a);
        break;

      case "clear_annotations": {
        const anns = controller.getAnnotations();
        for (const ann of anns) controller.removeAnnotation(ann.id);
        executed.push(a);
        break;
      }

      case "add_wind": {
        const region = getRegionById(annotations, a.regionAnnotationId);
        controller.addWind(
          a.direction,
          a.strength,
          region ? { center: region.center, radius: region.radius } : undefined,
          undefined,
          region?.id
        );
        executed.push(a);
        break;
      }

      case "add_attractor": {
        const region = getRegionById(annotations, a.regionAnnotationId);
        controller.addAttractor(
          a.center,
          a.strength,
          region ? { center: region.center, radius: region.radius } : undefined,
          undefined,
          region?.id
        );
        executed.push(a);
        break;
      }

      case "add_vortex": {
        const region = getRegionById(annotations, a.regionAnnotationId);
        controller.addVortex(
          a.center,
          a.strength,
          a.clockwise,
          region ? { center: region.center, radius: region.radius } : undefined,
          undefined,
          region?.id
        );
        executed.push(a);
        break;
      }
    }
  }

  return executed;
}
