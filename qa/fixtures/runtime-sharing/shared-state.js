const state = globalThis.__runtimeFixtureState || {
  evaluations: 0,
  mounts: 0,
};

globalThis.__runtimeFixtureState = state;
state.evaluations += 1;
state.mounts += 1;
