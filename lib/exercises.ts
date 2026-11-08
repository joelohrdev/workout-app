import type { Exercise, Muscle } from "./types";

export const EXERCISES: Exercise[] = [
  // Chest
  { id: "db-bench-press", name: "Dumbbell Bench Press", muscle: "chest", equipment: ["dumbbell", "bench"] },
  { id: "db-fly", name: "Dumbbell Fly", muscle: "chest", equipment: ["dumbbell", "bench"] },
  { id: "db-squeeze-press", name: "Squeeze Press", muscle: "chest", equipment: ["dumbbell", "bench"] },
  { id: "db-pullover", name: "Dumbbell Pullover", muscle: "chest", equipment: ["dumbbell", "bench"] },
  { id: "push-up", name: "Push-up", muscle: "chest", equipment: ["bodyweight"] },
  // Back
  { id: "db-one-arm-row", name: "One-arm Row (bench supported)", muscle: "back", equipment: ["dumbbell", "bench"], unilateral: true },
  { id: "db-bent-row", name: "Bent-over Row", muscle: "back", equipment: ["dumbbell"] },
  { id: "db-chest-supported-row", name: "Prone Row (lying on bench)", muscle: "back", equipment: ["dumbbell", "bench"] },
  { id: "db-shrug", name: "Dumbbell Shrug", muscle: "back", equipment: ["dumbbell"] },
  // Shoulders
  { id: "db-seated-press", name: "Seated Shoulder Press", muscle: "shoulders", equipment: ["dumbbell", "bench"] },
  { id: "db-arnold-press", name: "Arnold Press", muscle: "shoulders", equipment: ["dumbbell", "bench"] },
  { id: "db-lateral-raise", name: "Lateral Raise", muscle: "shoulders", equipment: ["dumbbell"] },
  { id: "db-rear-delt-fly", name: "Rear Delt Fly", muscle: "shoulders", equipment: ["dumbbell"] },
  { id: "db-front-raise", name: "Front Raise", muscle: "shoulders", equipment: ["dumbbell"] },
  // Arms
  { id: "db-curl", name: "Dumbbell Curl", muscle: "biceps", equipment: ["dumbbell"] },
  { id: "db-hammer-curl", name: "Hammer Curl", muscle: "biceps", equipment: ["dumbbell"] },
  { id: "db-concentration-curl", name: "Concentration Curl", muscle: "biceps", equipment: ["dumbbell", "bench"], unilateral: true },
  { id: "db-skull-crusher", name: "Lying Triceps Extension", muscle: "triceps", equipment: ["dumbbell", "bench"] },
  { id: "db-overhead-ext", name: "Overhead Triceps Extension", muscle: "triceps", equipment: ["dumbbell", "bench"] },
  { id: "db-kickback", name: "Triceps Kickback", muscle: "triceps", equipment: ["dumbbell", "bench"], unilateral: true },
  { id: "bench-dip", name: "Bench Dip", muscle: "triceps", equipment: ["bench", "bodyweight"] },
  // Legs & glutes
  { id: "db-goblet-squat", name: "Goblet Squat", muscle: "legs", equipment: ["dumbbell"] },
  { id: "db-bulgarian-split-squat", name: "Bulgarian Split Squat", muscle: "legs", equipment: ["dumbbell", "bench"], unilateral: true },
  { id: "db-step-up", name: "Bench Step-up", muscle: "legs", equipment: ["dumbbell", "bench"], unilateral: true },
  { id: "db-lunge", name: "Reverse Lunge", muscle: "legs", equipment: ["dumbbell"], unilateral: true },
  { id: "db-calf-raise", name: "Standing Calf Raise", muscle: "legs", equipment: ["dumbbell"] },
  { id: "db-rdl", name: "Romanian Deadlift", muscle: "glutes", equipment: ["dumbbell"] },
  { id: "db-hip-thrust", name: "Hip Thrust (back on bench)", muscle: "glutes", equipment: ["dumbbell", "bench"] },
  // Core
  { id: "plank", name: "Plank", muscle: "core", equipment: ["bodyweight"], timed: true },
  { id: "side-plank", name: "Side Plank", muscle: "core", equipment: ["bodyweight"], timed: true, unilateral: true },
  { id: "wall-sit", name: "Wall Sit", muscle: "legs", equipment: ["bodyweight"], timed: true },
  { id: "db-farmer-hold", name: "Farmer's Hold", muscle: "core", equipment: ["dumbbell"], timed: true },
  { id: "db-russian-twist", name: "Russian Twist", muscle: "core", equipment: ["dumbbell"] },
  { id: "bench-leg-raise", name: "Bench Leg Raise", muscle: "core", equipment: ["bench", "bodyweight"] },
  { id: "db-dead-bug", name: "Weighted Dead Bug", muscle: "core", equipment: ["dumbbell"] },
];

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  legs: "Legs",
  glutes: "Glutes",
  core: "Core",
};

export const MUSCLE_ORDER: Muscle[] = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "legs",
  "glutes",
  "core",
];

export function findExercise(id: string, custom: Exercise[]): Exercise {
  return (
    EXERCISES.find((e) => e.id === id) ??
    custom.find((e) => e.id === id) ?? {
      id,
      name: "Unknown exercise",
      muscle: "core",
      equipment: [],
    }
  );
}

/** Exercises that are logged without load (weight input hidden by default). */
export function isBodyweight(ex: Exercise): boolean {
  return ex.equipment.length > 0 && !ex.equipment.includes("dumbbell");
}
