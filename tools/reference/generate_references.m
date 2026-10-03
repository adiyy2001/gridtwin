setup_matpower();
define_constants;
outputDirectory = getenv('OUT_DIR');
catalog = case_catalog();
loadFactors = [0.5 1.0 1.2 1.5];

for entry = catalog
  base = load_clean_case(entry.matpowerName);
  ids = branch_ids(base.branch);
  for loadFactor = loadFactors
    for enforceQLimits = [false true]
      mpc = scale_loads(base, loadFactor);
      if enforceQLimits
        mpc = widen_slack_limits(mpc);
        variant = 'qlim';
      else
        variant = 'plain';
      end
      result = runpf(mpc, reference_options(enforceQLimits));
      if ~result.success
        error('power flow did not converge: %s %s load factor %g', entry.id, variant, loadFactor);
      end
      meta = struct( ...
        'provenance', provenance_block('generate_references.m', entry.sourceNote), ...
        'caseId', entry.id, ...
        'variant', variant, ...
        'loadFactor', loadFactor, ...
        'enforceQLimits', enforceQLimits);
      name = sprintf('%s-lf%03d-%s.json', entry.id, round(loadFactor * 100), variant);
      write_json(fullfile(outputDirectory, name), solution_record(mpc, result, ids, meta));
    end
  end
end

base = load_clean_case('case14');
ids = branch_ids(base.branch);
baseResult = runpf(base, reference_options(false));
secondBusbarBranches = [4 8 9];
secondBusbarNumber = 40;

split = base;
split.bus(end + 1, :) = split.bus(4, :);
split.bus(end, BUS_I) = secondBusbarNumber;
split.bus(end, PD) = base.bus(4, PD);
split.bus(end, QD) = base.bus(4, QD);
split.bus(4, PD) = 0;
split.bus(4, QD) = 0;
for row = secondBusbarBranches
  if split.branch(row, F_BUS) == 4
    split.branch(row, F_BUS) = secondBusbarNumber;
  else
    split.branch(row, T_BUS) = secondBusbarNumber;
  end
end

substationNote = 'MATPOWER case14 with bus 4 split into busbar 1 (bus 4: L3-4, L4-5) and busbar 2 (bus 40: L2-4, T4-7, T4-9 and the load)';
openResult = runpf(split, reference_options(false));
if ~openResult.success
  error('power flow did not converge for the substation with the coupler open');
end
closedResult = baseResult;
closedResult.bus(end + 1, :) = baseResult.bus(4, :);
closedResult.bus(end, BUS_I) = secondBusbarNumber;
closedResult.branch(:, F_BUS) = split.branch(:, F_BUS);
closedResult.branch(:, T_BUS) = split.branch(:, T_BUS);

states = struct('variant', {'coupler-closed', 'coupler-open'}, 'result', {closedResult, openResult});
for state = states
  meta = struct( ...
    'provenance', provenance_block('generate_references.m', substationNote), ...
    'caseId', 'ieee14-substation', ...
    'variant', state.variant, ...
    'loadFactor', 1.0, ...
    'enforceQLimits', false);
  name = sprintf('ieee14-substation-%s.json', state.variant);
  write_json(fullfile(outputDirectory, name), solution_record(split, state.result, ids, meta));
end
