import type { Routine } from "./types";

const s = (exerciseId: string, sets: number, reps: number, restSec = 90) =>
  ({ kind: "strength", exerciseId, sets, reps, restSec }) as const;

export function seedRoutines(now: number): Routine[] {
  return [
    {
      id: "seed-push",
      name: "Push · Chest, Shoulders, Triceps",
      createdAt: now,
      items: [
        { kind: "treadmill", minutes: 5, note: "Easy warm-up walk" },
        s("db-bench-press", 4, 8, 120),
        s("db-seated-press", 3, 10),
        s("db-fly", 3, 12, 60),
        s("db-lateral-raise", 3, 15, 60),
        s("db-skull-crusher", 3, 12, 60),
      ],
    },
    {
      id: "seed-pull",
      name: "Pull · Back, Biceps",
      createdAt: now,
      items: [
        { kind: "treadmill", minutes: 5, note: "Easy warm-up walk" },
        s("db-one-arm-row", 4, 10),
        s("db-chest-supported-row", 3, 12),
        s("db-pullover", 3, 12, 60),
        s("db-rear-delt-fly", 3, 15, 60),
        s("db-hammer-curl", 3, 12, 60),
        s("db-curl", 2, 12, 60),
      ],
    },
    {
      id: "seed-legs",
      name: "Legs & Core",
      createdAt: now,
      items: [
        { kind: "treadmill", minutes: 5, note: "Brisk incline walk" },
        s("db-goblet-squat", 4, 10, 120),
        s("db-rdl", 3, 10, 120),
        s("db-bulgarian-split-squat", 3, 10),
        s("db-hip-thrust", 3, 12),
        s("bench-leg-raise", 3, 12, 60),
      ],
    },
    {
      id: "seed-cardio",
      name: "Treadmill Intervals + Arms",
      createdAt: now,
      items: [
        { kind: "treadmill", minutes: 20, note: "1 min fast / 1 min easy" },
        s("db-hammer-curl", 3, 12, 45),
        s("db-overhead-ext", 3, 12, 45),
        s("db-russian-twist", 3, 20, 45),
      ],
    },
  ];
}
