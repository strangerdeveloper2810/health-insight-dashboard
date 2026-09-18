/**
 * The user. No persona was supplied with the brief, so this is ours — kept in
 * one module so that swapping in a real one is a single-file change.
 */

import type { Persona } from "./types";

/** Day 1 of the 12-week plan, expressed as days before today. */
export const PLAN_STARTED_DAYS_AGO = 47;
export const PLAN_LENGTH_DAYS = 84;

export const MAYA: Persona = {
  id: "maya-tran",
  name: "Maya Tran",
  age: 34,
  sex: "female",
  occupation: "Product designer at a mid-size software company",
  location: "Singapore",
  heightCm: 164,

  riskFactors: [
    "Mother diagnosed with type-2 diabetes at 58",
    "LDL cholesterol mildly elevated at last annual checkup (3.6 mmol/L)",
    "Desk-based role — averages nine sedentary hours on weekdays",
    "Family history of hypertension on her father's side",
  ],
  conditions: ["Mild seasonal allergic rhinitis"],
  medications: ["Cetirizine 10 mg as needed during allergy season"],

  subjectiveNotes: [
    "Reports an energy crash most afternoons around 3pm",
    "Says she is 'tired but wired' and takes 30–45 minutes to fall asleep",
    "Wants to feel strong rather than just lighter — weight is not her stated goal",
    "Finds weekday mornings rushed and often skips breakfast",
  ],

  primaryGoal: {
    id: "goal-10k",
    kind: "journey",
    label: "Run 10 km without stopping",
    metric: "longestRunKm",
    unit: "km",
    startValue: 3.0,
    targetValue: 10,
    direction: "increase",
    startDate: "",
    targetDate: "",
    rationale:
      "Aerobic fitness is the single highest-leverage change given her family history of type-2 diabetes. A continuous 10K is the concrete milestone she chose for it.",
  },
  secondaryGoals: [
    {
      id: "goal-steps",
      kind: "threshold",
      label: "Average 8,000 steps a day",
      metric: "steps",
      unit: "steps",
      startValue: 6200,
      targetValue: 8000,
      direction: "increase",
      startDate: "",
      targetDate: "",
      rationale:
        "Breaks up the nine sedentary weekday hours, which matters independently of formal exercise.",
    },
    {
      id: "goal-sleep",
      kind: "threshold",
      label: "Sleep at least 7 hours",
      metric: "sleepDurationMin",
      unit: "min",
      startValue: 370,
      targetValue: 420,
      direction: "increase",
      startDate: "",
      targetDate: "",
      rationale:
        "Short sleep worsens insulin sensitivity — a specific concern given her family history, not just a general wellness platitude.",
    },
    {
      id: "goal-rhr",
      // A level, not a habit: resting heart rate drifts by a beat or two around
      // its baseline, so counting "days under 60" would report noise rather
      // than progress. It moves from 64 toward 60 like a journey.
      kind: "journey",
      label: "Resting heart rate under 60 bpm",
      metric: "restingHeartRate",
      unit: "bpm",
      startValue: 64,
      targetValue: 60,
      direction: "decrease",
      startDate: "",
      targetDate: "",
      rationale: "A simple, objective marker of aerobic fitness improving.",
    },
  ],

  clinicianGuidance:
    "Annual review with fasting glucose and lipid panel. Advised to prioritise sleep and aerobic exercise; no medication indicated at this stage.",
};

/** Goals with their dates filled in relative to the dataset window. */
export const personaWithDatedGoals = (
  persona: Persona,
  startDate: string,
  planStartDate: string,
  targetDate: string,
): Persona => {
  return {
    ...persona,
    primaryGoal: { ...persona.primaryGoal, startDate: planStartDate, targetDate },
    secondaryGoals: persona.secondaryGoals.map((goal) => ({
      ...goal,
      startDate,
      targetDate,
    })),
  };
};
