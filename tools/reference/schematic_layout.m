function positions = schematic_layout(mpc)
  define_constants;
  count = rows(mpc.bus);
  index = zeros(max(mpc.bus(:, BUS_I)), 1);
  index(mpc.bus(:, BUS_I)) = 1:count;
  from = index(mpc.branch(:, F_BUS));
  to = index(mpc.branch(:, T_BUS));
  angles = 2 * pi * (0:count - 1)' / count;
  positions = [cos(angles), sin(angles)];
  spring = 1 / sqrt(count);
  temperature = 0.2;
  for iteration = 1:400
    delta = positions(:, 1) - positions(:, 1)';
    deltaY = positions(:, 2) - positions(:, 2)';
    distance = max(sqrt(delta .^ 2 + deltaY .^ 2), 1e-3);
    repulsion = spring ^ 2 ./ distance .^ 2;
    forceX = sum(delta .* repulsion, 2);
    forceY = sum(deltaY .* repulsion, 2);
    for k = 1:rows(from)
      a = from(k);
      b = to(k);
      dx = positions(a, 1) - positions(b, 1);
      dy = positions(a, 2) - positions(b, 2);
      segment = max(sqrt(dx ^ 2 + dy ^ 2), 1e-3);
      pull = segment / spring ^ 2 * 0.25;
      forceX(a) = forceX(a) - dx * pull;
      forceY(a) = forceY(a) - dy * pull;
      forceX(b) = forceX(b) + dx * pull;
      forceY(b) = forceY(b) + dy * pull;
    end
    magnitude = max(sqrt(forceX .^ 2 + forceY .^ 2), 1e-9);
    step = min(magnitude, temperature);
    positions = positions + [forceX ./ magnitude .* step, forceY ./ magnitude .* step];
    temperature = temperature * 0.985;
  end
  low = min(positions, [], 1);
  high = max(positions, [], 1);
  scaled = (positions - low) ./ max(high - low, 1e-9);
  positions = round([60 + scaled(:, 1) * 880, 60 + scaled(:, 2) * 580]);
end
