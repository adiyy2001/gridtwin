setup_matpower();
define_constants;
outputDirectory = getenv('OUT_DIR');
catalog = case_catalog();
variants = struct('name', {'plain', 'qlim'}, 'enforceQLimits', {false, true});

for entry = catalog
  base = load_clean_case(entry.matpowerName);
  ids = branch_ids(base.branch);
  for variant = variants
    outages = {};
    for row = 1:rows(base.branch)
      outages{end + 1} = n1_outage_record(base, ids, 'branch', row, variant.enforceQLimits);
    end
    for row = 1:rows(base.gen)
      outages{end + 1} = n1_outage_record(base, ids, 'generator', row, variant.enforceQLimits);
    end
    record = struct( ...
      'provenance', provenance_block('generate_n1_references.m', entry.sourceNote), ...
      'case', entry.id, ...
      'variant', variant.name, ...
      'loadFactor', 1.0, ...
      'enforceQLimits', variant.enforceQLimits, ...
      'slackRule', 'a generator outage at the reference bus moves the reference to the in-service generator with the largest PMAX, the lowest bus number breaking ties', ...
      'outages', {outages});
    write_json(fullfile(outputDirectory, sprintf('%s-n1-%s.json', entry.id, variant.name)), record);
  end
end
