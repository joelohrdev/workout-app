import type { IntervalBlock, IntervalPlan, IntervalRecipe, Routine } from "./types";

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


/** Build a plan's blocks: warm-up, N × (work, recover), cool-down. */
export function expandIntervals(opts: IntervalRecipe): IntervalBlock[] {
  const blocks: IntervalBlock[] = [];
  if (opts.warmSec) blocks.push({ label: "Warm-up", sec: opts.warmSec, speed: opts.easySpeed ?? null, incline: 0 });
  for (let i = 1; i <= opts.rounds; i++) {
    blocks.push({ label: `Work ${i}/${opts.rounds}`, ...opts.work });
    if (opts.recover.sec) blocks.push({ label: "Recover", ...opts.recover });
  }
  if (opts.coolSec) blocks.push({ label: "Cool-down", sec: opts.coolSec, speed: opts.easySpeed ?? null, incline: 0 });
  return blocks;
}

export function seedPlans(now: number): IntervalPlan[] {
  return [
    {
      id: "seed-walk-run",
      name: "Walk / Run 1:1",
      createdAt: now,
      ...fromRecipe({
        warmSec: 300,
        rounds: 8,
        work: { sec: 60, speed: 6, incline: 1 },
        recover: { sec: 60, speed: 3.5, incline: 1 },
        coolSec: 300,
        easySpeed: 3.2,
      }),
    },
    {
      id: "seed-hills",
      name: "Hill Walk",
      createdAt: now,
      ...fromRecipe({
        warmSec: 180,
        rounds: 6,
        work: { sec: 120, speed: 3.5, incline: 8 },
        recover: { sec: 120, speed: 3.5, incline: 2 },
        coolSec: 180,
        easySpeed: 3,
      }),
    },
  ];
}

export function fromRecipe(recipe: IntervalRecipe): { blocks: IntervalBlock[]; recipe: IntervalRecipe } {
  return { blocks: expandIntervals(recipe), recipe };
}
