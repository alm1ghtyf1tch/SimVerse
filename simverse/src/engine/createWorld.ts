import Matter from "matter-js";
import type { Params } from "../models/Params";

const { Engine, World, Bodies } = Matter;

export type WorldState = {
  engine: Matter.Engine;
  world: Matter.World;
  walls: Matter.Body[];
  balls: Matter.Body[];
  width: number;
  height: number;
};

export function createWorld(width: number, height: number, params: Params): WorldState {
  const engine = Engine.create();
  const world = engine.world;

  // Set gravity
  engine.gravity.x = params.gravity.x;
  engine.gravity.y = params.gravity.y;
  engine.gravity.scale = 0.001; // default-ish; keep stable

  // Walls (thicker helps stability)
  const thickness = 60;
  const wallOptions: Matter.IChamferableBodyDefinition = {
    isStatic: true,
    restitution: 1,
    friction: 0,
    frictionStatic: 0,
  };

  const walls: Matter.Body[] = [
    Bodies.rectangle(width / 2, -thickness / 2, width, thickness, wallOptions), // top
    Bodies.rectangle(width / 2, height + thickness / 2, width, thickness, wallOptions), // bottom
    Bodies.rectangle(-thickness / 2, height / 2, thickness, height, wallOptions), // left
    Bodies.rectangle(width + thickness / 2, height / 2, thickness, height, wallOptions), // right
  ];

  // Deterministic ball placement (grid)
  const balls: Matter.Body[] = [];
  const r = params.ballRadius;
  const cols = Math.ceil(Math.sqrt(params.ballCount));
  const rows = Math.ceil(params.ballCount / cols);

  const startX = width * 0.25;
  const startY = height * 0.25;
  const spacing = r * 2.6;

  let i = 0;
  for (let row = 0; row < rows && i < params.ballCount; row++) {
    for (let col = 0; col < cols && i < params.ballCount; col++) {
      const x = startX + col * spacing;
      const y = startY + row * spacing;

      const ball = Bodies.circle(x, y, r, {
        restitution: params.restitution,
        friction: 0,
        frictionStatic: 0,
        frictionAir: params.airFriction,
      });

      // Give a small deterministic initial velocity
      Matter.Body.setVelocity(ball, {
        x: (col - cols / 2) * 0.2,
        y: (row - rows / 2) * 0.2,
      });

      balls.push(ball);
      i++;
    }
  }

  World.add(world, [...walls, ...balls]);

  return { engine, world, walls, balls, width, height };
}
