function mpc = load_clean_case(matpowerName)
  mpc = loadcase(matpowerName);
  if isfield(mpc, 'bus_name')
    mpc = rmfield(mpc, 'bus_name');
  end
  if isfield(mpc, 'gencost')
    mpc = rmfield(mpc, 'gencost');
  end
end
