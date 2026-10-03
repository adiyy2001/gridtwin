startDir = pwd;
cd(getenv('MATPOWER_DIR'));
install_matpower(1, 0, 0);
cd(startDir);
define_constants;

opt = mpoption('verbose', 0, 'out.all', 0, 'pf.tol', 1e-10);
base = loadcase('case14');
base = rmfield(base, 'bus_name');
base = rmfield(base, 'gencost');
baseResult = runpf(base, opt);

apparent = @(r) max(abs(r.branch(:, PF) + 1j * r.branch(:, QF)), abs(r.branch(:, PT) + 1j * r.branch(:, QT)));
rating = max(ceil(1.25 * apparent(baseResult) / 5) * 5, 20);

bayBranch = [4 6 7 8 9];
bayNames = {'L2-4', 'L3-4', 'L4-5', 'T4-7', 'T4-9', 'LOAD'};
newBus = 40;

for mask = 1:63
  onSecond = bitget(mask, 1:6);
  if sum(onSecond) < 2 || sum(~onSecond) < 2
    continue;
  end
  split = base;
  split.bus(end + 1, :) = split.bus(4, :);
  split.bus(end, BUS_I) = newBus;
  split.bus(end, PD) = 0;
  split.bus(end, QD) = 0;
  for bay = 1:5
    if onSecond(bay)
      branchRow = bayBranch(bay);
      if split.branch(branchRow, F_BUS) == 4
        split.branch(branchRow, F_BUS) = newBus;
      else
        split.branch(branchRow, T_BUS) = newBus;
      end
    end
  end
  if onSecond(6)
    split.bus(end, PD) = base.bus(4, PD);
    split.bus(end, QD) = base.bus(4, QD);
    split.bus(4, PD) = 0;
    split.bus(4, QD) = 0;
  end
  result = runpf(split, opt);
  if ~result.success
    printf('BB2={%s} diverged\n', strjoin(bayNames(logical(onSecond)), ','));
    continue;
  end
  loading = apparent(result) ./ rating;
  [peak, row] = max(loading);
  printf('BB2={%s} peak %.2f at branch %d-%d, over100 %d, over120 %d, vmin %.3f\n', ...
         strjoin(bayNames(logical(onSecond)), ','), peak, base.branch(row, 1), base.branch(row, 2), ...
         sum(loading > 1), sum(loading > 1.2), min(result.bus(:, VM)));
end
