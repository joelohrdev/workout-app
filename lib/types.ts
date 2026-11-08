export type Equipment = "dumbbell" | "bench" | "bodyweight";
export type Muscle =
  | "chest"
  | "back"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "legs"
  | "glutes"
  | "core";

export type Exercise = {
  id: string;
  name: string;
  muscle: Muscle;
  equipment: Equipment[];
  /** true when the exercise is done one side at a time */
  unilateral?: boolean;
  /** logged in seconds with a countdown (planks, holds) instead of reps */
  timed?: boolean;
  custom?: boolean;
};

export type StrengthItem = {
  kind: "strength";
  exerciseId: string;
  sets: number;
  reps: number;
  restSec: number;
  /** items sharing a group id are done as a superset / circuit */
  group?: string;
};

export type TreadmillItem = {
  kind: "treadmill";
  minutes: number;
  note?: string;
};

export type RoutineItem = StrengthItem | TreadmillItem;

export type Routine = {
  id: string;
  name: string;
  items: RoutineItem[];
  createdAt: number;
};

export type LoggedSet = {
  reps: number | null;
  weight: number | null;
  targetReps: number;
  done: boolean;
};

export type SessionStrength = {
  kind: "strength";
  exerciseId: string;
  restSec: number;
  sets: LoggedSet[];
  group?: string;
  note?: string;
};

export type SessionTreadmill = {
  kind: "treadmill";
  targetMinutes: number;
  timerId: string;
  distance: number | null;
  done: boolean;
};

export type SessionItem = SessionStrength | SessionTreadmill;

export type Session = {
  id: string;
  routineId: string | null;
  name: string;
  startedAt: number;
  endedAt: number | null;
  items: SessionItem[];
  restEndsAt: number | null;
  /** full length of the current rest, for the progress bar */
  restTotalMs?: number | null;
  /** exercise ids that hit a new estimated 1RM, set on finish */
  prs?: string[];
  /** how hard it felt, 1–10 */
  effort?: number | null;
  note?: string;
};

export type CardioLog = {
  id: string;
  date: number;
  durationSec: number;
  distance: number;
  unit: DistanceUnit;
  incline?: number | null;
  notes?: string;
  sessionId?: string;
  /** name of the interval plan used, if any */
  planName?: string;
};

export type IntervalBlock = {
  label: string;
  sec: number;
  speed?: number | null;
  incline?: number | null;
};

export type IntervalPlan = {
  id: string;
  name: string;
  /** warm-up / work / rest / cool-down blocks, already expanded */
  blocks: IntervalBlock[];
  createdAt: number;
  /** the builder inputs, so the plan can be edited later */
  recipe?: IntervalRecipe;
};

export type IntervalRecipe = {
  warmSec: number;
  rounds: number;
  work: { sec: number; speed: number | null; incline: number | null };
  recover: { sec: number; speed: number | null; incline: number | null };
  coolSec: number;
  easySpeed: number | null;
};

export type BodyLog = {
  id: string;
  date: number;
  weight?: number | null;
  waist?: number | null;
  chest?: number | null;
  arms?: number | null;
  hips?: number | null;
  thighs?: number | null;
  note?: string;
};

export type Dumbbells =
  | { mode: "fixed"; weights: number[] }
  | { mode: "adjustable"; min: number; max: number; step: number };

export type Reminders = {
  enabled: boolean;
  /** 0 = Sunday … 6 = Saturday */
  days: number[];
  /** "HH:MM", local time */
  time: string;
  /** IANA time zone the time is in */
  tz: string;
};

export type TimerState = {
  running: boolean;
  /** epoch ms when the current running stretch began */
  startedAt: number | null;
  /** ms accumulated before the current running stretch */
  accumulatedMs: number;
};

export type WeightUnit = "lb" | "kg";
export type DistanceUnit = "mi" | "km";

export type Settings = {
  weightUnit: WeightUnit;
  distanceUnit: DistanceUnit;
  restSound: boolean;
  /** seconds of rest started automatically after each completed set */
  restSec: number;
  dumbbells: Dumbbells;
  goals: { workoutsPerWeek: number; distancePerWeek: number };
  reminders: Reminders;
  /** body measurements unit */
  lengthUnit: "in" | "cm";
};

export type DB = {
  version: 1;
  routines: Routine[];
  sessions: Session[];
  cardio: CardioLog[];
  customExercises: Exercise[];
  intervalPlans: IntervalPlan[];
  body: BodyLog[];
  activeSession: Session | null;
  /** interval treadmill run in progress */
  intervalRun: { planId: string; timerId: string } | null;
  timers: Record<string, TimerState>;
  settings: Settings;
};
