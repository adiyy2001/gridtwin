function mpc = apply_generator_outage(mpc, row)
  define_constants;
  mpc.gen(row, GEN_STATUS) = 0;
  referenceRow = find(mpc.bus(:, BUS_TYPE) == REF);
  if mpc.bus(referenceRow, BUS_I) ~= mpc.gen(row, GEN_BUS)
    return;
  end
  candidates = find(mpc.gen(:, GEN_STATUS) > 0);
  ranking = sortrows([-mpc.gen(candidates, PMAX), mpc.gen(candidates, GEN_BUS), candidates]);
  newBus = mpc.gen(ranking(1, 3), GEN_BUS);
  mpc.bus(referenceRow, BUS_TYPE) = PQ;
  mpc.bus(find(mpc.bus(:, BUS_I) == newBus), BUS_TYPE) = REF;
end
