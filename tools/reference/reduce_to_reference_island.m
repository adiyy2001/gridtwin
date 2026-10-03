function [mpc, ids, unreachable] = reduce_to_reference_island(mpc, ids)
  define_constants;
  reachable = reachable_from_reference(mpc);
  unreachable = mpc.bus(~reachable, BUS_I)';
  keptBuses = mpc.bus(reachable, BUS_I);
  keptBranches = ismember(mpc.branch(:, F_BUS), keptBuses) & ismember(mpc.branch(:, T_BUS), keptBuses);
  mpc.bus = mpc.bus(reachable, :);
  mpc.gen = mpc.gen(ismember(mpc.gen(:, GEN_BUS), keptBuses), :);
  mpc.branch = mpc.branch(keptBranches, :);
  ids = ids(keptBranches);
end
