function mpc = scale_loads(mpc, loadFactor)
  define_constants;
  mpc.bus(:, [PD QD]) = loadFactor * mpc.bus(:, [PD QD]);
end
