function reachable = reachable_from_reference(mpc)
  define_constants;
  buses = mpc.bus(:, BUS_I);
  reachable = false(rows(buses), 1);
  reachable(mpc.bus(:, BUS_TYPE) == REF) = true;
  active = mpc.branch(mpc.branch(:, BR_STATUS) > 0, :);
  changed = true;
  while changed
    changed = false;
    for k = 1:rows(active)
      from = find(buses == active(k, F_BUS));
      to = find(buses == active(k, T_BUS));
      if reachable(from) ~= reachable(to)
        reachable([from to]) = true;
        changed = true;
      end
    end
  end
end
