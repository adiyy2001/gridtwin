function mpc = widen_slack_limits(mpc)
  define_constants;
  slackBuses = mpc.bus(mpc.bus(:, BUS_TYPE) == REF, BUS_I);
  slackRows = ismember(mpc.gen(:, GEN_BUS), slackBuses);
  mpc.gen(slackRows, QMAX) = 9999;
  mpc.gen(slackRows, QMIN) = -9999;
end
