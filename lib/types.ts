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
  custom?: boolean;
};

export type StrengthItem = {
  kind: "strength";
  exerciseId: string;
  sets: number;
  reps: number;
  restSec: number;
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
};

export type DB = {
  version: 1;
  routines: Routine[];
  sessions: Session[];
  cardio: CardioLog[];
  customExercises: Exercise[];
  activeSession: Session | null;
  timers: Record<string, TimerState>;
  settings: Settings;
};
