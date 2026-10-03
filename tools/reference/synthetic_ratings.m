function ratings = synthetic_ratings(result)
  define_constants;
  apparent = max(abs(result.branch(:, PF) + 1j * result.branch(:, QF)), ...
                 abs(result.branch(:, PT) + 1j * result.branch(:, QT)));
  ratings = max(ceil(1.25 * apparent / 5) * 5, 20);
end
