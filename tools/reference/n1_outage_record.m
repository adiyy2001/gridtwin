function outage = n1_outage_record(base, ids, kind, row, enforceQLimits)
  define_constants;
  mpc = base;
  if strcmp(kind, 'branch')
    mpc.branch(row, BR_STATUS) = 0;
    equipment = ids{row};
  else
    mpc = apply_generator_outage(mpc, row);
    equipment = sprintf('G%d', base.gen(row, GEN_BUS));
  end
  outage = struct('kind', kind, 'id', equipment, 'status', 'islanded');
  if ~connected_from_reference(mpc)
    return;
  end
  if enforceQLimits
    mpc = widen_slack_limits(mpc);
  end
  result = runpf(mpc, reference_options(enforceQLimits));
  if result.success
    outage.status = 'solved';
    meta = struct('provenance', struct(), 'caseId', '', 'variant', '', 'loadFactor', 1.0, 'enforceQLimits', enforceQLimits);
    record = solution_record(mpc, result, ids, meta);
    outage.referenceBus = mpc.bus(find(mpc.bus(:, BUS_TYPE) == REF), BUS_I);
    outage.iterations = record.iterations;
    outage.totalLoadMw = record.totalLoadMw;
    outage.totalGenerationMw = record.totalGenerationMw;
    outage.totalLossMw = record.totalLossMw;
    outage.buses = record.buses;
    outage.generators = record.generators;
    outage.branches = record.branches;
  else
    outage.status = 'diverged';
  end
end
