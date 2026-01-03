import { Projections, Simulation } from "@aligntrue/core";

import { getHost, getTrajectoryStore } from "./ops-services";

let cachedEngine: Simulation.SimulationEngine | null = null;

async function buildEngine(): Promise<Simulation.SimulationEngine> {
  await getHost();
  const store = getTrajectoryStore();

  const coo = await Projections.rebuildTrajectoryProjection(
    Projections.CooccurrenceProjectionDef,
    store,
  );
  const transitions = await Projections.rebuildTrajectoryProjection(
    Projections.TransitionProjectionDef,
    store,
  );
  const signatures = await Projections.rebuildTrajectoryProjection(
    Projections.SignatureProjectionDef,
    store,
  );
  const outcomes = await Projections.rebuildTrajectoryProjection(
    Projections.OutcomeCorrelationProjectionDef,
    store,
  );

  return Simulation.createSimulationEngine({
    cooccurrence: coo.data,
    transitions: transitions.data,
    signatures: signatures.data,
    outcomeCorrelations: outcomes.data,
  });
}

export async function getSimulationEngine(): Promise<Simulation.SimulationEngine> {
  if (cachedEngine) return cachedEngine;
  cachedEngine = await buildEngine();
  return cachedEngine;
}

export async function runBlastRadius(
  query: Simulation.BlastRadiusQuery,
): Promise<Simulation.BlastRadiusResult> {
  const engine = await getSimulationEngine();
  return engine.blastRadius(query);
}

export async function runSimilarTrajectories(
  query: Simulation.SimilarTrajectoriesQuery,
): Promise<Simulation.SimilarTrajectoriesResult> {
  const engine = await getSimulationEngine();
  return engine.similarTrajectories(query);
}

export async function runChangeSimulation(
  query: Simulation.ChangeSimulationQuery,
): Promise<Simulation.ChangeSimulationResult> {
  const engine = await getSimulationEngine();
  return engine.simulateChange(query);
}
